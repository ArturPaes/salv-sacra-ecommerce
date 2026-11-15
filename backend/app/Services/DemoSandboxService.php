<?php

namespace App\Services;

use App\Models\Cupom;
use App\Models\Endereco;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class DemoSandboxService
{
    /**
     * Tabelas públicas do catálogo copiadas do banco oficial para cada sessão Demo.
     */
    public const CATALOG_TABLES = [
        'categorias',
        'devocaos',
        'colecoes',
        'modelos_camiseta',
        'produtos',
        'variacaos',
    ];

    /**
     * Únicas chaves visuais/layout de `configuracoes` aproveitadas do banco oficial (nunca tokens ou dados pessoais).
     */
    public const SAFE_VISUAL_CONFIG_KEYS = [
        'carrossel_slides',
        'slogan_loja',
        'aviso_topo_texto',
        'aviso_topo_ativo',
        'instagram_url',
        'cartao_parcelas_max',
        'cartao_parcela_minima',
        'pix_desconto_pct',
        'frete_gratis_minimo',
    ];

    protected static ?string $currentSessionId = null;
    protected static ?bool $activatedAsNewInRequest = null;
    protected static ?string $originalDefaultConnection = null;

    /**
     * Indica se a requisição atual está rodando dentro de uma sessão Demo isolada.
     */
    public static function isDemo(): bool
    {
        return self::$currentSessionId !== null;
    }

    /**
     * Retorna o ID da sessão Demo ativa na requisição atual.
     */
    public static function currentSessionId(): ?string
    {
        return self::$currentSessionId;
    }

    /**
     * Valida o formato seguro do identificador de sessão (alfanumérico, underline ou hífen).
     */
    public static function validateSessionId(?string $sessionId): ?string
    {
        if (! is_string($sessionId)) {
            return null;
        }

        $trimmed = trim($sessionId);
        if (! preg_match('/^[a-zA-Z0-9_-]{8,128}$/', $trimmed)) {
            return null;
        }

        return $trimmed;
    }

    /**
     * Indica se o runtime está configurado e apto a utilizar SQLite nativo diretamente para cada sessão.
     */
    public static function usesSqliteDriver(): bool
    {
        return extension_loaded('pdo_sqlite')
            && strtolower((string) env('DEMO_SANDBOX_DRIVER', '')) === 'sqlite';
    }

    public static function directoryPath(): string
    {
        return storage_path('app' . DIRECTORY_SEPARATOR . 'demos');
    }

    public static function sqliteFilePath(string $sessionId): string
    {
        return self::directoryPath() . DIRECTORY_SEPARATOR . "demo_{$sessionId}.sqlite";
    }

    public static function templateFilePath(): string
    {
        return self::directoryPath() . DIRECTORY_SEPARATOR . 'template_base.sqlite';
    }

    /**
     * Nome determinístico e seguro do schema PostgreSQL isolado da sessão.
     */
    public static function schemaName(string $sessionId): string
    {
        $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]/', '', $sessionId));
        $prefix = substr($slug ?: 'session', 0, 24);
        $hash = substr(md5($sessionId), 0, 10);

        return "demo_{$prefix}_{$hash}";
    }

    /**
     * Nome da conexão oficial principal do banco (nunca 'demo_session').
     */
    public static function getOfficialConnectionName(): string
    {
        if (self::$originalDefaultConnection && self::$originalDefaultConnection !== 'demo_session') {
            return self::$originalDefaultConnection;
        }

        $current = Config::get('database.default', 'pgsql');

        return $current === 'demo_session' ? 'pgsql' : $current;
    }

    /**
     * Retorna valores sanitizados obrigatórios de configurações para o Ambiente Demo.
     */
    public static function getDemoConfigOverrides(): array
    {
        return [
            'nome_loja'                  => ['valor' => 'Salv Sacra (Ambiente Demo)', 'grupo' => 'loja', 'descricao' => 'Nome exibido no modo Demo'],
            'contato_email'              => ['valor' => 'contato@demo.salvsacra.com.br', 'grupo' => 'contato', 'descricao' => 'E-mail fictício de demonstração'],
            'contato_telefone'           => ['valor' => '(48) 99999-0000', 'grupo' => 'contato', 'descricao' => 'Telefone fictício de demonstração'],
            'contato_whatsapp'           => ['valor' => '5548999990000', 'grupo' => 'contato', 'descricao' => 'WhatsApp fictício de demonstração'],
            'contato_endereco'           => ['valor' => 'Tubarão/SC - Endereço Fictício de Demonstração (CEP 88701-000)', 'grupo' => 'contato', 'descricao' => 'Endereço fictício de demonstração'],
            'cpf_cnpj'                   => ['valor' => '00.000.000/0001-00', 'grupo' => 'loja', 'descricao' => 'CNPJ fictício de demonstração'],
            'cep_origem'                 => ['valor' => '88701-000', 'grupo' => 'frete', 'descricao' => 'CEP de origem fictício Demo'],
            'pix_chave'                  => ['valor' => 'contato@demo.salvsacra.com.br', 'grupo' => 'pagamento', 'descricao' => 'Chave PIX fictícia de demonstração'],
            'pix_beneficiario'           => ['valor' => 'SALV SACRA DEMO', 'grupo' => 'pagamento', 'descricao' => 'Beneficiário PIX Demo'],
            'pix_cidade'                 => ['valor' => 'TUBARAO', 'grupo' => 'pagamento', 'descricao' => 'Cidade PIX Demo'],
            'mercadopago_access_token'   => ['valor' => 'DEMO-MERCADOPAGO-SANDBOX-TOKEN', 'grupo' => 'pagamento', 'descricao' => 'Token simulado Mercado Pago'],
            'mercadopago_public_key'     => ['valor' => 'DEMO-MERCADOPAGO-PUBLIC-KEY', 'grupo' => 'pagamento', 'descricao' => 'Chave pública simulada Mercado Pago'],
            'melhor_envio_token'         => ['valor' => 'DEMO-MELHOR-ENVIO-SANDBOX-TOKEN', 'grupo' => 'frete', 'descricao' => 'Token simulado Melhor Envio'],
            'melhor_envio_sandbox_token' => ['valor' => 'DEMO-MELHOR-ENVIO-SANDBOX-TOKEN', 'grupo' => 'frete', 'descricao' => 'Token sandbox simulado Melhor Envio'],
            'melhor_envio_ambiente'      => ['valor' => 'sandbox', 'grupo' => 'frete', 'descricao' => 'Ambiente simulado de frete'],
            'cartao_gateway_modo'        => ['valor' => 'simulacao', 'grupo' => 'pagamento', 'descricao' => 'Modo simulado no ambiente Demo'],
        ];
    }

    /**
     * Ativa ou provisiona o sandbox persistente para a sessão informada.
     */
    public static function activateSession(string $sessionId, bool $forceReset = false): array
    {
        if (self::$originalDefaultConnection === null) {
            $default = Config::get('database.default', 'pgsql');
            self::$originalDefaultConnection = $default === 'demo_session' ? 'pgsql' : $default;
        }

        if (! $forceReset && self::$currentSessionId === $sessionId && self::$activatedAsNewInRequest !== null) {
            return [
                'session_id' => $sessionId,
                'is_new'     => self::$activatedAsNewInRequest,
                'driver'     => self::usesSqliteDriver() ? 'sqlite' : 'pgsql_schema',
                'arquivo'    => self::sqliteFilePath($sessionId),
            ];
        }

        self::ensureDirectories();
        self::cleanupAbandonedSessions();

        $sqlitePath = self::sqliteFilePath($sessionId);
        $alreadyExists = ! $forceReset && self::sessionExists($sessionId);

        if ($alreadyExists) {
            self::configureSessionConnection($sessionId);
            @touch($sqlitePath);
            self::$currentSessionId = $sessionId;
            self::$activatedAsNewInRequest = false;
            Auth::forgetGuards();

            return [
                'session_id' => $sessionId,
                'is_new'     => false,
                'driver'     => self::usesSqliteDriver() ? 'sqlite' : 'pgsql_schema',
                'arquivo'    => $sqlitePath,
            ];
        }

        self::provisionSessionDatabase($sessionId);
        self::$currentSessionId = $sessionId;
        self::$activatedAsNewInRequest = true;
        Auth::forgetGuards();

        return [
            'session_id' => $sessionId,
            'is_new'     => true,
            'driver'     => self::usesSqliteDriver() ? 'sqlite' : 'pgsql_schema',
            'arquivo'    => $sqlitePath,
        ];
    }

    /**
     * Restaura a conexão padrão original após o término do processamento da requisição.
     */
    public static function restoreDefaultConnection(?string $previousConnection = null): void
    {
        $wasDemo = self::$currentSessionId !== null || Config::get('database.default') === 'demo_session';
        self::$currentSessionId = null;
        self::$activatedAsNewInRequest = null;

        if (! $wasDemo) {
            return;
        }

        $target = $previousConnection ?: self::getOfficialConnectionName();
        if ($target === 'demo_session') {
            $target = 'pgsql';
        }

        Config::set('database.default', $target);
        DB::setDefaultConnection($target);
        Auth::forgetGuards();
    }

    /**
     * Limpa estado em memória (para requisições fora do modo Demo).
     */
    public static function clearDemoState(): void
    {
        self::restoreDefaultConnection();
    }

    /**
     * Remove uma sessão Demo específica (disco + schema isolado).
     */
    public static function destroySession(string $sessionId): void
    {
        $schemaName = self::schemaName($sessionId);
        $officialConn = self::getOfficialConnectionName();

        try {
            $connConfig = Config::get("database.connections.{$officialConn}");
            if (($connConfig['driver'] ?? '') === 'pgsql') {
                DB::connection($officialConn)->statement("DROP SCHEMA IF EXISTS \"{$schemaName}\" CASCADE");
            }
        } catch (\Throwable) {
            // Silencioso caso schema não exista
        }

        $sqlitePath = self::sqliteFilePath($sessionId);
        if (File::exists($sqlitePath)) {
            @unlink($sqlitePath);
        }

        if (self::$currentSessionId === $sessionId) {
            self::restoreDefaultConnection();
        }
    }

    /**
     * Verifica a senha de acesso ao site oficial (STORE_REAL_PASSWORD).
     */
    public static function verifyRealPassword(string $password): bool
    {
        $expected = (string) Config::get('app.store_real_password', 'artp2004');
        return $expected !== '' && hash_equals($expected, trim($password));
    }

    /**
     * Gera o token HMAC de acesso autorizado ao site oficial.
     */
    public static function generateStoreAccessToken(): string
    {
        $expected = (string) Config::get('app.store_real_password', 'artp2004');
        $key = (string) Config::get('app.key', 'salv-sacra-fallback-key');

        return hash_hmac('sha256', 'salv-sacra-real-store-gate|' . $expected, $key);
    }

    /**
     * Valida o token recebido no header X-Store-Access-Token.
     */
    public static function validateStoreAccessToken(?string $token): bool
    {
        if (! is_string($token) || trim($token) === '') {
            return false;
        }

        return hash_equals(self::generateStoreAccessToken(), trim($token));
    }

    /**
     * Verifica se a sessão já está persistida e pronta para reutilização.
     */
    protected static function sessionExists(string $sessionId): bool
    {
        $sqlitePath = self::sqliteFilePath($sessionId);
        if (! File::exists($sqlitePath) || filesize($sqlitePath) === 0) {
            return false;
        }

        if (self::usesSqliteDriver()) {
            return true;
        }

        $schemaName = self::schemaName($sessionId);
        $officialConn = self::getOfficialConnectionName();
        $exists = DB::connection($officialConn)->selectOne(
            "SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users' LIMIT 1",
            [$schemaName]
        );

        return $exists !== null;
    }

    /**
     * Configura dinamicamente a conexão Laravel 'demo_session' para a sessão informada.
     */
    protected static function configureSessionConnection(string $sessionId): void
    {
        $officialConn = self::getOfficialConnectionName();

        if (self::usesSqliteDriver()) {
            Config::set('database.connections.demo_session', [
                'driver'                  => 'sqlite',
                'database'                => self::sqliteFilePath($sessionId),
                'prefix'                  => '',
                'foreign_key_constraints' => true,
            ]);
        } else {
            $base = Config::get("database.connections.{$officialConn}", Config::get('database.connections.pgsql'));
            $schemaName = self::schemaName($sessionId);
            Config::set('database.connections.demo_session', array_merge($base, [
                'search_path' => "\"{$schemaName}\"",
            ]));
        }

        Config::set('database.default', 'demo_session');
        DB::purge('demo_session');
        DB::setDefaultConnection('demo_session');

        // Em SQLite, registra função escalar case-insensitive compatível se queries usarem helpers compatíveis
        if (self::usesSqliteDriver()) {
            $pdo = DB::connection('demo_session')->getPdo();
            if (method_exists($pdo, 'sqliteCreateFunction')) {
                $pdo->sqliteCreateFunction('lower_unaccent', fn ($v) => mb_strtolower((string) $v, 'UTF-8'), 1);
            }
        }
    }

    /**
     * Cria ou recria o ambiente completo da sessão Demo e popula catálogo sanitizado + contas Demo.
     */
    protected static function provisionSessionDatabase(string $sessionId): void
    {
        self::ensureTemplateFile();

        if (self::usesSqliteDriver()) {
            self::provisionSqliteSession($sessionId);
        } else {
            self::provisionPostgresSchemaSession($sessionId);
        }

        self::configureSessionConnection($sessionId);
        self::copyCatalogFromOfficialDatabase();
        self::seedSanitizedConfigurations();
        self::seedDemoUsersAndBenefits();

        if (! self::usesSqliteDriver()) {
            self::writeSessionMarkerFile($sessionId);
        }
    }

    /**
     * Cria schema isolado no PostgreSQL espelhando as tabelas do banco oficial sem tocar em `public`.
     */
    protected static function provisionPostgresSchemaSession(string $sessionId): void
    {
        $officialConn = self::getOfficialConnectionName();
        $officialDb = DB::connection($officialConn);
        $schemaName = self::schemaName($sessionId);

        $officialDb->statement("DROP SCHEMA IF EXISTS \"{$schemaName}\" CASCADE");
        $officialDb->statement("CREATE SCHEMA \"{$schemaName}\"");

        $tables = $officialDb->select(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        );

        foreach ($tables as $row) {
            $tbl = $row->tablename;
            $officialDb->statement("CREATE TABLE \"{$schemaName}\".\"{$tbl}\" (LIKE \"public\".\"{$tbl}\" INCLUDING ALL)");

            $serialCols = $officialDb->select("
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND column_default LIKE 'nextval(%'
            ", [$tbl]);

            foreach ($serialCols as $colRow) {
                $col = $colRow->column_name;
                $seq = "{$tbl}_{$col}_seq";
                $officialDb->statement("CREATE SEQUENCE IF NOT EXISTS \"{$schemaName}\".\"{$seq}\"");
                $officialDb->statement(
                    "ALTER TABLE \"{$schemaName}\".\"{$tbl}\" ALTER COLUMN \"{$col}\" SET DEFAULT nextval('\"{$schemaName}\".\"{$seq}\"'::regclass)"
                );
                $officialDb->statement(
                    "ALTER SEQUENCE \"{$schemaName}\".\"{$seq}\" OWNED BY \"{$schemaName}\".\"{$tbl}\".\"{$col}\""
                );
            }
        }
    }

    /**
     * Cria arquivo SQLite dedicado a partir de `template_base.sqlite` quando SQLite nativo está habilitado.
     */
    protected static function provisionSqliteSession(string $sessionId): void
    {
        $dest = self::sqliteFilePath($sessionId);
        if (File::exists($dest)) {
            @unlink($dest);
        }
        File::copy(self::templateFilePath(), $dest);
    }

    /**
     * Copia EXCLUSIVAMENTE as tabelas públicas do catálogo do banco oficial para a sessão Demo.
     * Nunca copia users, pedidos, cartões, endereços, devoluções ou configurações sensíveis.
     */
    protected static function copyCatalogFromOfficialDatabase(): void
    {
        $officialConn = self::getOfficialConnectionName();
        $officialDb = DB::connection($officialConn);
        $demoDb = DB::connection('demo_session');

        if (! self::usesSqliteDriver()) {
            $schemaName = self::schemaNameFromCurrentConnection();
            foreach (self::CATALOG_TABLES as $tbl) {
                if (! Schema::connection($officialConn)->hasTable($tbl)) {
                    continue;
                }
                $officialDb->statement("INSERT INTO \"{$schemaName}\".\"{$tbl}\" SELECT * FROM \"public\".\"{$tbl}\"");
                $hasIdSeq = $officialDb->selectOne(
                    "SELECT 1 AS ok FROM information_schema.sequences WHERE sequence_schema = ? AND sequence_name = ?",
                    [$schemaName, "{$tbl}_id_seq"]
                );
                if ($hasIdSeq) {
                    $officialDb->statement(
                        "SELECT setval('\"{$schemaName}\".\"{$tbl}_id_seq\"', COALESCE((SELECT MAX(id) FROM \"{$schemaName}\".\"{$tbl}\"), 0) + 1, false)"
                    );
                }
            }
            return;
        }

        // Modo SQLite nativo: copia registro a registro das tabelas de catálogo
        foreach (self::CATALOG_TABLES as $tbl) {
            if (! Schema::connection($officialConn)->hasTable($tbl) || ! Schema::connection('demo_session')->hasTable($tbl)) {
                continue;
            }
            $rows = $officialDb->table($tbl)->get()->map(fn ($r) => (array) $r)->all();
            foreach (array_chunk($rows, 100) as $chunk) {
                $demoDb->table($tbl)->insert($chunk);
            }
        }
    }

    /**
     * Popula configurações com blindagem total: somente chaves visuais seguras do catálogo + credenciais/contatos Demo fictícios.
     */
    protected static function seedSanitizedConfigurations(): void
    {
        $officialConn = self::getOfficialConnectionName();
        $officialDb = DB::connection($officialConn);
        $demoDb = DB::connection('demo_session');

        // 1. Copia apenas configurações visuais seguras da vitrine
        if (Schema::connection($officialConn)->hasTable('configuracoes')) {
            $visuais = $officialDb->table('configuracoes')
                ->whereIn('chave', self::SAFE_VISUAL_CONFIG_KEYS)
                ->get();

            foreach ($visuais as $row) {
                $demoDb->table('configuracoes')->updateOrInsert(
                    ['chave' => $row->chave],
                    [
                        'valor'      => $row->valor,
                        'grupo'      => $row->grupo ?? 'loja',
                        'descricao'  => $row->descricao ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
            }
        }

        // Defaults visuais caso o banco oficial ainda não tenha algumas chaves
        $visuaisDefaults = [
            'slogan_loja'           => ['valor' => 'Vestindo a Fé com Elegância', 'grupo' => 'loja', 'descricao' => 'Slogan da loja'],
            'frete_gratis_minimo'   => ['valor' => '500.00', 'grupo' => 'frete', 'descricao' => 'Valor mínimo para frete grátis'],
            'aviso_topo_texto'      => ['valor' => '✦ AMBIENTE DEMO INTERATIVO — TESTE À VONTADE ✦', 'grupo' => 'frete', 'descricao' => 'Banner de topo'],
            'aviso_topo_ativo'      => ['valor' => '1', 'grupo' => 'frete', 'descricao' => 'Exibir banner de topo'],
            'pix_desconto_pct'      => ['valor' => '5', 'grupo' => 'pagamento', 'descricao' => 'Desconto percentual PIX'],
            'cartao_parcelas_max'   => ['valor' => '6', 'grupo' => 'pagamento', 'descricao' => 'Parcelas máximas'],
            'cartao_parcela_minima' => ['valor' => '20.00', 'grupo' => 'pagamento', 'descricao' => 'Valor mínimo por parcela'],
        ];

        foreach ($visuaisDefaults as $chave => $meta) {
            $existe = $demoDb->table('configuracoes')->where('chave', $chave)->exists();
            if (! $existe) {
                $demoDb->table('configuracoes')->insert([
                    'chave'      => $chave,
                    'valor'      => $meta['valor'],
                    'grupo'      => $meta['grupo'],
                    'descricao'  => $meta['descricao'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 2. Sobrescreve sempre todas as chaves sensíveis e institucionais com dados Demo fictícios
        foreach (self::getDemoConfigOverrides() as $chave => $meta) {
            $demoDb->table('configuracoes')->updateOrInsert(
                ['chave' => $chave],
                [
                    'valor'      => $meta['valor'],
                    'grupo'      => $meta['grupo'],
                    'descricao'  => $meta['descricao'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    /**
     * Cria exclusivamente dentro da sessão Demo: Admin, Cliente Principal (+ endereço fictício) e benefícios iniciais.
     */
    protected static function seedDemoUsersAndBenefits(): void
    {
        $adminDemo = User::create([
            'name'              => 'Administrador Demo',
            'email'             => 'admin@demo.salvsacra.com',
            'password'          => Hash::make('demo1234'),
            'papel'             => 'admin',
            'email_verified_at' => now(),
        ]);

        $clienteDemo = User::create([
            'name'              => 'Cliente Demo',
            'email'             => 'cliente@demo.salvsacra.com',
            'password'          => Hash::make('demo1234'),
            'papel'             => 'cliente',
            'cpf'               => '52998224725',
            'telefone'          => '(48) 99999-0000',
            'email_verified_at' => now(),
        ]);

        Endereco::create([
            'user_id'     => $clienteDemo->id,
            'cep'         => '88701-000',
            'logradouro'  => 'Av. Marcolino Martins Cabral',
            'numero'      => '100',
            'complemento' => 'Sala 01 (Demo)',
            'bairro'      => 'Centro',
            'cidade'      => 'Tubarão',
            'estado'      => 'SC',
        ]);

        Cupom::create([
            'codigo'               => 'PROMO10',
            'descricao'            => '10% de desconto nos produtos (Demo)',
            'percentual'           => 10,
            'tipo'                 => Cupom::TIPO_PRODUTO,
            'status'               => Cupom::STATUS_ATIVO,
            'todos_produtos'       => true,
            'ativo'                => true,
            'valor_minimo_pedido'  => 0,
            'condicoes_utilizacao' => 'Cupom promocional do Ambiente Demo: 10% de desconto nos produtos.',
        ]);

        Cupom::create([
            'codigo'               => 'FRETEGRATIS',
            'descricao'            => 'Frete 100% grátis em qualquer CEP (Demo)',
            'percentual'           => 100,
            'tipo'                 => Cupom::TIPO_FRETE,
            'status'               => Cupom::STATUS_ATIVO,
            'todos_produtos'       => true,
            'ativo'                => true,
            'valor_minimo_pedido'  => 0,
            'condicoes_utilizacao' => 'Cupom promocional do Ambiente Demo: 100% de desconto no valor do frete.',
        ]);

        $vale50 = Cupom::create([
            'codigo'               => 'VALE50',
            'descricao'            => 'Vale-Compra inicial de R$ 50,00 para testes no Ambiente Demo',
            'percentual'           => 0,
            'valor_fixo'           => 50.00,
            'valor_inicial'        => 50.00,
            'saldo_atual'          => 50.00,
            'tipo'                 => Cupom::TIPO_VALE_COMPRA,
            'status'               => Cupom::STATUS_ATIVO,
            'todos_produtos'       => true,
            'ativo'                => true,
            'valor_minimo_pedido'  => 0,
            'validade'             => now()->addYear(),
            'user_id'              => $clienteDemo->id,
            'condicoes_utilizacao' => 'Vale-compra inicial do Cliente Demo (R$ 50,00). Pode ser usado parcial ou integralmente.',
        ]);

        $vale50->registrarHistorico(
            'criacao',
            50.00,
            0.00,
            50.00,
            null,
            $adminDemo->id,
            'Crédito inicial de R$ 50,00 provisionado automaticamente na sessão Demo.'
        );
    }

    protected static function ensureDirectories(): void
    {
        $dir = self::directoryPath();
        if (! File::isDirectory($dir)) {
            File::makeDirectory($dir, 0755, true);
        }
    }

    /**
     * Garante a existência do arquivo template_base.sqlite atualizado em disco.
     */
    protected static function ensureTemplateFile(): void
    {
        $templatePath = self::templateFilePath();

        if (self::usesSqliteDriver()) {
            $needsBuild = ! File::exists($templatePath) || filesize($templatePath) === 0;
            if (! $needsBuild) {
                $latestMigration = collect(File::files(database_path('migrations')))
                    ->max(fn ($f) => $f->getMTime()) ?: 0;
                if (filemtime($templatePath) < $latestMigration) {
                    $needsBuild = true;
                }
            }

            if ($needsBuild) {
                if (File::exists($templatePath)) {
                    @unlink($templatePath);
                }
                touch($templatePath);
                Config::set('database.connections.demo_template', [
                    'driver'                  => 'sqlite',
                    'database'                => $templatePath,
                    'prefix'                  => '',
                    'foreign_key_constraints' => true,
                ]);
                DB::purge('demo_template');
                Artisan::call('migrate', ['--database' => 'demo_template', '--force' => true]);
            }
            return;
        }

        // Quando rodando em modo schema PostgreSQL isolado (sem extensão pdo_sqlite no PHP),
        // mantém o template_base.sqlite em disco com a definição estrutural atual.
        $officialConn = self::getOfficialConnectionName();
        $tables = DB::connection($officialConn)->select(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        );
        $meta = [
            'schema_version' => date('Y-m-d H:i:s'),
            'driver'         => 'pgsql_schema',
            'tables'         => array_map(fn ($r) => $r->tablename, $tables),
        ];
        File::put($templatePath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    protected static function writeSessionMarkerFile(string $sessionId): void
    {
        $meta = [
            'session_id'     => $sessionId,
            'schema_name'    => self::schemaName($sessionId),
            'driver'         => 'pgsql_schema',
            'provisioned_at' => now()->toIso8601String(),
        ];
        File::put(self::sqliteFilePath($sessionId), json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    protected static function schemaNameFromCurrentConnection(): string
    {
        $sp = (string) Config::get('database.connections.demo_session.search_path', '');
        return trim($sp, '" ');
    }

    /**
     * Remove apenas arquivos `.sqlite` e schemas abandonados há mais de 7 dias.
     */
    public static function cleanupAbandonedSessions(int $retentionDays = 7): int
    {
        $dir = self::directoryPath();
        if (! File::isDirectory($dir)) {
            return 0;
        }

        $cutoff = now()->subDays($retentionDays)->timestamp;
        $removidas = 0;

        foreach (File::glob($dir . DIRECTORY_SEPARATOR . 'demo_*.sqlite') as $file) {
            $mtime = @filemtime($file);
            if ($mtime === false || $mtime >= $cutoff) {
                continue;
            }

            $base = basename($file, '.sqlite');
            if (Str::startsWith($base, 'demo_')) {
                $sessionId = substr($base, 5);
                if (self::validateSessionId($sessionId)) {
                    self::destroySession($sessionId);
                    $removidas++;
                    continue;
                }
            }

            @unlink($file);
            $removidas++;
        }

        return $removidas;
    }
}
