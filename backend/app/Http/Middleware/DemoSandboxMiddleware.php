<?php

namespace App\Http\Middleware;

use App\Services\DemoSandboxService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class DemoSandboxMiddleware
{
    /**
     * Gerencia o isolamento persistente do Modo Demo (via X-Demo-Session)
     * e o portão de senha para acesso ao Site Real (via X-Store-Access-Token).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $previousConnection = DB::getDefaultConnection();
        $previousMail = Config::get('mail.default');

        $rawSessionHeader = $request->header('X-Demo-Session');
        $rawBodySession = $request->is('api/demo/iniciar') ? $request->input('session_id') : null;
        $rawSessionId = is_string($rawSessionHeader) && trim($rawSessionHeader) !== ''
            ? $rawSessionHeader
            : (is_string($rawBodySession) && trim($rawBodySession) !== '' ? $rawBodySession : null);

        // 1. Modo Demo ativo quando X-Demo-Session é enviado
        if ($rawSessionId !== null) {
            $sessionId = DemoSandboxService::validateSessionId($rawSessionId);
            if ($sessionId === null) {
                return response()->json([
                    'message' => 'Identificador de sessão Demo inválido. Use entre 8 e 128 caracteres alfanuméricos, hífen ou sublinhado.',
                    'code'    => 'INVALID_DEMO_SESSION',
                ], 400);
            }

            try {
                DemoSandboxService::activateSession($sessionId);
                // Bloqueia disparo real de SMTP em qualquer requisição no Modo Demo
                Config::set('mail.default', 'array');

                $response = $next($request);

                if (DemoSandboxService::isDemo()) {
                    $response->headers->set('X-Demo-Mode', 'active');
                    $response->headers->set('X-Demo-Session', DemoSandboxService::currentSessionId());
                }

                return $response;
            } finally {
                DemoSandboxService::restoreDefaultConnection($previousConnection);
                Config::set('mail.default', $previousMail);
            }
        }

        // 2. Modo Site Real (sem X-Demo-Session)
        DemoSandboxService::clearDemoState();

        if (! $this->deveBypassarPortaoReal($request) && ! $this->rotaPublicaLiberadaSemToken($request)) {
            $storeToken = $request->header('X-Store-Access-Token');
            if (! DemoSandboxService::validateStoreAccessToken($storeToken)) {
                return response()->json([
                    'message' => 'Acesso restrito ao site oficial em período de testes. Informe a senha de acesso real ou utilize o Modo Demo.',
                    'code'    => 'STORE_ACCESS_REQUIRED',
                ], 403);
            }
        }

        try {
            $response = $next($request);

            // Caso /api/demo/iniciar tenha iniciado uma nova sessão sem header prévio
            if (DemoSandboxService::isDemo()) {
                $response->headers->set('X-Demo-Mode', 'active');
                $response->headers->set('X-Demo-Session', DemoSandboxService::currentSessionId());
            }

            return $response;
        } finally {
            DemoSandboxService::restoreDefaultConnection($previousConnection);
            Config::set('mail.default', $previousMail);
        }
    }

    /**
     * Em testes unitários/feature automatizados existentes, mantém compatibilidade
     * exceto quando o teste ativa explicitamente o gate com X-Enforce-Store-Gate: 1.
     */
    private function deveBypassarPortaoReal(Request $request): bool
    {
        if (! app()->runningUnitTests()) {
            return false;
        }

        return $request->header('X-Enforce-Store-Gate') !== '1';
    }

    /**
     * Define quais endpoints permanecem acessíveis no Site Real antes de informar a senha do portão
     * (apenas endpoints de controle do demo/portão, webhooks externos e leituras públicas da vitrine).
     */
    private function rotaPublicaLiberadaSemToken(Request $request): bool
    {
        if ($request->isMethod('OPTIONS')) {
            return true;
        }

        if ($request->is(
            'up',
            'api/demo',
            'api/demo/*',
            'api/webhooks/*',
            'api/auth/verificar-email',
            'api/auth/reenviar-validacao'
        )) {
            return true;
        }

        if ($request->isMethod('GET') || $request->isMethod('HEAD')) {
            return $request->is(
                'api/produtos',
                'api/produtos/*',
                'api/categorias',
                'api/devocaos',
                'api/colecoes',
                'api/modelos',
                'api/configuracoes',
                'api/configuracoes/publicas',
                'api/cupons/disponiveis'
            );
        }

        return false;
    }
}
