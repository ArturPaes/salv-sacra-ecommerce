<?php

namespace App\Http\Controllers;

use App\Models\Cupom;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\User;
use App\Services\DemoSandboxService;
use App\Services\NotificacaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;

class DemoController extends Controller
{
    /**
     * Valida a senha de acesso ao Site Real (em período de testes) e libera o token de acesso.
     */
    public function validarAcessoReal(Request $request): JsonResponse
    {
        $request->validate([
            'senha' => ['required', 'string'],
        ], [
            'senha.required' => 'Informe a senha para acessar o site oficial.',
        ]);

        if (! DemoSandboxService::verifyRealPassword((string) $request->input('senha'))) {
            return response()->json([
                'valid'   => false,
                'message' => 'Senha incorreta. Para testar sem restrições, utilize o Modo Demo.',
            ], 403);
        }

        return response()->json([
            'valid'              => true,
            'store_access_token' => DemoSandboxService::generateStoreAccessToken(),
            'message'            => 'Acesso ao site oficial liberado com sucesso.',
        ]);
    }

    /**
     * Inicia ou retoma uma sessão Demo persistente e isolada, retornando tokens prontos para uso.
     */
    public function iniciar(Request $request): JsonResponse
    {
        $rawSession = $request->header('X-Demo-Session') ?: $request->input('session_id');
        if (is_string($rawSession) && trim($rawSession) !== '') {
            $sessionId = DemoSandboxService::validateSessionId($rawSession);
            if ($sessionId === null) {
                return response()->json([
                    'message' => 'Identificador de sessão Demo inválido.',
                    'code'    => 'INVALID_DEMO_SESSION',
                ], 400);
            }
        } else {
            $sessionId = 'demo_' . Str::uuid()->toString();
        }

        $info = DemoSandboxService::activateSession($sessionId, $request->boolean('reset', false));
        Config::set('mail.default', 'array');

        return response()->json($this->buildSessionPayload($info));
    }

    /**
     * Retorna o estado atual completo da sessão Demo (usuários cadastrados, pedidos e cupons/vales).
     */
    public function status(): JsonResponse
    {
        if (! DemoSandboxService::isDemo()) {
            return response()->json([
                'message' => 'Nenhuma sessão Demo ativa. Envie o header X-Demo-Session.',
            ], 400);
        }

        return response()->json([
            'session_id'     => DemoSandboxService::currentSessionId(),
            'ativo'          => true,
            'total_pedidos'  => Pedido::count(),
            'total_produtos' => Produto::count(),
            'usuarios'       => $this->listarUsuariosSessao(),
            'cupons_ativos'  => $this->listarCuponsSessao(),
        ]);
    }

    /**
     * Alterna rapidamente o usuário autenticado dentro da sessão Demo (Admin, Cliente ou nova conta criada).
     */
    public function alternarUsuario(Request $request): JsonResponse
    {
        if (! DemoSandboxService::isDemo()) {
            return response()->json([
                'message' => 'Operação permitida apenas dentro de uma sessão Demo ativa (X-Demo-Session).',
            ], 400);
        }

        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'papel'   => ['nullable', 'string', 'in:admin,cliente'],
        ]);

        if (empty($validated['user_id']) && empty($validated['papel'])) {
            return response()->json([
                'message' => 'Informe user_id ou papel (admin/cliente) para alternar usuário na Demo.',
            ], 422);
        }

        $user = ! empty($validated['user_id'])
            ? User::find($validated['user_id'])
            : User::where('papel', $validated['papel'])->orderBy('id')->first();

        if (! $user) {
            return response()->json([
                'message' => 'Usuário não encontrado nesta sessão Demo.',
            ], 404);
        }

        if ($user->bloqueado) {
            return response()->json([
                'message' => 'Esta conta está bloqueada nesta sessão Demo e não pode ser acessada.',
                'code'    => 'ACCOUNT_BLOCKED',
            ], 403);
        }

        $token = $user->createToken('demo_switch_token')->plainTextToken;

        return response()->json([
            'message' => "Alternado para {$user->name} ({$user->papel}).",
            'token'   => $token,
            'user'    => $user->fresh(),
        ]);
    }

    /**
     * Reseta completamente a sessão Demo atual para o estado inicial limpo com catálogo oficial atualizado.
     */
    public function resetar(): JsonResponse
    {
        $sessionId = DemoSandboxService::currentSessionId();
        if (! $sessionId) {
            return response()->json([
                'message' => 'Nenhuma sessão Demo ativa para resetar. Envie o header X-Demo-Session.',
            ], 400);
        }

        $info = DemoSandboxService::activateSession($sessionId, forceReset: true);
        Config::set('mail.default', 'array');

        return response()->json(array_merge(
            ['message' => 'Ambiente Demo restaurado para o estado inicial com sucesso.'],
            $this->buildSessionPayload($info)
        ));
    }

    /**
     * Simula aprovação imediata de pagamento pendente (PIX ou Boleto) em Modo Demo.
     */
    public function simularPagamento(Pedido $pedido): JsonResponse
    {
        if (! DemoSandboxService::isDemo()) {
            return response()->json([
                'message' => 'A simulação de pagamento só pode ser usada em uma sessão Demo ativa (X-Demo-Session).',
            ], 400);
        }

        if ($pedido->status === 'Pago') {
            return response()->json([
                'mensagem' => 'Este pedido já está com pagamento confirmado.',
                'pedido'   => $pedido->load(['itens.variacao.produto', 'user', 'cupom', 'valeCompra']),
            ]);
        }

        if ($pedido->status === 'Cancelado') {
            return response()->json([
                'message' => 'Não é possível simular pagamento de um pedido cancelado.',
            ], 422);
        }

        $pedido->update([
            'status'       => 'Pago',
            'pagamento_id' => $pedido->pagamento_id ?: ('DEMO-PAY-' . strtoupper(Str::random(10))),
        ]);

        if ($pedido->user_id) {
            NotificacaoService::notificarCliente(
                $pedido->user_id,
                'pedido',
                "Pagamento Confirmado (Demo)! · Pedido #{$pedido->id}",
                "Pagamento simulado aprovado com sucesso no valor de R$ " . number_format((float) $pedido->valor_total, 2, ',', '.') . '.',
                "/minha-conta?aba=pedidos&pedido={$pedido->id}",
                $pedido->id
            );
        }

        NotificacaoService::notificarAdmin(
            'pedido',
            "Pagamento Confirmado no Pedido #{$pedido->id} (Demo)",
            "O pedido #{$pedido->id} teve seu pagamento confirmado via simulação no Ambiente Demo.",
            '/admin/pedidos',
            $pedido->id
        );

        return response()->json([
            'mensagem' => 'Pagamento simulado aprovado com sucesso!',
            'pedido'   => $pedido->fresh()->load(['itens.variacao.produto', 'user', 'cupom', 'valeCompra']),
        ]);
    }

    private function buildSessionPayload(array $info): array
    {
        $admin = User::where('papel', 'admin')->where('bloqueado', false)->orderBy('id')->first()
            ?: User::where('papel', 'admin')->orderBy('id')->first();

        $cliente = User::where('papel', 'cliente')->where('bloqueado', false)->orderBy('id')->first()
            ?: User::where('papel', 'cliente')->orderBy('id')->first();

        $adminToken = $admin && ! $admin->bloqueado
            ? $admin->createToken('demo_admin_token')->plainTextToken
            : null;

        $clienteToken = $cliente && ! $cliente->bloqueado
            ? $cliente->createToken('demo_cliente_token')->plainTextToken
            : null;

        return [
            'session_id'     => $info['session_id'],
            'is_new'         => $info['is_new'],
            'driver'         => $info['driver'],
            'total_pedidos'  => Pedido::count(),
            'total_produtos' => Produto::count(),
            'tokens'         => [
                'admin'   => $adminToken,
                'cliente' => $clienteToken,
            ],
            'contas_padrao' => [
                'admin'   => $admin,
                'cliente' => $cliente,
            ],
            'usuarios'      => $this->listarUsuariosSessao(),
            'cupons_ativos' => $this->listarCuponsSessao(),
        ];
    }

    private function listarUsuariosSessao()
    {
        return User::withTrashed()
            ->orderBy('id')
            ->get([
                'id',
                'name',
                'email',
                'papel',
                'cpf',
                'telefone',
                'bloqueado',
                'email_verified_at',
                'deleted_at',
                'created_at',
            ]);
    }

    private function listarCuponsSessao()
    {
        return Cupom::orderBy('id')
            ->get([
                'id',
                'codigo',
                'descricao',
                'tipo',
                'percentual',
                'valor_fixo',
                'valor_inicial',
                'saldo_atual',
                'status',
                'ativo',
                'user_id',
            ]);
    }
}
