<?php

namespace App\Http\Controllers;

use App\Mail\AtivarContaMail;
use App\Models\Avaliacao;
use App\Models\Endereco;
use App\Models\Pedido;
use App\Models\User;
use App\Rules\StrongPassword;
use App\Services\DemoSandboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Área "Minha Conta" do cliente autenticado:
 * perfil, senha, endereços e pedidos.
 */
class ContaController extends Controller
{
    /** Retorna resumo para a tela inicial da conta: contadores e último pedido. */
    public function resumo(Request $request): JsonResponse
    {
        $user = $request->user();

        app(PedidoController::class)->cancelarPedidosPendentesExpirados($user->id);

        $ultimoPedido = Pedido::where('user_id', $user->id)
            ->with(['itens.variacao.produto', 'devolucao'])
            ->orderByDesc('data_pedido')
            ->first();

        // Pedido pendente de pagamento PIX (aguardando transferência / QR Code)
        $pedidoPendentePix = Pedido::where('user_id', $user->id)
            ->where('status', 'Pendente')
            ->where(function ($q) {
                $q->where('metodo_pagamento', 'pix')
                  ->orWhereNull('metodo_pagamento')
                  ->orWhere('metodo_pagamento', 'not like', '%cartao%');
            })
            ->latest('id')
            ->first();

        // Pedido com cartão em análise de segurança pela operadora
        $pedidoPendenteCartao = Pedido::where('user_id', $user->id)
            ->where('status', 'Pendente')
            ->where('metodo_pagamento', 'like', '%cartao%')
            ->latest('id')
            ->first();

        return response()->json([
            'total_pedidos'             => $user->pedidos()->count(),
            'pedidos_pendentes'         => $pedidoPendentePix ? 1 : 0,
            'pedido_pendente_id'        => $pedidoPendentePix?->id,
            'pedidos_em_analise_cartao' => $pedidoPendenteCartao ? 1 : 0,
            'total_enderecos'           => $user->enderecos()->count(),
            'total_cartoes'             => $user->cartoes()->count(),
            'total_favoritos'           => $user->favoritos()->count(),
            'ultimo_pedido'             => $ultimoPedido,
        ]);
    }

    /** Atualiza as informações pessoais. */
    public function atualizarPerfil(Request $request): JsonResponse
    {
        $user = $request->user();

        $dados = $request->validate([
            'name'            => ['required', 'string', 'max:255'],
            'email'           => ['sometimes', 'nullable', 'email', 'max:255'],
            'telefone'        => ['nullable', 'string', 'max:30'],
            'cpf'             => ['nullable', 'string', 'max:14'],
            'data_nascimento' => ['nullable', 'date', 'before:today'],
        ]);

        // Alteração de e-mail é processada exclusivamente via solicitarTrocaEmail com validação
        unset($dados['email'], $dados['email_verified_at']);

        if (array_key_exists('cpf', $dados)) {
            $cpfLimpo = preg_replace('/\D/', '', (string) ($dados['cpf'] ?? ''));
            if ($cpfLimpo !== '') {
                if (! $this->validarCpf($cpfLimpo)) {
                    throw ValidationException::withMessages([
                        'cpf' => ['O CPF informado é inválido. Confira os números digitados.'],
                    ]);
                }
                $dados['cpf'] = $cpfLimpo;
            } else {
                $dados['cpf'] = null;
            }
        }

        $user->update($dados);

        return response()->json(['message' => 'Dados atualizados com sucesso.', 'user' => $user->fresh()]);
    }

    /**
     * Solicita a alteração de e-mail do usuário autenticado.
     * - No Modo Demo: altera e valida automaticamente.
     * - Na Loja Real: envia link de validação para o novo e-mail mantendo o e-mail atual ativo até a confirmação.
     */
    public function solicitarTrocaEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->merge([
            'novo_email' => trim(strtolower((string) $request->input('novo_email', ''))),
        ]);

        $dados = $request->validate([
            'novo_email' => ['required', 'email', 'max:255'],
        ], [
            'novo_email.required' => 'Informe o novo endereço de e-mail.',
            'novo_email.email'    => 'Informe um endereço de e-mail válido.',
        ]);

        $novoEmail = trim(strtolower($dados['novo_email']));

        if ($novoEmail === trim(strtolower((string) $user->email))) {
            throw ValidationException::withMessages([
                'novo_email' => ['O novo e-mail deve ser diferente do seu e-mail atual.'],
            ]);
        }

        $emUso = User::withTrashed()
            ->whereRaw('LOWER(email) = ?', [$novoEmail])
            ->where('id', '!=', $user->id)
            ->exists();

        if ($emUso) {
            throw ValidationException::withMessages([
                'novo_email' => ['Este e-mail já está cadastrado em outra conta.'],
            ]);
        }

        $emailBloqueado = DB::table('blocked_emails')
            ->whereRaw('LOWER(email) = ?', [$novoEmail])
            ->exists();

        if ($emailBloqueado) {
            throw ValidationException::withMessages([
                'novo_email' => ['Este e-mail está bloqueado pela administração.'],
            ]);
        }

        if (DemoSandboxService::isDemo()) {
            $user->forceFill([
                'email'               => $novoEmail,
                'email_verified_at'   => now(),
                'pending_email'       => null,
                'pending_email_token' => null,
            ])->save();

            return response()->json([
                'message'            => 'E-mail alterado e validado automaticamente no Modo Demo!',
                'demo_auto_verified' => true,
                'user'               => $user->fresh(),
            ]);
        }

        $token = Str::random(64);
        $user->forceFill([
            'pending_email'       => $novoEmail,
            'pending_email_token' => $token,
        ])->save();

        try {
            Mail::to($novoEmail)->send(new AtivarContaMail($user->name, $novoEmail, $token, true));
        } catch (\Throwable $e) {
            Log::error('Erro ao enviar e-mail de confirmação de troca de e-mail: ' . $e->getMessage());
            return response()->json([
                'message' => 'Não foi possível enviar o e-mail de confirmação no momento. Tente novamente em instantes.',
            ], 500);
        }

        return response()->json([
            'message'            => "Enviamos um link de validação para {$novoEmail}. Caso não valide o novo endereço, seu e-mail atual ({$user->email}) continuará ativo.",
            'demo_auto_verified' => false,
            'pending_email'      => $novoEmail,
            'user'               => $user->fresh(),
        ]);
    }

    /**
     * Envia um link de validação de e-mail para o usuário autenticado cujo e-mail ainda esteja pendente.
     */
    public function enviarVerificacaoEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! is_null($user->email_verified_at)) {
            return response()->json([
                'message' => 'Seu e-mail já está verificado.',
                'user'    => $user,
            ]);
        }

        $email = trim(strtolower($user->email));
        $token = \Illuminate\Support\Str::random(64);

        \Illuminate\Support\Facades\DB::table('pending_registrations')->updateOrInsert(
            ['email' => $email],
            [
                'name'       => $user->name,
                'password'   => $user->password,
                'token'      => $token,
                'created_at' => now(),
            ]
        );

        try {
            \Illuminate\Support\Facades\Mail::to($email)->send(new \App\Mail\AtivarContaMail($user->name, $email, $token));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Erro ao enviar e-mail de verificação pela Minha Conta: ' . $e->getMessage());
            return response()->json([
                'message' => 'Não foi possível enviar o e-mail de verificação no momento. Tente novamente em instantes.',
            ], 500);
        }

        return response()->json([
            'message' => "Enviamos um link de validação para {$email}. Verifique sua caixa de entrada e spam.",
        ]);
    }

    /** Altera a senha confirmando a senha atual. */
    public function alterarSenha(Request $request): JsonResponse
    {
        $request->validate([
            'senha_atual' => ['required', 'string'],
            'password'    => ['required', 'string', 'min:8', 'confirmed', new StrongPassword()],
        ], [
            'senha_atual.required' => 'Informe sua senha atual.',
            'password.required'    => 'Informe a nova senha.',
            'password.min'         => 'A nova senha deve ter pelo menos 8 caracteres.',
            'password.confirmed'   => 'A confirmação de senha não confere.',
        ]);

        $user = $request->user();

        if (! Hash::check($request->senha_atual, $user->password)) {
            throw ValidationException::withMessages([
                'senha_atual' => ['A senha atual está incorreta.'],
            ]);
        }

        $user->update(['password' => $request->password]);

        // Revoga outras sessões/tokens ativos mantendo apenas o token atual logado
        $currentToken = $user->currentAccessToken();
        if ($currentToken && isset($currentToken->id)) {
            $user->tokens()->where('id', '!=', $currentToken->id)->delete();
        }

        return response()->json(['message' => 'Senha alterada com sucesso.']);
    }

    // ── Endereços ───────────────────────────────────────────────────────

    public function enderecos(Request $request): JsonResponse
    {
        return response()->json($request->user()->enderecos()->latest()->get());
    }

    /**
     * Retorna o endereço mais recente usado em compras pelo usuário, caso não possua endereço salvo no perfil.
     */
    public function ultimoEnderecoPedido(Request $request): JsonResponse
    {
        $ultimoPedido = Pedido::where('user_id', $request->user()->id)
            ->whereNotNull('cep')
            ->whereNotNull('logradouro')
            ->orderByDesc('id')
            ->first();

        if (! $ultimoPedido) {
            return response()->json(null);
        }

        return response()->json([
            'cep'         => $ultimoPedido->cep,
            'logradouro'  => $ultimoPedido->logradouro,
            'numero'      => $ultimoPedido->numero,
            'complemento' => $ultimoPedido->complemento,
            'bairro'      => $ultimoPedido->bairro,
            'cidade'      => $ultimoPedido->cidade,
            'estado'      => $ultimoPedido->estado,
            'telefone'    => $ultimoPedido->telefone,
            'cpf'         => $ultimoPedido->cpf,
        ]);
    }

    public function criarEndereco(Request $request): JsonResponse
    {
        $endereco = $request->user()->enderecos()->create($this->validarEndereco($request));

        return response()->json($endereco, 201);
    }

    public function atualizarEndereco(Request $request, Endereco $endereco): JsonResponse
    {
        $this->autorizarEndereco($request, $endereco);
        $endereco->update($this->validarEndereco($request));

        return response()->json($endereco);
    }

    public function removerEndereco(Request $request, Endereco $endereco): JsonResponse
    {
        $this->autorizarEndereco($request, $endereco);
        $endereco->delete();

        return response()->json(['message' => 'Endereço removido.']);
    }

    // ── Pedidos ─────────────────────────────────────────────────────────

    public function pedidos(Request $request): JsonResponse
    {
        $user = $request->user();

        app(PedidoController::class)->cancelarPedidosPendentesExpirados($user->id);
        \App\Services\RastreioService::sincronizarSeNecessario();

        $pedidos = Pedido::where('user_id', $user->id)
            ->with(['itens.variacao.produto', 'devolucao'])
            ->orderByDesc('data_pedido')
            ->get();

        return response()->json($pedidos);
    }

    // ── Cartões ─────────────────────────────────────────────────────────

    public function cartoes(Request $request): JsonResponse
    {
        return response()->json($request->user()->cartoes()->latest()->get());
    }

    public function criarCartao(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'tipo'     => ['required', 'in:credito,debito'],
            'titular'  => ['required', 'string', 'max:255'],
            'cpf'      => ['required', 'string', 'max:20'],
            'numero'   => ['required', 'string', 'min:12', 'max:25'],
            'validade' => ['required', 'string', 'regex:/^(0[1-9]|1[0-2])\/?([0-9]{2}|[0-9]{4})$/'],
            'bandeira' => ['nullable', 'string', 'max:50'],
        ]);

        $limpo = preg_replace('/\D/', '', $dados['numero']);
        $cpfLimpo = preg_replace('/\D/', '', $dados['cpf']);
        if (! $this->validarCpf($cpfLimpo)) {
            throw ValidationException::withMessages([
                'cpf' => ['O CPF informado para o titular do cartão é inválido.'],
            ]);
        }
        $ultimos = substr($limpo, -4);

        $cartao = $request->user()->cartoes()->create([
            'tipo'            => $dados['tipo'],
            'titular'         => mb_strtoupper($dados['titular']),
            'cpf'             => $cpfLimpo,
            'numero'          => $limpo,
            'ultimos_digitos' => $ultimos,
            'bandeira'        => $dados['bandeira'] ?? $this->identificarBandeira($limpo),
            'validade'        => $dados['validade'],
        ]);

        return response()->json($cartao, 201);
    }

    public function removerCartao(Request $request, \App\Models\Cartao $cartao): JsonResponse
    {
        abort_unless($cartao->user_id === $request->user()->id, 403, 'Acesso negado.');
        $cartao->delete();

        return response()->json(['message' => 'Cartão removido com sucesso.']);
    }

    // ── Lista de Desejos (Favoritos / Wishlist) ─────────────────────────

    public function favoritos(Request $request): JsonResponse
    {
        $favoritos = $request->user()
            ->favoritos()
            ->with([
                'produto' => function ($q) {
                    $q->with(['categoria', 'devocao', 'variacoes'])
                      ->withCount('avaliacoes')
                      ->withAvg('avaliacoes', 'nota');
                },
            ])
            ->latest()
            ->get()
            ->map(fn ($fav) => $fav->produto)
            ->filter()
            ->values();

        return response()->json($favoritos);
    }

    public function toggleFavorito(Request $request, \App\Models\Produto $produto): JsonResponse
    {
        $user = $request->user();

        $existente = $user->favoritos()->where('produto_id', $produto->id)->first();

        if ($existente) {
            $existente->delete();
            return response()->json([
                'favoritado' => false,
                'produto_id' => $produto->id,
                'message'    => 'Produto removido da sua lista de desejos.',
            ]);
        }

        $user->favoritos()->create([
            'produto_id' => $produto->id,
        ]);

        return response()->json([
            'favoritado' => true,
            'produto_id' => $produto->id,
            'message'    => 'Produto salvo na sua lista de desejos!',
        ], 201);
    }

    public function sincronizarFavoritos(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'produto_ids'   => ['required', 'array'],
            'produto_ids.*' => ['integer', 'exists:produtos,id'],
        ]);

        $user = $request->user();
        foreach ($validated['produto_ids'] as $pid) {
            $user->favoritos()->firstOrCreate(['produto_id' => $pid]);
        }

        return $this->favoritos($request);
    }

    /**
     * Desativa a conta do usuário a seu pedido:
     * - Preserva os pedidos e dados cadastrais para consulta exclusiva do administrador (logística, emissão fiscal e histórico).
     * - Mantém o nome do cliente original com o sufixo " (Conta Desativada)".
     * - Libera o e-mail para eventuais novos cadastros futuros prefixando como desativado.
     * - Remove cartões salvos e tokens de acesso para garantir a segurança.
     * - Invalida a senha de acesso e aplica Soft Delete no usuário.
     */
    public function excluirConta(Request $request): JsonResponse
    {
        $user = $request->user();

        if (\App\Services\DemoSandboxService::isDemo() && strtolower(trim((string) $user->email)) === 'cliente@demo.salvsacra.com') {
            return response()->json([
                'message' => 'A conta padrão Cliente Demo não pode ser excluída. Se quiser testar a exclusão de conta, cadastre um novo cliente.',
            ], 422);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($user) {
            // 1. Remove dados sensíveis de pagamento e sessões ativas
            $user->cartoes()->delete();
            $user->enderecos()->delete();
            $user->favoritos()->delete();
            $user->tokens()->delete();

            // 2. Preserva o nome do cliente original com a indicação "(Conta Desativada)"
            $nomeBase = trim(preg_replace('/\s*\(Conta Desativada\)/i', '', $user->name ?: 'Cliente'));
            $nomeAtualizado = $nomeBase . ' (Conta Desativada)';

            // Mantém os dados cadastrais (telefone, CPF, nascimento) disponíveis para o administrador
            $user->update([
                'name'     => $nomeAtualizado,
                'email'    => 'desativado_' . $user->id . '_' . $user->email,
                'password' => \Illuminate\Support\Facades\Hash::make(\Illuminate\Support\Str::random(60)),
            ]);

            // 3. Aplica Soft Delete para desativar o login e o acesso à conta
            $user->delete();
        });

        return response()->json([
            'message' => 'Sua conta foi desativada com sucesso.',
        ]);
    }

    /** Lista todas as avaliações feitas pelo cliente autenticado. */
    public function avaliacoes(Request $request): JsonResponse
    {
        $avaliacoes = Avaliacao::where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->get([
                'id',
                'produto_id',
                'user_id',
                'nota',
                'titulo',
                'comentario',
                'compra_verificada',
                'created_at',
                'updated_at',
            ]);

        return response()->json($avaliacoes);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private function validarCpf(string $cpf): bool
    {
        $d = preg_replace('/\D/', '', $cpf);
        if (strlen($d) !== 11 || preg_match('/^(\d)\1{10}$/', $d)) {
            return false;
        }
        for ($t = 9; $t < 11; $t++) {
            for ($dSum = 0, $c = 0; $c < $t; $c++) {
                $dSum += (int) $d[$c] * (($t + 1) - $c);
            }
            $dSum = ((10 * $dSum) % 11) % 10;
            if ((int) $d[$c] !== $dSum) {
                return false;
            }
        }
        return true;
    }

    private function identificarBandeira(string $numero): string
    {
        if (preg_match('/^4/', $numero)) return 'Visa';
        if (preg_match('/^5[1-5]|^2[2-7]/', $numero)) return 'Mastercard';
        if (preg_match('/^3[47]/', $numero)) return 'American Express';
        if (preg_match('/^6(?:011|5)/', $numero)) return 'Discover';
        if (preg_match('/^(4011|4389|4514|4576|5041|5066|509|6277|6362|6363|650|6516|6550)/', $numero)) return 'Elo';
        if (preg_match('/^6062/', $numero)) return 'Hipercard';
        return 'Cartão';
    }

    private function validarEndereco(Request $request): array
    {
        return $request->validate([
            'cep'         => ['required', 'string', 'max:20'],
            'logradouro'  => ['required', 'string', 'max:255'],
            'numero'      => ['required', 'string', 'max:50'],
            'complemento' => ['nullable', 'string', 'max:255'],
            'bairro'      => ['required', 'string', 'max:150'],
            'cidade'      => ['required', 'string', 'max:150'],
            'estado'      => ['required', 'string', 'size:2'],
        ]);
    }

    private function autorizarEndereco(Request $request, Endereco $endereco): void
    {
        abort_unless($endereco->user_id === $request->user()->id, 403, 'Acesso negado.');
    }
}
