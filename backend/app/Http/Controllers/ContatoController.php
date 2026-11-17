<?php

namespace App\Http\Controllers;

use App\Services\DemoSandboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ContatoController extends Controller
{
    /**
     * Recebe o formulário de contato e valida o reCAPTCHA no Google.
     */
    public function enviar(Request $request): JsonResponse
    {
        $isDemo = DemoSandboxService::isDemo();

        $dados = $request->validate([
            'nome'      => ['required', 'string', 'max:255'],
            'email'     => ['required', 'email', 'max:255'],
            'telefone'  => ['nullable', 'string', 'max:30'],
            'mensagem'  => ['required', 'string', 'max:5000'],
            'recaptcha' => [$isDemo ? 'nullable' : 'required', 'string'],
        ]);

        if (! $isDemo) {
            $resposta = Http::withoutVerifying()
                ->asForm()
                ->post('https://www.google.com/recaptcha/api/siteverify', [
                    'secret'   => config('services.recaptcha.secret'),
                    'response' => $dados['recaptcha'],
                    'remoteip' => $request->ip(),
                ]);

            if (! $resposta->json('success')) {
                return response()->json(['message' => 'Falha na verificação do reCAPTCHA.'], 422);
            }
        }

        unset($dados['recaptcha']);
        Log::info('Nova mensagem de contato', $dados);

        // Envia cópia da mensagem para o e-mail da loja
        try {
            $destinatarioAdmin = (config('mail.from.address') ?: 'salvsacra2@gmail.com');
            \Illuminate\Support\Facades\Mail::to($destinatarioAdmin)->send(new \App\Mail\ContatoMail($dados));
        } catch (\Throwable $e) {
            Log::error('Erro ao enviar e-mail de contato: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Mensagem enviada com sucesso.']);
    }
}
