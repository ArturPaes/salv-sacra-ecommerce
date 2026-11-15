<?php

namespace App\Http\Controllers;

use App\Models\Configuracao;
use App\Services\DemoSandboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConfiguracaoController extends Controller
{
    /**
     * Retorna todas as configurações para a administração, organizadas por chave e grupo.
     */
    public function index(): JsonResponse
    {
        $configs = Configuracao::all()->pluck('valor', 'chave');

        if (DemoSandboxService::isDemo()) {
            $overrides = DemoSandboxService::getDemoConfigOverrides();
            $chavesProtegidas = [
                'mercadopago_access_token',
                'mercadopago_public_key',
                'melhor_envio_token',
                'melhor_envio_sandbox_token',
                'cartao_gateway_modo',
            ];
            foreach ($chavesProtegidas as $chave) {
                if (isset($overrides[$chave])) {
                    $configs[$chave] = $overrides[$chave]['valor'];
                }
            }
        }

        return response()->json($configs);
    }

    /**
     * Retorna apenas configurações públicas necessárias para a vitrine (banner, contatos, etc.).
     */
    public function publicas(): JsonResponse
    {
        $chavesPublicas = [
            'nome_loja',
            'slogan_loja',
            'frete_gratis_minimo',
            'aviso_topo_texto',
            'aviso_topo_ativo',
            'pix_desconto_pct',
            'mercadopago_public_key',
            'cartao_parcelas_max',
            'cartao_parcela_minima',
            'cartao_gateway_modo',
            'contato_email',
            'contato_telefone',
            'contato_whatsapp',
            'contato_endereco',
            'instagram_url',
            'carrossel_slides',
        ];

        $configs = Configuracao::whereIn('chave', $chavesPublicas)
            ->pluck('valor', 'chave');

        if (DemoSandboxService::isDemo()) {
            $overrides = DemoSandboxService::getDemoConfigOverrides();
            foreach (['mercadopago_public_key', 'cartao_gateway_modo'] as $chave) {
                if (isset($overrides[$chave])) {
                    $configs[$chave] = $overrides[$chave]['valor'];
                }
            }
        }

        return response()->json($configs);
    }

    /**
     * Atualiza um lote de configurações passadas como chave => valor.
     */
    public function updateBatch(Request $request): JsonResponse
    {
        $dados = $request->all();

        foreach ($dados as $chave => $valor) {
            Configuracao::updateOrCreate(
                ['chave' => $chave],
                ['valor' => (string) $valor]
            );
        }

        $todas = Configuracao::all()->pluck('valor', 'chave');

        return response()->json([
            'message' => 'Configurações atualizadas com sucesso.',
            'configuracoes' => $todas,
        ]);
    }
}
