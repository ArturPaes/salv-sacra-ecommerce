<?php

namespace Tests\Feature;

use App\Models\Cupom;
use App\Models\Pedido;
use App\Models\Produto;
use App\Models\User;
use App\Services\DemoSandboxService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class DemoSandboxTest extends TestCase
{
    /** @var string[] */
    protected array $demoSessionsToCleanup = [];

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('app.store_real_password', 'artp2004');
    }

    protected function tearDown(): void
    {
        DemoSandboxService::restoreDefaultConnection('pgsql');

        foreach ($this->demoSessionsToCleanup as $sid) {
            DemoSandboxService::destroySession($sid);
        }

        parent::tearDown();
    }

    private function novoSessionId(string $prefixo = 'test'): string
    {
        $sid = "demo_{$prefixo}_" . strtolower(Str::random(12));
        $this->demoSessionsToCleanup[] = $sid;

        return $sid;
    }

    public function test_01_portao_de_senha_do_site_real_bloqueia_e_libera_acesso(): void
    {
        // Sem X-Store-Access-Token e com X-Enforce-Store-Gate: 1 -> leitura pública de catálogo funciona
        $catResp = $this->withHeaders([
            'X-Enforce-Store-Gate' => '1',
        ])->getJson('/api/produtos');
        $catResp->assertStatus(200);

        // Sem X-Store-Access-Token -> escrita/login/cadastro/conta/admin ficam bloqueados com 403 STORE_ACCESS_REQUIRED
        $this->withHeaders(['X-Enforce-Store-Gate' => '1'])
            ->postJson('/api/auth/login', ['email' => 'x@x.com', 'password' => '12345678'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'STORE_ACCESS_REQUIRED');

        $this->withHeaders(['X-Enforce-Store-Gate' => '1'])
            ->postJson('/api/frete/calcular', ['cep' => '88701000'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'STORE_ACCESS_REQUIRED');

        $this->withHeaders(['X-Enforce-Store-Gate' => '1'])
            ->getJson('/api/conta/resumo')
            ->assertStatus(403)
            ->assertJsonPath('code', 'STORE_ACCESS_REQUIRED');

        // Senha incorreta -> 403
        $this->postJson('/api/demo/validar-acesso-real', ['senha' => 'senha-errada'])
            ->assertStatus(403)
            ->assertJsonPath('valid', false);

        // Senha correta (artp2004) -> libera token
        $gateResp = $this->postJson('/api/demo/validar-acesso-real', ['senha' => 'artp2004'])
            ->assertStatus(200)
            ->assertJsonPath('valid', true);

        $storeToken = $gateResp->json('store_access_token');
        $this->assertNotEmpty($storeToken);

        // Com X-Store-Access-Token válido -> passa pelo portão (retorna 422 de credenciais, nunca 403 STORE_ACCESS_REQUIRED)
        $loginResp = $this->withHeaders([
            'X-Enforce-Store-Gate' => '1',
            'X-Store-Access-Token' => $storeToken,
        ])->postJson('/api/auth/login', [
            'email'    => 'naoexiste@salvsacra.test',
            'password' => '12345678',
        ]);

        $this->assertNotEquals(403, $loginResp->getStatusCode());
    }

    public function test_02_inicializacao_demo_copia_catalogo_blinda_dados_sigilosos_e_cria_arquivo_sqlite(): void
    {
        // Formato inválido de sessão é rejeitado com 400
        $this->withHeaders(['X-Demo-Session' => '../invalid!'])
            ->getJson('/api/demo/status')
            ->assertStatus(400)
            ->assertJsonPath('code', 'INVALID_DEMO_SESSION');

        $sid = $this->novoSessionId('init');
        $qtdProdutosOficiais = Produto::count();

        $initResp = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/demo/iniciar');

        $initResp->assertStatus(200)
            ->assertHeader('X-Demo-Mode', 'active')
            ->assertHeader('X-Demo-Session', $sid)
            ->assertJsonPath('session_id', $sid)
            ->assertJsonPath('is_new', true)
            ->assertJsonPath('total_pedidos', 0)
            ->assertJsonPath('total_produtos', $qtdProdutosOficiais);

        $adminToken = $initResp->json('tokens.admin');
        $clienteToken = $initResp->json('tokens.cliente');
        $this->assertNotEmpty($adminToken);
        $this->assertNotEmpty($clienteToken);

        // Arquivos físicos persistentes criados no disco
        $this->assertFileExists(DemoSandboxService::sqliteFilePath($sid));
        $this->assertFileExists(DemoSandboxService::templateFilePath());

        // Somente as duas contas padrão existem na Demo (zero usuários reais do banco oficial)
        $emailsSessao = collect($initResp->json('usuarios'))->pluck('email')->all();
        $this->assertEqualsCanonicalizing([
            'admin@demo.salvsacra.com',
            'cliente@demo.salvsacra.com',
        ], $emailsSessao);

        // Cupons/vales iniciais presentes
        $codigosCupons = collect($initResp->json('cupons_ativos'))->pluck('codigo')->all();
        $this->assertContains('PROMO10', $codigosCupons);
        $this->assertContains('FRETEGRATIS', $codigosCupons);
        $this->assertContains('VALE50', $codigosCupons);

        // Blindagem total de configurações sensíveis (admin e vitrine pública)
        $cfgAdmin = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->getJson('/api/admin/configuracoes')->assertStatus(200);

        $cfgAdmin->assertJsonPath('nome_loja', 'Salv Sacra (Ambiente Demo)');
        $cfgAdmin->assertJsonPath('contato_email', 'contato@demo.salvsacra.com.br');
        $cfgAdmin->assertJsonPath('mercadopago_access_token', 'DEMO-MERCADOPAGO-SANDBOX-TOKEN');
        $cfgAdmin->assertJsonPath('mercadopago_public_key', 'DEMO-MERCADOPAGO-PUBLIC-KEY');
        $cfgAdmin->assertJsonPath('melhor_envio_token', 'DEMO-MELHOR-ENVIO-SANDBOX-TOKEN');
        $cfgAdmin->assertJsonPath('melhor_envio_sandbox_token', 'DEMO-MELHOR-ENVIO-SANDBOX-TOKEN');
        $cfgAdmin->assertJsonPath('cartao_gateway_modo', 'simulacao');

        // Garante que o token real do .env NUNCA vaza
        if (env('MERCADOPAGO_ACCESS_TOKEN')) {
            $this->assertNotEquals(env('MERCADOPAGO_ACCESS_TOKEN'), $cfgAdmin->json('mercadopago_access_token'));
        }
        if (env('MELHOR_ENVIO_TOKEN')) {
            $this->assertNotEquals(env('MELHOR_ENVIO_TOKEN'), $cfgAdmin->json('melhor_envio_token'));
        }

        // Endereço fictício inicial vinculado ao Cliente Demo em Tubarão/SC
        $enderecosResp = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson('/api/conta/enderecos')->assertStatus(200);

        $this->assertCount(1, $enderecosResp->json());
        $this->assertSame('Tubarão', $enderecosResp->json('0.cidade'));
        $this->assertSame('SC', $enderecosResp->json('0.estado'));
    }

    public function test_03_fluxo_completo_e_simulacoes_pix_boleto_cartao_frete_etiqueta_e_rastreio(): void
    {
        $produto = Produto::with('variacoes')->first();
        if (! $produto || $produto->variacoes->isEmpty()) {
            $this->markTestSkipped('Catálogo oficial sem produto/variação para teste de pedido Demo.');
        }
        $variacao = $produto->variacoes->first();

        $sid = $this->novoSessionId('fluxo');
        $init = $this->withHeaders(['X-Demo-Session' => $sid])->postJson('/api/demo/iniciar')->assertStatus(200);
        $clienteToken = $init->json('tokens.cliente');
        $adminToken = $init->json('tokens.admin');

        if ($variacao->estoque < 10) {
            $this->withHeaders([
                'X-Demo-Session' => $sid,
                'Authorization'  => "Bearer {$adminToken}",
            ])->patchJson("/api/admin/estoque/{$variacao->id}", ['estoque' => 20])->assertStatus(200);
        }

        // 1. Cadastro direto na Demo (sem reCAPTCHA externo, já ativado e com token)
        $regResp = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/register', [
                'name'                  => 'Avaliador TCC',
                'email'                 => 'avaliador@demo.test',
                'password'              => 'senha1234',
                'password_confirmation' => 'senha1234',
            ]);

        $regResp->assertStatus(201)
            ->assertJsonPath('demo_auto_verified', true)
            ->assertJsonPath('user.email', 'avaliador@demo.test');
        $this->assertNotEmpty($regResp->json('token'));

        // 2. Alternância de usuário via endpoint dedicado
        $switchCliente = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/demo/alternar-usuario', ['papel' => 'cliente'])
            ->assertStatus(200);
        $tokenClienteDemo = $switchCliente->json('token');

        $switchAdmin = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/demo/alternar-usuario', ['papel' => 'admin'])
            ->assertStatus(200);
        $tokenAdminDemo = $switchAdmin->json('token');

        // 3. Cotação de frete 100% simulada
        $freteResp = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/frete/calcular', [
                'cep'        => '01001-000',
                'subtotal'   => (float) $produto->preco,
                'quantidade' => 1,
            ])->assertStatus(200)
            ->assertJsonPath('fonte', 'demo_sandbox');

        $this->assertCount(3, $freteResp->json('opcoes'));
        $this->assertSame(['pac', 'sedex', 'jadlog'], collect($freteResp->json('opcoes'))->pluck('id')->all());

        // 4. Pedido PIX simulado -> QR SVG Base64 + simulação de aprovação
        $pixOrder = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$tokenClienteDemo}",
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'cliente@demo.salvsacra.com',
            'telefone'         => '(48) 99999-0000',
            'cpf'              => '52998224725',
            'cep'              => '88701-000',
            'logradouro'       => 'Av. Marcolino Martins Cabral',
            'numero'           => '100',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios SEDEX',
            'valor_frete'      => 12.47,
            'metodo_pagamento' => 'pix',
            'itens'            => [
                [
                    'produto_id'  => $produto->id,
                    'variacao_id' => $variacao->id,
                    'quantidade'  => 1,
                    'preco'       => (float) $produto->preco,
                ],
            ],
        ])->assertStatus(201);

        $pixId = $pixOrder->json('pedido.id');
        $this->assertSame('Pendente', $pixOrder->json('pedido.status'));
        $this->assertStringStartsWith('DEMO-PIX-', $pixOrder->json('pedido.pagamento_id'));
        $this->assertStringStartsWith('data:image/svg+xml;base64,', $pixOrder->json('pedido.pix_qr_code_base64'));

        // Simular pagamento PIX
        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson("/api/demo/pedidos/{$pixId}/simular-pagamento")
            ->assertStatus(200)
            ->assertJsonPath('pedido.status', 'Pago');

        // 5. Geração simulada de etiqueta Melhor Envio + rastreio simulado (Admin Demo)
        $etiquetaResp = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$tokenAdminDemo}",
        ])->postJson("/api/admin/pedidos/{$pixId}/melhor-envio/enviar")
            ->assertStatus(200)
            ->assertJsonPath('info.sucesso', true)
            ->assertJsonPath('info.demo_simulado', true);

        $this->assertStringStartsWith('DEMO-ME-', $etiquetaResp->json('info.melhor_envio_id'));
        $this->assertMatchesRegularExpression('/^SS\d{9}BR$/', $etiquetaResp->json('info.codigo_rastreio'));

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$tokenAdminDemo}",
        ])->postJson("/api/admin/pedidos/{$pixId}/rastreio/consultar")
            ->assertStatus(200)
            ->assertJsonPath('sucesso', true)
            ->assertJsonPath('info.demo_simulado', true);

        // 6. Pedido Cartão com cupom PROMO10 + vale VALE50 -> aprovação imediata
        $cardOrder = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson('/api/pedidos', [
            'email_contato'      => 'cliente@demo.salvsacra.com',
            'cep'                => '88701-000',
            'logradouro'         => 'Av. Marcolino Martins Cabral',
            'numero'             => '100',
            'bairro'             => 'Centro',
            'cidade'             => 'Tubarão',
            'estado'             => 'SC',
            'tipo_frete'         => 'Correios PAC',
            'valor_frete'        => 10.90,
            'metodo_pagamento'   => 'cartao_credito',
            'cupom_codigo'       => 'PROMO10',
            'vale_compra_codigo' => 'VALE50',
            'cartao_dados'       => [
                'tipo'     => 'credito',
                'titular'  => 'CLIENTE DEMO APRO',
                'numero'   => '4000123456789010',
                'validade' => '12/30',
                'cvv'      => '123',
                'parcelas' => 1,
            ],
            'itens' => [
                [
                    'produto_id'  => $produto->id,
                    'variacao_id' => $variacao->id,
                    'quantidade'  => 2,
                    'preco'       => max(40.00, (float) $produto->preco),
                ],
            ],
        ])->assertStatus(201);

        $this->assertSame('Pago', $cardOrder->json('pedido.status'));
        $this->assertGreaterThan(0, (float) $cardOrder->json('pedido.valor_desconto_produto'));
        $this->assertGreaterThan(0, (float) $cardOrder->json('pedido.valor_vale_compra'));
        $this->assertStringStartsWith('DEMO-CARD-', $cardOrder->json('pedido.pagamento_id'));

        // 7. Pedido Boleto simulado (novo usuário da Demo)
        $boletoOrder = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => 'Bearer ' . $regResp->json('token'),
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'avaliador@demo.test',
            'cep'              => '88701-000',
            'logradouro'       => 'Rua Teste Demo',
            'numero'           => '200',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios PAC',
            'valor_frete'      => 10.90,
            'metodo_pagamento' => 'boleto',
            'itens'            => [
                [
                    'produto_id'  => $produto->id,
                    'variacao_id' => $variacao->id,
                    'quantidade'  => 1,
                    'preco'       => (float) $produto->preco,
                ],
            ],
        ])->assertStatus(201);

        $this->assertSame('Pendente', $boletoOrder->json('pedido.status'));
        $this->assertStringStartsWith('DEMO-BOLETO-', $boletoOrder->json('pedido.pagamento_id'));
        $this->assertStringStartsWith('23793.38128', $boletoOrder->json('pedido.pix_copia_e_cola'));
    }

    public function test_04_isolamento_entre_sessoes_persistencia_reset_e_protecao_do_banco_oficial(): void
    {
        $produto = Produto::with('variacoes')->first();
        if (! $produto || $produto->variacoes->isEmpty()) {
            $this->markTestSkipped('Catálogo oficial sem produto/variação.');
        }
        $variacao = $produto->variacoes->first();

        // Snapshot exato do banco oficial BEFORE
        $usersAntes = User::withTrashed()->count();
        $pedidosAntes = Pedido::count();
        $produtosAntes = Produto::count();
        $usersSeqAntes = DB::selectOne('SELECT last_value, is_called FROM "public"."users_id_seq"');
        $pedidosSeqAntes = DB::selectOne('SELECT last_value, is_called FROM "public"."pedidos_id_seq"');

        $sidA = $this->novoSessionId('isoA');
        $sidB = $this->novoSessionId('isoB');

        $initA = $this->withHeaders(['X-Demo-Session' => $sidA])->postJson('/api/demo/iniciar')->assertStatus(200);
        $initB = $this->withHeaders(['X-Demo-Session' => $sidB])->postJson('/api/demo/iniciar')->assertStatus(200);
        $adminTokenA = $initA->json('tokens.admin');

        if ($variacao->estoque < 2) {
            $this->withHeaders([
                'X-Demo-Session' => $sidA,
                'Authorization'  => "Bearer {$adminTokenA}",
            ])->patchJson("/api/admin/estoque/{$variacao->id}", ['estoque' => 10])->assertStatus(200);
        }

        // Na Sessão A: cria usuário, cria pedido e exclui um produto
        $regA = $this->withHeaders(['X-Demo-Session' => $sidA])
            ->postJson('/api/auth/register', [
                'name'                  => 'Usuario Exclusivo A',
                'email'                 => 'exclusivo.a@demo.test',
                'password'              => 'senha1234',
                'password_confirmation' => 'senha1234',
            ])->assertStatus(201);

        $this->withHeaders([
            'X-Demo-Session' => $sidA,
            'Authorization'  => 'Bearer ' . $regA->json('token'),
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'exclusivo.a@demo.test',
            'cep'              => '88701-000',
            'logradouro'       => 'Rua Isolada A',
            'numero'           => '10',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios PAC',
            'valor_frete'      => 10.90,
            'metodo_pagamento' => 'pix',
            'itens'            => [
                [
                    'produto_id'  => $produto->id,
                    'variacao_id' => $variacao->id,
                    'quantidade'  => 1,
                    'preco'       => (float) $produto->preco,
                ],
            ],
        ])->assertStatus(201);

        $this->withHeaders([
            'X-Demo-Session' => $sidA,
            'Authorization'  => "Bearer {$adminTokenA}",
        ])->deleteJson("/api/produtos/{$produto->id}")->assertStatus(204);

        // Persistência: retomar Sessão A mantém tudo salvo (is_new === false)
        $reabrirA = $this->withHeaders(['X-Demo-Session' => $sidA])
            ->postJson('/api/demo/iniciar')
            ->assertStatus(200)
            ->assertJsonPath('is_new', false)
            ->assertJsonPath('total_pedidos', 1)
            ->assertJsonPath('total_produtos', $produtosAntes - 1);

        $this->assertContains('exclusivo.a@demo.test', collect($reabrirA->json('usuarios'))->pluck('email')->all());

        // Isolamento na Sessão B: ZERO contaminação da Sessão A
        $statusB = $this->withHeaders(['X-Demo-Session' => $sidB])
            ->getJson('/api/demo/status')
            ->assertStatus(200)
            ->assertJsonPath('total_pedidos', 0)
            ->assertJsonPath('total_produtos', $produtosAntes);

        $emailsB = collect($statusB->json('usuarios'))->pluck('email')->all();
        $this->assertNotContains('exclusivo.a@demo.test', $emailsB);

        // Isolamento no banco oficial (public): NADA alterado e sequences intactas!
        $this->assertSame($usersAntes, User::withTrashed()->count());
        $this->assertSame($pedidosAntes, Pedido::count());
        $this->assertSame($produtosAntes, Produto::count());
        $usersSeqDepois = DB::selectOne('SELECT last_value, is_called FROM "public"."users_id_seq"');
        $pedidosSeqDepois = DB::selectOne('SELECT last_value, is_called FROM "public"."pedidos_id_seq"');
        $this->assertEquals($usersSeqAntes, $usersSeqDepois);
        $this->assertEquals($pedidosSeqAntes, $pedidosSeqDepois);

        // Reset explícito da Sessão A restaura tudo do zero
        $resetA = $this->withHeaders(['X-Demo-Session' => $sidA])
            ->postJson('/api/demo/resetar')
            ->assertStatus(200)
            ->assertJsonPath('is_new', true)
            ->assertJsonPath('total_pedidos', 0)
            ->assertJsonPath('total_produtos', $produtosAntes);

        $this->assertNotContains('exclusivo.a@demo.test', collect($resetA->json('usuarios'))->pluck('email')->all());
    }

    public function test_05_limpeza_automatica_sessoes_abandonadas_ha_mais_de_7_dias(): void
    {
        $sidAntiga = $this->novoSessionId('old');
        $sidRecente = $this->novoSessionId('fresh');

        $this->withHeaders(['X-Demo-Session' => $sidAntiga])->postJson('/api/demo/iniciar')->assertStatus(200);
        $this->withHeaders(['X-Demo-Session' => $sidRecente])->postJson('/api/demo/iniciar')->assertStatus(200);

        $arquivoAntigo = DemoSandboxService::sqliteFilePath($sidAntiga);
        $arquivoRecente = DemoSandboxService::sqliteFilePath($sidRecente);

        $this->assertFileExists($arquivoAntigo);
        $this->assertFileExists($arquivoRecente);

        // Retrocede modificação para 8 dias atrás
        touch($arquivoAntigo, now()->subDays(8)->timestamp);

        $removidas = DemoSandboxService::cleanupAbandonedSessions(7);
        $this->assertGreaterThanOrEqual(1, $removidas);
        $this->assertFileDoesNotExist($arquivoAntigo);
        $this->assertFileExists($arquivoRecente);
    }
}
