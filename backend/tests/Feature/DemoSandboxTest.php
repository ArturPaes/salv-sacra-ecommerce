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
        Config::set('app.store_real_password', 'Artp2004');
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

        // Validação/reenvio de e-mail não é bloqueada pelo portão real (token único enviado apenas para quem já cadastrou na loja real)
        $verifResp = $this->withHeaders(['X-Enforce-Store-Gate' => '1'])
            ->postJson('/api/auth/verificar-email', [
                'email' => 'pendente@salvsacra.test',
                'token' => 'token-inexistente-teste',
            ]);
        $this->assertNotEquals(403, $verifResp->getStatusCode());

        // Senha incorreta (incluindo versão antiga sem maiúscula) -> 403
        $this->postJson('/api/demo/validar-acesso-real', ['senha' => 'artp2004'])
            ->assertStatus(403)
            ->assertJsonPath('valid', false);

        // Senha correta (Artp2004) -> libera token
        $gateResp = $this->postJson('/api/demo/validar-acesso-real', ['senha' => 'Artp2004'])
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
                'password'              => 'Senha1234',
                'password_confirmation' => 'Senha1234',
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

        $this->assertCount(1, $freteResp->json('opcoes'));
        $this->assertSame(['sedex'], collect($freteResp->json('opcoes'))->pluck('id')->all());

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
                'password'              => 'Senha1234',
                'password_confirmation' => 'Senha1234',
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

    public function test_06_multiplas_avaliacoes_por_produto_edicao_e_exclusao_ultimo_cliente(): void
    {
        $produto = Produto::with('variacoes')->first();
        if (! $produto || $produto->variacoes->isEmpty()) {
            $this->markTestSkipped('Catálogo oficial sem produto/variação.');
        }
        $variacao = $produto->variacoes->first();

        $sid = $this->novoSessionId('reviews');
        $init = $this->withHeaders(['X-Demo-Session' => $sid])->postJson('/api/demo/iniciar')->assertStatus(200);
        $clienteToken = $init->json('tokens.cliente');
        $clienteId = (int) $init->json('contas_padrao.cliente.id');
        $adminToken = $init->json('tokens.admin');

        // 1. Compra + Entrega + Múltiplas avaliações para o mesmo produto pelo mesmo cliente + Edição + Exclusão individual
        if ($variacao->estoque < 2) {
            $this->withHeaders([
                'X-Demo-Session' => $sid,
                'Authorization'  => "Bearer {$adminToken}",
            ])->patchJson("/api/admin/estoque/{$variacao->id}", ['estoque' => 5])->assertStatus(200);
        }

        $ped = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'cliente.demo@salvsacra.test',
            'cep'              => '88701-000',
            'logradouro'       => 'Rua Teste Demo',
            'numero'           => '123',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios SEDEX',
            'valor_frete'      => 15.00,
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

        $pedidoId = $ped->json('pedido.id');
        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->patchJson("/api/admin/pedidos/{$pedidoId}/status", ['status' => 'Entregue'])
            ->assertStatus(200);

        // Primeira avaliação
        $av1 = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson("/api/produtos/{$produto->id}/avaliacoes", [
            'nota'       => 5,
            'comentario' => 'Primeira avaliação excelente!',
        ])->assertStatus(201);
        $av1Id = $av1->json('avaliacao.id');

        // Segunda avaliação do mesmo cliente no mesmo produto (não substitui a primeira!)
        $av2 = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson("/api/produtos/{$produto->id}/avaliacoes", [
            'nota'       => 4,
            'comentario' => 'Segunda avaliação após algumas lavagens.',
        ])->assertStatus(201);
        $av2Id = $av2->json('avaliacao.id');

        $this->assertNotSame($av1Id, $av2Id);

        $minhas = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson('/api/conta/avaliacoes')->assertStatus(200);
        $this->assertCount(2, $minhas->json());

        // Edição da segunda avaliação via PUT
        $edit2 = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->putJson("/api/avaliacoes/{$av2Id}", [
            'nota'       => 5,
            'comentario' => 'Segunda avaliação editada com 5 estrelas.',
        ])->assertStatus(200);
        $this->assertSame(5, $edit2->json('avaliacao.nota'));
        $this->assertSame('Segunda avaliação editada com 5 estrelas.', $edit2->json('avaliacao.comentario'));

        // Excluir apenas a primeira avaliação preserva a segunda
        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->deleteJson("/api/avaliacoes/{$av1Id}")->assertStatus(200);

        $minhasDepois = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson('/api/conta/avaliacoes')->assertStatus(200);
        $this->assertCount(1, $minhasDepois->json());
        $this->assertSame($av2Id, $minhasDepois->json('0.id'));

        // 2. Exclusão de cliente extra e do último cliente restante pelo administrador (sem bloqueio)
        $reg2 = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/register', [
                'name'                  => 'Cliente Extra Demo',
                'email'                 => 'extra.demo@test.com',
                'password'              => 'Senha1234',
                'password_confirmation' => 'Senha1234',
            ])->assertStatus(201);
        $cliente2Id = (int) $reg2->json('user.id');

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->deleteJson("/api/admin/clientes/{$cliente2Id}")
            ->assertStatus(200);

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->deleteJson("/api/admin/clientes/{$clienteId}")
            ->assertStatus(422);

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->deleteJson('/api/conta/excluir')
            ->assertStatus(422);
    }

    public function test_07_politica_de_senha_forte_e_bloqueio_login_senha_antiga_fraca(): void
    {
        $sid = $this->novoSessionId('pwdpolicy');
        $this->withHeaders(['X-Demo-Session' => $sid])->postJson('/api/demo/iniciar')->assertStatus(200);

        // 1. Cadastro rejeita senhas que não atendam aos 4 requisitos
        foreach (['Abc123', 'semmaiuscula1', 'SEMMINUSCULA1', 'SemNumeroAqui'] as $senhaFraca) {
            $this->withHeaders(['X-Demo-Session' => $sid])
                ->postJson('/api/auth/register', [
                    'name'                  => 'Teste Fraco',
                    'email'                 => 'fraco@demo.test',
                    'password'              => $senhaFraca,
                    'password_confirmation' => $senhaFraca,
                ])->assertStatus(422)->assertJsonValidationErrors(['password']);
        }

        // 2. Cadastro aceita senha forte (mín 8, maiúscula, minúscula e número)
        $regOk = $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/register', [
                'name'                  => 'Teste Forte',
                'email'                 => 'forte@demo.test',
                'password'              => 'Artp2004',
                'password_confirmation' => 'Artp2004',
            ])->assertStatus(201);
        $tokenForte = $regOk->json('token');

        // 3. Alteração de senha rejeita senha fraca e aceita senha forte
        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$tokenForte}",
        ])->putJson('/api/conta/senha', [
            'senha_atual'           => 'Artp2004',
            'password'              => 'fraca123',
            'password_confirmation' => 'fraca123',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$tokenForte}",
        ])->putJson('/api/conta/senha', [
            'senha_atual'           => 'Artp2004',
            'password'              => 'NovaSenha2026',
            'password_confirmation' => 'NovaSenha2026',
        ])->assertStatus(200);

        // 4. Usuário criado anteriormente com senha antiga fraca é mantido na sessão Demo, mas bloqueado no login
        DemoSandboxService::activateSession($sid);
        try {
            User::create([
                'name'              => 'Cliente Legado',
                'email'             => 'legado@demo.test',
                'password'          => 'antiga123',
                'papel'             => 'cliente',
                'email_verified_at' => now(),
            ]);
        } finally {
            DemoSandboxService::restoreDefaultConnection('pgsql');
        }

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/login', [
                'email'    => 'legado@demo.test',
                'password' => 'antiga123',
            ])->assertStatus(422)->assertJsonValidationErrors(['email']);

        // 5. Após redefinir senha com token seguindo os requisitos, o login volta a funcionar
        $resetToken = Str::random(64);
        DemoSandboxService::activateSession($sid);
        try {
            DB::table('password_reset_tokens')->insert([
                'email'      => 'legado@demo.test',
                'token'      => \Illuminate\Support\Facades\Hash::make($resetToken),
                'created_at' => now(),
            ]);
        } finally {
            DemoSandboxService::restoreDefaultConnection('pgsql');
        }

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/redefinir-senha', [
                'email'                 => 'legado@demo.test',
                'token'                 => $resetToken,
                'password'              => 'semnumero',
                'password_confirmation' => 'semnumero',
            ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/redefinir-senha', [
                'email'                 => 'legado@demo.test',
                'token'                 => $resetToken,
                'password'              => 'Artp2004',
                'password_confirmation' => 'Artp2004',
            ])->assertStatus(200);

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/auth/login', [
                'email'    => 'legado@demo.test',
                'password' => 'Artp2004',
            ])->assertStatus(200);
    }

    public function test_08_webhook_e_atualizacao_enviado_preenchem_rastreio_e_notificam_cliente(): void
    {
        $produto = Produto::with('variacoes')->first();
        if (! $produto || $produto->variacoes->isEmpty()) {
            $this->markTestSkipped('Catálogo oficial sem produto/variação.');
        }
        $variacao = $produto->variacoes->first();

        $sid = $this->novoSessionId('webhookenvio');
        $init = $this->withHeaders(['X-Demo-Session' => $sid])->postJson('/api/demo/iniciar')->assertStatus(200);
        $clienteToken = $init->json('tokens.cliente');
        $adminToken = $init->json('tokens.admin');

        if ($variacao->estoque < 2) {
            $this->withHeaders([
                'X-Demo-Session' => $sid,
                'Authorization'  => "Bearer {$adminToken}",
            ])->patchJson("/api/admin/estoque/{$variacao->id}", ['estoque' => 5])->assertStatus(200);
        }

        $ped = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'cliente.demo@salvsacra.test',
            'cep'              => '88701-000',
            'logradouro'       => 'Rua Teste Rastreio',
            'numero'           => '50',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios SEDEX',
            'valor_frete'      => 15.00,
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

        $pedidoId = $ped->json('pedido.id');

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->patchJson("/api/admin/pedidos/{$pedidoId}/status", ['status' => 'Em separação'])
            ->assertStatus(200);

        // Simula ambiente de produção real para validar transição automática posted -> Enviado
        DemoSandboxService::activateSession($sid);
        try {
            \App\Models\Configuracao::updateOrCreate(
                ['chave' => 'melhor_envio_ambiente'],
                ['valor' => 'production', 'grupo' => 'frete']
            );
        } finally {
            DemoSandboxService::restoreDefaultConnection('pgsql');
        }

        // Simula webhook de postagem do Melhor Envio com tracking e status "posted"
        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/webhooks/melhor-envio', [
                'order_id'  => 'DEMO-ME-ORDER-999',
                'custom_id' => $pedidoId,
                'tracking'  => 'NL987654321BR',
                'status'    => 'posted',
            ])->assertStatus(200);

        $pedidoResp = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson("/api/pedidos/{$pedidoId}")->assertStatus(200);

        $this->assertSame('Enviado', $pedidoResp->json('status'));
        $this->assertSame('NL987654321BR', $pedidoResp->json('codigo_rastreio'));

        $notifs = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson('/api/notificacoes')->assertStatus(200);

        $mensagens = collect($notifs->json('notificacoes') ?? $notifs->json())->pluck('mensagem')->implode(' ');
        $this->assertStringContainsString('NL987654321BR', $mensagens);
    }

    public function test_09_automacao_logistica_reversa_e_separacao_sandbox_enviado(): void
    {
        $produto = Produto::with('variacoes')->first();
        if (! $produto || $produto->variacoes->isEmpty()) {
            $this->markTestSkipped('Catálogo oficial sem produto/variação.');
        }
        $variacao = $produto->variacoes->first();

        $sid = $this->novoSessionId('reversa');
        $init = $this->withHeaders(['X-Demo-Session' => $sid])->postJson('/api/demo/iniciar')->assertStatus(200);
        $clienteToken = $init->json('tokens.cliente');
        $adminToken = $init->json('tokens.admin');

        if ($variacao->estoque < 2) {
            $this->withHeaders([
                'X-Demo-Session' => $sid,
                'Authorization'  => "Bearer {$adminToken}",
            ])->patchJson("/api/admin/estoque/{$variacao->id}", ['estoque' => 5])->assertStatus(200);
        }

        // 1. Cria pedido, marca como Entregue e solicita devolução
        $ped = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'cliente.demo@salvsacra.test',
            'cep'              => '88701-000',
            'logradouro'       => 'Rua Logistica Reversa',
            'numero'           => '88',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios SEDEX',
            'valor_frete'      => 15.00,
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

        $pedidoId = $ped->json('pedido.id');

        // Em Sandbox, webhook 'posted' preenche codigo_rastreio sem mudar para 'Enviado' automaticamente
        DemoSandboxService::activateSession($sid);
        try {
            \App\Models\Configuracao::updateOrCreate(
                ['chave' => 'melhor_envio_ambiente'],
                ['valor' => 'sandbox', 'grupo' => 'frete']
            );
        } finally {
            DemoSandboxService::restoreDefaultConnection('pgsql');
        }

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->patchJson("/api/admin/pedidos/{$pedidoId}/status", ['status' => 'Em separação'])
            ->assertStatus(200);

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/webhooks/melhor-envio', [
                'custom_id' => $pedidoId,
                'tracking'  => 'SB123456789BR',
                'status'    => 'released',
            ])->assertStatus(200);

        $pedSandbox = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson("/api/pedidos/{$pedidoId}")->assertStatus(200);

        $this->assertSame('SB123456789BR', $pedSandbox->json('codigo_rastreio'));
        $this->assertSame('Em separação', $pedSandbox->json('status'));

        // Transições automáticas de Em transporte e Entregue continuam ativas no Sandbox
        // (inclusive quando o simulador do Sandbox envia 'posted' ou 'in_transit');
        // como pulou Enviado direto para Em transporte, deve registrar cronologicamente Enviado e depois Em transporte
        \Illuminate\Support\Facades\Mail::fake();

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/webhooks/melhor-envio', [
                'custom_id' => $pedidoId,
                'status'    => 'posted',
            ])->assertStatus(200);

        $pedTransito = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson("/api/pedidos/{$pedidoId}")->assertStatus(200);
        $this->assertSame('Em transporte', $pedTransito->json('status'));

        $notifs = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson('/api/notificacoes')->assertStatus(200);

        $listaNotifs = collect($notifs->json('notificacoes'));
        $notifEnviado = $listaNotifs->first(fn ($n) => str_contains((string) ($n['titulo'] ?? ''), 'Postado nos Correios'));
        $notifTransito = $listaNotifs->first(fn ($n) => str_contains((string) ($n['titulo'] ?? ''), 'Em Transporte'));
        $this->assertNotNull($notifEnviado);
        $this->assertNotNull($notifTransito);
        $this->assertLessThan($notifTransito['id'], $notifEnviado['id']);
        $this->assertStringContainsString('SB123456789BR', $notifEnviado['mensagem']);

        $this->withHeaders(['X-Demo-Session' => $sid])
            ->postJson('/api/webhooks/melhor-envio', [
                'custom_id' => $pedidoId,
                'status'    => 'delivered',
            ])->assertStatus(200);

        $pedEntregue = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson("/api/pedidos/{$pedidoId}")->assertStatus(200);
        $this->assertSame('Entregue', $pedEntregue->json('status'));

        // Também ao trocar manualmente direto de Em separação -> Em transporte no painel Admin
        $pedManual = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->postJson('/api/pedidos', [
            'email_contato'    => 'cliente.demo@salvsacra.test',
            'cep'              => '88701-000',
            'logradouro'       => 'Rua Teste Manual',
            'numero'           => '10',
            'bairro'           => 'Centro',
            'cidade'           => 'Tubarão',
            'estado'           => 'SC',
            'tipo_frete'       => 'Correios SEDEX',
            'valor_frete'      => 15.00,
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
        $pedManualId = $pedManual->json('pedido.id');

        $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$adminToken}",
        ])->patchJson("/api/admin/pedidos/{$pedManualId}/status", [
            'status'          => 'Em transporte',
            'codigo_rastreio' => 'MN111222333BR',
        ])->assertStatus(200);

        $notifs2 = $this->withHeaders([
            'X-Demo-Session' => $sid,
            'Authorization'  => "Bearer {$clienteToken}",
        ])->getJson('/api/notificacoes')->assertStatus(200);

        $lista2 = collect($notifs2->json('notificacoes'))->where('referencia_id', $pedManualId);
        $env2 = $lista2->first(fn ($n) => str_contains((string) ($n['titulo'] ?? ''), 'Postado nos Correios'));
        $tr2 = $lista2->first(fn ($n) => str_contains((string) ($n['titulo'] ?? ''), "Pedido #{$pedManualId}: Em transporte"));
        $this->assertNotNull($env2);
        $this->assertNotNull($tr2);
        $this->assertLessThan($tr2['id'], $env2['id']);
        $this->assertStringContainsString('MN111222333BR', $env2['mensagem']);
    }
}
