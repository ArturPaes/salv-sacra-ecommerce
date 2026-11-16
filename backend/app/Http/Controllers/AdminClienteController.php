<?php

namespace App\Http\Controllers;

use App\Models\Cupom;
use App\Models\Pedido;
use App\Models\User;
use App\Services\DemoSandboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminClienteController extends Controller
{
    /**
     * Lista todos os clientes cadastrados na loja para gerenciamento no painel Admin.
     */
    public function index(Request $request): JsonResponse
    {
        $clientes = User::with(['enderecos' => fn ($q) => $q->latest('id')])
            ->withCount('pedidos')
            ->withSum(['pedidos as total_gasto' => fn ($q) => $q->where('status', '!=', 'Cancelado')], 'valor_total')
            ->where(function ($q) {
                $q->whereNull('papel')->orWhere('papel', '!=', 'admin');
            })
            ->orderByDesc('id')
            ->get();

        // Fallback de endereço a partir do último pedido caso o cliente ainda não tenha endereço salvo em `enderecos`
        $semEnderecoIds = $clientes->filter(fn ($c) => $c->enderecos->isEmpty())->pluck('id')->all();
        $ultimosPedidosPorUser = [];
        if (! empty($semEnderecoIds)) {
            $pedidosRecentes = Pedido::whereIn('user_id', $semEnderecoIds)
                ->orderByDesc('id')
                ->get(['id', 'user_id', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado']);

            foreach ($pedidosRecentes as $ped) {
                if (! isset($ultimosPedidosPorUser[$ped->user_id]) && $ped->logradouro) {
                    $ultimosPedidosPorUser[$ped->user_id] = [
                        'cep'         => $ped->cep,
                        'logradouro'  => $ped->logradouro,
                        'numero'      => $ped->numero,
                        'complemento' => $ped->complemento,
                        'bairro'      => $ped->bairro,
                        'cidade'      => $ped->cidade,
                        'estado'      => $ped->estado,
                        'origem'      => 'pedido',
                    ];
                }
            }
        }

        $payload = $clientes->map(function (User $c) use ($ultimosPedidosPorUser) {
            $end = $c->enderecos->first();
            $enderecoPrincipal = $end
                ? [
                    'cep'         => $end->cep,
                    'logradouro'  => $end->logradouro,
                    'numero'      => $end->numero,
                    'complemento' => $end->complemento,
                    'bairro'      => $end->bairro,
                    'cidade'      => $end->cidade,
                    'estado'      => $end->estado,
                    'origem'      => 'cadastro',
                ]
                : ($ultimosPedidosPorUser[$c->id] ?? null);

            return [
                'id'                 => $c->id,
                'name'               => $c->name,
                'email'              => $c->email,
                'telefone'           => $c->telefone,
                'cpf'                => $c->cpf,
                'data_nascimento'    => $c->data_nascimento?->format('Y-m-d'),
                'email_verificado'   => ! is_null($c->email_verified_at),
                'bloqueado'          => (bool) $c->bloqueado,
                'bloqueado_motivo'   => $c->bloqueado_motivo,
                'bloqueado_em'       => $c->bloqueado_em?->toIso8601String(),
                'created_at'         => $c->created_at?->toIso8601String(),
                'pedidos_count'      => (int) ($c->pedidos_count ?? 0),
                'total_gasto'        => (float) ($c->total_gasto ?? 0),
                'endereco_principal' => $enderecoPrincipal,
                'enderecos'          => $c->enderecos,
            ];
        });

        return response()->json($payload);
    }

    /**
     * Exibe os detalhes completos de um cliente, seus endereços, pedidos e vales-compra.
     */
    public function show(int $id): JsonResponse
    {
        $cliente = User::with([
            'enderecos' => fn ($q) => $q->latest('id'),
            'pedidos'   => fn ($q) => $q->with('itens.variacao.produto')->orderByDesc('id'),
        ])->findOrFail($id);

        if ($cliente->papel === 'admin') {
            return response()->json(['message' => 'Usuário administrativo não pode ser gerenciado por esta rota.'], 403);
        }

        $vales = Cupom::where('user_id', $cliente->id)
            ->where(function ($q) {
                $q->whereIn('tipo', [Cupom::TIPO_VALE_COMPRA, 'troca'])
                    ->orWhere('codigo', 'like', 'TROCA-%')
                    ->orWhere('codigo', 'like', 'VALE-%');
            })
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'id'               => $cliente->id,
            'name'             => $cliente->name,
            'email'            => $cliente->email,
            'telefone'         => $cliente->telefone,
            'cpf'              => $cliente->cpf,
            'data_nascimento'  => $cliente->data_nascimento?->format('Y-m-d'),
            'email_verificado' => ! is_null($cliente->email_verified_at),
            'bloqueado'        => (bool) $cliente->bloqueado,
            'bloqueado_motivo' => $cliente->bloqueado_motivo,
            'bloqueado_em'     => $cliente->bloqueado_em?->toIso8601String(),
            'created_at'       => $cliente->created_at?->toIso8601String(),
            'enderecos'        => $cliente->enderecos,
            'pedidos'          => $cliente->pedidos,
            'vales_compra'     => $vales,
        ]);
    }

    /**
     * Bloqueia a conta de um cliente e impede novos cadastros com o mesmo e-mail.
     */
    public function bloquear(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'motivo' => ['nullable', 'string', 'max:1000'],
        ]);

        $cliente = User::findOrFail($id);

        if ($cliente->papel === 'admin' || $cliente->id === $request->user()->id) {
            return response()->json([
                'message' => 'Não é permitido bloquear uma conta de administrador.',
            ], 422);
        }

        $motivo = isset($validated['motivo']) && trim($validated['motivo']) !== ''
            ? trim($validated['motivo'])
            : 'Conta bloqueada pela administração.';

        DB::transaction(function () use ($cliente, $motivo, $request) {
            $tokenHashes = $cliente->tokens()->pluck('token')->all();
            foreach ($tokenHashes as $hash) {
                Cache::put("blocked_token:{$hash}", [
                    'user_id'    => $cliente->id,
                    'motivo'     => $motivo,
                    'blocked_at' => now()->toIso8601String(),
                ], now()->addDays(30));
            }

            $cliente->update([
                'bloqueado'        => true,
                'bloqueado_motivo' => $motivo,
                'bloqueado_em'     => now(),
            ]);

            $cliente->tokens()->delete();

            $emailLimpo = trim(strtolower((string) $cliente->email));
            if ($emailLimpo !== '' && ! str_starts_with($emailLimpo, 'desativado_')) {
                DB::table('blocked_emails')->updateOrInsert(
                    ['email' => $emailLimpo],
                    [
                        'motivo'     => $motivo,
                        'blocked_by' => $request->user()->id,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }
        });

        $cliente->refresh();

        return response()->json([
            'message' => "Cliente #{$id} ({$cliente->name}) bloqueado com sucesso.",
            'cliente' => [
                'id'               => $cliente->id,
                'bloqueado'        => true,
                'bloqueado_motivo' => $cliente->bloqueado_motivo,
                'bloqueado_em'     => $cliente->bloqueado_em?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Desbloqueia a conta de um cliente e libera seu e-mail da lista de bloqueio.
     */
    public function desbloquear(int $id): JsonResponse
    {
        $cliente = User::findOrFail($id);

        DB::transaction(function () use ($cliente) {
            $emailLimpo = trim(strtolower((string) $cliente->email));

            $cliente->update([
                'bloqueado'        => false,
                'bloqueado_motivo' => null,
                'bloqueado_em'     => null,
            ]);

            if ($emailLimpo !== '') {
                DB::table('blocked_emails')->whereRaw('LOWER(email) = ?', [$emailLimpo])->delete();
            }
        });

        return response()->json([
            'message' => "Cliente #{$id} ({$cliente->name}) desbloqueado com sucesso.",
            'cliente' => [
                'id'               => $cliente->id,
                'bloqueado'        => false,
                'bloqueado_motivo' => null,
                'bloqueado_em'     => null,
            ],
        ]);
    }

    /**
     * Exclui (soft delete) um cliente da loja, liberando o e-mail para novo cadastro caso não esteja bloqueado.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $cliente = User::findOrFail($id);

        if ($cliente->papel === 'admin' || $cliente->id === $request->user()->id) {
            return response()->json([
                'message' => 'Não é permitido excluir uma conta de administrador.',
            ], 422);
        }

        if (DemoSandboxService::isDemo()) {
            $baseQuery = User::where(function ($q) {
                $q->whereNull('papel')->orWhere('papel', '!=', 'admin');
            });

            $totalClientes = (clone $baseQuery)->count();
            if ($totalClientes <= 1) {
                return response()->json([
                    'message' => 'No Modo Demo não é permitido excluir a única conta de cliente disponível na sessão.',
                ], 422);
            }

            if (!$cliente->bloqueado) {
                $clientesAtivos = (clone $baseQuery)->where('bloqueado', false)->count();
                if ($clientesAtivos <= 1) {
                    return response()->json([
                        'message' => 'No Modo Demo é necessário manter ao menos uma conta de cliente ativa disponível.',
                    ], 422);
                }
            }
        }

        $nomeOriginal = $cliente->name;

        DB::transaction(function () use ($cliente, $request) {
            $emailOriginal = trim(strtolower((string) $cliente->email));

            // Se a conta estava bloqueada, garante que o e-mail siga registrado em blocked_emails
            if ($cliente->bloqueado && $emailOriginal !== '' && ! str_starts_with($emailOriginal, 'desativado_')) {
                DB::table('blocked_emails')->updateOrInsert(
                    ['email' => $emailOriginal],
                    [
                        'motivo'     => $cliente->bloqueado_motivo ?: 'E-mail bloqueado pela administração.',
                        'blocked_by' => $request->user()->id,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }

            $cliente->cartoes()->delete();
            $cliente->enderecos()->delete();
            $cliente->favoritos()->delete();
            $cliente->tokens()->delete();

            $nomeBase = trim(preg_replace('/\s*\(Conta Desativada\)/i', '', $cliente->name ?: 'Cliente'));
            $emailAtualizado = str_starts_with((string) $cliente->email, 'desativado_')
                ? $cliente->email
                : 'desativado_' . $cliente->id . '_' . $cliente->email;

            $cliente->update([
                'name'     => $nomeBase . ' (Conta Desativada)',
                'email'    => $emailAtualizado,
                'password' => Hash::make(Str::random(60)),
            ]);

            $cliente->delete();
        });

        return response()->json([
            'message' => "Cliente #{$id} ({$nomeOriginal}) excluído com sucesso.",
        ]);
    }
}
