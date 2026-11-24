# Documentação Técnica e Funcional — Salv Sacra E-commerce

- **Projeto:** Salv Sacra: E-commerce para Vestuário Sacro  
- **Autor:** Artur Paes de Medeiros  
- **Orientador:** Prof. Fernando Silvano Gonçalves  
- **Instituição:** Instituto Federal de Santa Catarina (IFSC) — Câmpus Tubarão  
- **Curso:** Tecnologia em Análise e Desenvolvimento de Sistemas  
- **Endereço da Aplicação:** [https://salvsacra.com.br](https://salvsacra.com.br)

---

## 1. Visão Geral do Projeto

O sistema **Salv Sacra** é uma plataforma web completa de comércio eletrônico (*e-commerce*) desenvolvida sob medida para a comercialização e gestão operacional de vestuário católico e artigos sacros. O projeto moderniza a operação da microempresa (anteriormente restrita a vendas presenciais e atendimento manual via redes sociais), oferecendo um ambiente digital próprio, automatizado e isento de taxas de comissão de plataformas terceiras.

A modelagem preliminar do sistema — incluindo o levantamento inicial de requisitos, diagramas UML de casos de uso e de classes e protótipos de tela — encontra-se registrada no [Relatório Técnico do TCC I](https://docs.google.com/document/d/1Om_LgLI5H205dhFlXV2hCW62O4repruyzUNRf65lKsU/edit?usp=sharing). A aplicação consolidada é dividida em três ambientes integrados:

1. **Vitrine Pública e Área do Cliente:** Interface responsiva focada na experiência do usuário (UX), permitindo navegação temática por categorias, devoções católicas, coleções e modelagens (Regular Fit e Oversized), lista de favoritos, alerta automático de reposição de estoque, central de notificações, cálculo de frete em tempo real, *checkout* transparente (Pix e Cartão de Crédito via Mercado Pago), uso combinado de cupons promocionais e vales-compra, além de solicitação automatizada de devoluções e trocas.  
2. **Painel Administrativo (*Backoffice*):** Ambiente restrito para o lojista, contendo *dashboard* analítico interativo, gerenciamento completo de catálogo, variações e taxonomias (categorias, devoções, coleções e modelos de camiseta), controle de estoque, gestão logística de pedidos (integração com Melhor Envio e sincronização de rastreio), gestão de devoluções/trocas com geração automática de vale-compra ou estorno, gestão de clientes, criação de cupons e vales-compra com histórico de uso, moderação de avaliações, central de notificações e relatórios financeiros.  
3. **Modo Demonstração Isolado (*Sandbox*):** Ambiente interativo acessível pela barra flutuante (`DemoToolbar`), que provisiona um banco de dados SQLite temporário e isolado por sessão para que avaliadores testem livremente todas as funcionalidades nos perfis **Cliente Demo** e **Admin Demo**, sem interferir nos dados reais da loja oficial.

---

## 2. Arquitetura e Stack Tecnológico

O software adota o padrão arquitetural **Cliente-Servidor Desacoplado**, no qual o *front-end* opera como uma *Single Page Application* (SPA) hospedada na Cloudflare Pages, consumindo uma API RESTful *stateless* no *back-end* hospedada na Railway por meio de requisições assíncronas em formato JSON.

### 2.1. Front-end (Camada de Apresentação)

- **Biblioteca Principal:** React 19.2 (empacotado via Vite 8.2).  
- **Gerenciamento de Rotas:** React Router DOM 7, com proteção de rotas via componente `ProtectedRoute`.  
- **Gerenciamento de Estado Global:** React Context API, estruturada em quatro contextos principais:  
  - `AuthContext`: Controle de sessão, tokens de acesso e validação de perfil (`cliente` ou `admin`).  
  - `CartContext`: Persistência e sincronização do carrinho de compras isolada por usuário e por modo (loja oficial vs. demo), validação de estoque em tempo real, cálculo de subtotais e aplicação cumulativa de cupom promocional e vale-compra.  
  - `WishlistContext`: Gerenciamento dinâmico e sincronização da lista de produtos favoritos do usuário.  
  - `DemoContext`: Controle do Modo Demonstração (*Sandbox*), alternância instantânea entre Cliente Demo e Admin Demo, reset de sessão, simulação de pagamento e controle de acesso à loja oficial (`AccessGateModal`).  
- **Comunicação HTTP:** Axios configurado com interceptadores (`src/services/api.js`) para injeção automática do token Bearer (`Authorization`), do identificador da sessão demo (`X-Demo-Session`) e do token de acesso à loja oficial (`X-Store-Access-Token`).  
- **Segurança no Front-end:** Integração com Google reCAPTCHA (`react-google-recaptcha`) no formulário de contato e medidor visual de força de senha (`PasswordStrengthMeter.jsx`).  
- **Estilização:** CSS3 modularizado e responsivo (Mobile, Notebook e Desktop Widescreen >= 1520px), seguindo a identidade visual da marca (tons neutros e dourado sacro `#c4953a`).

### 2.2. Back-end (Camada de Regras de Negócio e API)

- **Framework:** Laravel 13.x (PHP 8.4).  
- **Autenticação e Segurança:** Laravel Sanctum 4 (autenticação via *Personal Access Tokens*), regra de senha forte (`StrongPassword.php`), controle de acesso baseado em papéis (RBAC) mediado pelo *middleware* `CheckAdmin` e isolamento de sessão pelo *middleware* `DemoSandboxMiddleware`.  
- **ORM e Banco de Dados:** Eloquent ORM integrado ao PostgreSQL em produção (Railway) e ao SQLite para o isolamento dinâmico das sessões do Modo Demonstração e execução dos testes automatizados (PHPUnit 12), utilizando transações atômicas (`DB::transaction`) para operações críticas de fechamento de pedido e baixa de inventário.  
- **Integrações Externas e Serviços Especializados (`app/Services`):**  
  - **Mercado Pago API:** Processamento de pagamentos via Pix (QR Code e Copia e Cola) e Cartão de Crédito, confirmação via *webhook* (`/api/webhooks/mercadopago`) e estornos automatizados em devoluções.  
  - **Resend API (HTTPS):** Transporte de e-mail transacional via API HTTPS, garantindo entrega autenticada pelo domínio `salvsacra.com.br`.  
  - `MelhorEnvioService`: Cotação de fretes em tempo real (Correios e transportadoras), inserção de etiquetas no carrinho logístico, logística reversa para devoluções e *webhook* de eventos (`/api/webhooks/melhor-envio`).  
  - `RastreioService`: Consulta e sincronização em lote do acompanhamento logístico dos pedidos com atualização automática de status.  
  - `AvisoEstoqueService`: Monitoramento de reposição de grade e envio automático de e-mail e notificação para clientes na fila de espera ("Avise-me quando chegar").  
  - `NotificacaoService`: Motor interno de notificações em tempo real (sininho no topo da loja e contadores no painel administrativo) para eventos de pedidos, devoluções, avaliações e reposição de estoque.  
  - `DemoSandboxService`: Gerenciamento do ciclo de vida dos bancos SQLite efêmeros do Modo Demonstração (criação, cópia de catálogo base, troca de perfil, simulação de pagamento e limpeza automática).

---

## 3. Estrutura de Diretórios do Repositório

O código-fonte está organizado em formato monorepo contendo os diretórios `backend/`, `frontend/` e `postman/`:

```text
salv-sacra-ecommerce/
├── backend/                          # API RESTful em Laravel 13 (PHP 8.4)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/          # 22 controladores da API + Controller.php base
│   │   │   └── Middleware/           # CheckAdmin.php e DemoSandboxMiddleware.php
│   │   ├── Mail/                     # 15 classes Mailable de e-mails transacionais
│   │   ├── Models/                   # 19 modelos Eloquent ORM
│   │   ├── Rules/                    # Regras de validação customizadas (StrongPassword.php)
│   │   └── Services/                 # 5 serviços de domínio (MelhorEnvio, Rastreio, AvisoEstoque, Notificacao, DemoSandbox)
│   ├── database/
│   │   ├── migrations/               # Histórico de criação e evolução do esquema relacional
│   │   └── seeders/                  # AdminSeeder, CategoriaSeeder, DevocaoSeeder, TestClientSeeder e DatabaseSeeder
│   ├── resources/views/emails/       # 15 templates HTML (Blade) para e-mails transacionais
│   ├── routes/api.php                # Definição dos endpoints públicos, autenticados, admin e demo
│   └── tests/Feature/                # Suíte PHPUnit (DemoSandboxTest.php e CuponsValesCancelamentoTest.php)
│
├── frontend/                         # Aplicação SPA em React 19 + Vite 8
│   ├── public/                       # Redirecionamento SPA (_redirects) e favicons
│   └── src/
│       ├── assets/                   # Logotipos, banners desktop/mobile, ícones de pagamento e tabelas de medidas
│       ├── components/               # AccessGateModal, AdminLayout, CardBrandIcon, CarrinhoDrawer, CupomSelector, DemoToolbar, ErrorBoundary, PasswordStrengthMeter, ProdutoCard, ProtectedRoute, PublicLayout
│       ├── constants/                # Mapeamento de cores e constantes visuais (cores.js)
│       ├── contexts/                 # AuthContext, CartContext, WishlistContext, DemoContext
│       ├── layouts/                  # MainLayout (cabeçalho, busca, notificações integradas e rodapé)
│       ├── pages/
│       │   ├── public/               # Home, CatalogoPage, ProdutoDetalhe, CheckoutPage, GuiaMedidasPage, ContatoPage, QuemSomosPage, PoliticaPrivacidadePage, TermosUsoPage, NotFoundPage
│       │   ├── admin/                # AdminDashboard, ProdutosList, ProdutoForm, EstoqueList, CategoriasDevocoesPage, PedidosList, DevolucoesList, ClientesAdmin, CuponsAdmin, AvaliacoesAdminPage, RelatoriosPage, ConfiguracoesPage
│       │   └── [Auth & Conta]        # LoginPage, RegisterPage, VerificarEmailPage, EsqueciSenhaPage, RedefinirSenhaPage, MinhaContaPage
│       ├── services/                 # 14 módulos Axios de consumo da API (api.js e serviços por domínio)
│       ├── styles/                   # 11 folhas de estilo CSS3 dedicadas por módulo
│       └── utils/                    # Utilitários do front-end (imprimirRecibo.js)
│
├── postman/                          # Coleções e environment para validação automatizada da API (Postman / Newman)
├── DOCUMENTACAO.md                   # Documentação técnica e funcional completa
└── README.md                         # Apresentação geral e guia rápido de execução
```

---

## 4. Modelagem do Banco de Dados (Esquema Relacional)

O banco de dados relacional foi modelado por meio das *migrations* do Laravel, garantindo integridade referencial, índices de performance e compatibilidade transparente entre PostgreSQL (produção) e SQLite (*sandbox* demo e testes):

| Tabela | Model Associado | Descrição e Campos Principais |
| :---- | :---- | :---- |
| `users` | `User` | Armazena clientes e administradores (`name`, `email`, `pending_email`, `password`, `papel`, `cpf`, `telefone`, `data_nascimento`, `bloqueado`). Possui *Soft Deletes* (`deleted_at`). |
| `pending_registrations` | — | Tabela temporária para validação de código de ativação de conta por e-mail antes da efetivação do usuário. |
| `blocked_emails` | — | Registro de e-mails bloqueados administrativamente para impedir novos cadastros indevidos. |
| `categorias` | `Categoria` | Classificação estrutural das peças (ex.: Camisetas, Moletons): `nome`, `slug`, `descricao`. |
| `devocaos` | `Devocao` | Classificação temática católica (ex.: São José, Nossa Senhora, Jesus): `nome`, `slug`, `descricao`, `historia`, `imagem`. |
| `colecoes` | `Colecao` | Agrupamento por coleção sazonal ou temática: `nome`, `slug`, `descricao`. |
| `modelos_camiseta` | `ModeloCamiseta` | Modelagens cadastradas na loja (ex.: Regular Fit, Oversized): `nome`, `slug`, `descricao`. |
| `produtos` | `Produto` | Entidade central do catálogo: `nome`, `slug`, `descricao`, `preco`, `preco_oversized`, `categoria_id`, `devocao_id`, `colecao_id`, `modelo`, `imagens` (galeria JSON), `imagens_vitrine`, `cores_config`, `destaque`, `ativo`. |
| `variacaos` | `Variacao` | Controle de grade de cada produto: `produto_id`, `tamanho` (PP ao GG), `cor`, `modelo`, `sku`, `estoque`, `preco_adicional`. |
| `pedidos` | `Pedido` | Registro de vendas com *snapshot* imutável do endereço de entrega, dados de contato, `metodo_pagamento` (`pix`, `cartao`), `tipo_frete`, `valor_frete`, `desconto`, cupom/vale aplicados, `total`, `status`, `codigo_rastreio`, `melhor_envio_id`, declaração de conteúdo e dados de transação Mercado Pago / QR Code Pix. |
| `item_pedidos` | `ItemPedido` | Itens vinculados a um pedido: `pedido_id`, `produto_id`, `variacao_id`, `quantidade`, `preco_unitario`, `tamanho`, `cor`. |
| `devolucoes` | `Devolucao` | Solicitações de devolução ou troca pós-entrega: `pedido_id`, `user_id`, `status`, `tipo_solicitacao` (`estorno` ou `vale_compra`), `motivo`, `descricao`, `itens_devolvidos` (JSON), `fotos` (JSON), `declaracao_conteudo_url`, `codigo_postagem_reversa`, `valor_estorno`, `cupom_gerado_codigo`. |
| `enderecos` | `Endereco` | Endereços salvos pelos clientes na área "Minha Conta" para agilizar compras futuras. |
| `cartoes` | `Cartao` | Registro seguro de cartões de crédito salvos pelo usuário (bandeira, nome do titular e últimos 4 dígitos). |
| `cupons` | `Cupom` | Cupons promocionais e Vales-Compra (`is_vale_compra`): `codigo`, `tipo` (percentual ou valor fixo), `valor`, `saldo_atual`, `valor_minimo`, `validade`, `limite_uso`, `usos_atuais`, `user_id`, `pedido_origem_id`, `bloqueado`, `ativo`. |
| `cupom_historicos` | `CupomHistorico` | Auditoria e histórico de utilização de cada cupom ou vale-compra por pedido e cliente. |
| `avaliacoes` | `Avaliacao` | Comentários, fotos e notas (1 a 5 estrelas) submetidos por clientes que adquiriram e receberam os produtos. |
| `favoritos` | `Favorito` | Relacionamento entre `user_id` e `produto_id` para persistência da Lista de Desejos. |
| `avisos_estoque` | `AvisoEstoque` | Solicitações de clientes (`user_id`, `email`, `produto_id`, `variacao_id`, `notificado`) para alerta automático na reposição de grade. |
| `notificacoes` | `Notificacao` | Notificações internas para clientes e administradores (`user_id`, `tipo` [`cliente` ou `admin`], `categoria`, `referencia_id`, `titulo`, `mensagem`, `link`, `lida`, `data_leitura`). |
| `configuracoes` | `Configuracao` | Parâmetros globais da loja (banners desktop/mobile do carrossel, CEP de origem, chaves de pagamento e logística, meta de frete grátis, contatos e redes sociais). |

---

## 5. Módulos e Funcionalidades do Sistema

### 5.1. Vitrine Pública e Experiência do Consumidor

- **Página Inicial (`Home.jsx`):** Exibição de carrossel responsivo com imagens dedicadas para desktop e dispositivos móveis (Coleção São José, Nossa Senhora Desatadora dos Nós e Por Você), vitrine de peças em destaque com troca rápida de imagens por card e acesso rápido por categorias.  
- **Catálogo e Filtragem Inteligente (`CatalogoPage.jsx`):** Listagem dinâmica com paginação e filtros combinados por Categoria, Devoção, Coleção, Modelo (Regular Fit / Oversized), Tamanho, Cor, faixa de preço e ordenação.  
- **Página de Detalhes do Produto (`ProdutoDetalhe.jsx`):**  
  - Galeria interativa com miniaturas e alternância de fotos conforme a cor selecionada.  
  - Seletor dinâmico de grade (Modelo, Cor e Tamanho) que consulta o saldo real no banco de dados e bloqueia combinações sem estoque.  
  - Recurso **"Avise-me quando chegar"**: permite ao cliente ativar alerta automático por e-mail e notificação interna quando a variação retornar ao estoque.  
  - Integração com o **Guia de Medidas (`GuiaMedidasPage.jsx`)**, exibindo tabelas ilustradas para as modelagens Oversized e Regular Fit.  
  - Seção de avaliações verificadas de clientes com média de estrelas, comentários e fotos.  
- **Carrinho Lateral (`CarrinhoDrawer.jsx`) e Seletor de Cupons (`CupomSelector.jsx`):** Gaveta deslizante acessível em toda a loja, com persistência individual por conta, validação automática de disponibilidade de estoque e aplicação combinada de 1 Cupom Promocional + 1 Vale-Compra.  
- **Fluxo de Checkout (`CheckoutPage.jsx`):**  
  - *Stepper* visual de progresso (**Identificação/Entrega → Frete → Pagamento**).  
  - Preenchimento automático de endereço via CEP (ViaCEP) ou seleção de endereço salvo na conta.  
  - Cotação de frete em tempo real integrada ao `FreteController` / `MelhorEnvioService`.  
  - Pagamento transparente integrado ao Mercado Pago via **Pix** (cálculo automático de desconto configurável, QR Code e Copia e Cola) e **Cartão de Crédito** (parcelamento e cartões salvos), além de liquidação automática quando o saldo do Vale-Compra cobre 100% do pedido.  
  - Gravação atômica do pedido no banco, baixa de estoque na tabela `variacaos` e disparo de confirmações.  
- **Área do Cliente (`MinhaContaPage.jsx`) e Central de Notificações:**  
  - Sininho de notificações integrado ao cabeçalho (`MainLayout.jsx`) com alertas em tempo real sobre pedidos, devoluções, vales-compra e reposição de estoque.  
  - Painel completo para gestão de dados pessoais, alteração de e-mail com verificação e troca de senha, endereços, cartões salvos, favoritos, carteira de Vales-Compra, avaliações publicadas, impressão de recibo (`imprimirRecibo.js`) e histórico de pedidos com solicitação de Devolução ou Troca (com upload de fotos e download da declaração de conteúdo).

### 5.2. Painel Administrativo (Gestão da Loja)

Acessível exclusivamente por usuários com `papel = 'admin'` validados pelo *middleware* `CheckAdmin`:

- **Dashboard Operacional (`AdminDashboard.jsx`):** Indicadores rápidos (KPIs) de faturamento, pedidos, ticket médio, gráfico interativo de vendas por período, últimos pedidos recebidos e alertas de variações com estoque crítico ou zerado.  
- **Gestão de Produtos (`ProdutosList.jsx` e `ProdutoForm.jsx`):** CRUD completo de produtos, marcação de destaques da vitrine, precificação por modelagem, upload múltiplo de imagens (`UploadController`), definição de fotos por cor, vinculação a categorias, devoções, coleções e modelos, além do gerenciamento da matriz de variações (cor, tamanho, modelo e SKU).  
- **Controle de Inventário (`EstoqueList.jsx`):** Visão consolidada das variações cadastradas com ajuste rápido de saldo. Quando uma variação zerada recebe estoque positivo, o `AvisoEstoqueService` notifica automaticamente os clientes na fila de espera.  
- **Gestão de Taxonomias (`CategoriasDevocoesPage.jsx`):** Gerenciamento unificado em abas para Categorias, Devoções, Coleções e Modelos de Camiseta, com proteção contra exclusão de registros vinculados a produtos (HTTP `409`).  
- **Gestão de Pedidos e Logística (`PedidosList.jsx`):** Visualização detalhada de cada venda, atualização de status operacional, envio de remessa ao carrinho do Melhor Envio, sincronização individual ou em lote de códigos de rastreio e notificação automática ao comprador.  
- **Gestão de Devoluções e Trocas (`DevolucoesList.jsx`):** Análise das solicitações pós-entrega com fotos enviadas pelo cliente, aprovação com código/etiqueta de logística reversa, recusa justificada e conclusão com estorno via Mercado Pago ou geração automática de Vale-Compra vinculado à conta do cliente.  
- **Gestão de Clientes (`ClientesAdmin.jsx`):** Listagem de clientes cadastrados, histórico de compras, bloqueio/desbloqueio preventivo (com registro em `blocked_emails`) e exclusão de contas (com proteção para a conta padrão Cliente Demo).  
- **Gestão de Cupons e Vales-Compra (`CuponsAdmin.jsx`):** Criação e controle de cupons promocionais e vales-compra, bloqueio/revogação e consulta ao histórico detalhado de uso (`CupomHistorico`).  
- **Moderação de Avaliações (`AvaliacoesAdminPage.jsx`):** Visualização e remoção de avaliações de produtos.  
- **Relatórios Gerenciais (`RelatoriosPage.jsx`):** Gráficos e indicadores de desempenho de vendas por período, produtos mais vendidos, receita por método de pagamento e vendas por categoria/devoção.  
- **Configurações Gerais (`ConfiguracoesPage.jsx`):** Parametrização dos banners do carrossel (desktop e mobile), credenciais do Mercado Pago e Melhor Envio, percentual de desconto no Pix, regras de frete grátis e dados institucionais.

### 5.3. Motor de E-mails Transacionais (`app/Mail`)

O sistema conta com 15 classes de e-mail formatadas em HTML responsivo (`resources/views/emails/`), disparadas via Resend API (HTTPS):

1. `AtivarContaMail`: Envio de código de verificação no cadastro ou troca de e-mail.  
2. `BoasVindasMail`: Confirmação de ativação de conta do cliente.  
3. `RecuperarSenhaMail`: Link seguro com token para redefinição de senha.  
4. `PedidoCriadoMail`: Resumo completo da compra enviado ao cliente após o *checkout*.  
5. `NovoPedidoAdminMail`: Alerta imediato enviado ao administrador informando uma nova venda.  
6. `StatusPedidoMail`: Notificação ao cliente a cada avanço de etapa do pedido (pagamento aprovado, em separação, enviado com código de rastreio, entregue ou cancelado).  
7. `PedidoEntregueAdminMail`: Confirmação enviada ao administrador quando o pedido consta como entregue.  
8. `PedidoCanceladoAdminMail`: Alerta ao administrador quando um pedido pendente é cancelado pelo cliente.  
9. `DevolucaoSolicitadaMail`: Confirmação ao cliente do registro de sua solicitação de devolução ou troca.  
10. `NovaDevolucaoAdminMail`: Alerta ao administrador sobre nova solicitação de devolução/troca com motivo e itens.  
11. `DevolucaoAprovadaMail`: Envio das instruções de postagem reversa e código/etiqueta ao cliente.  
12. `DevolucaoRecusadaMail`: Comunicação ao cliente com a justificativa da recusa da solicitação.  
13. `DevolucaoConcluidaMail`: Confirmação da conclusão da devolução com informação do estorno ou código do Vale-Compra gerado.  
14. `ProdutoDisponivelMail`: Disparo automático quando um item da fila "Avise-me" volta ao estoque.  
15. `ContatoMail`: Encaminhamento das mensagens enviadas pelo formulário da página "Fale Conosco".

---

## 6. Especificação da API REST (Principais Endpoints)

Todas as rotas da API são prefixadas por `/api` e definidas em `backend/routes/api.php`.

### 6.1. Rotas do Modo Demonstração (*Sandbox*) e Portão de Segurança

| Método | Endpoint | Controller / Ação | Descrição |
| :---- | :---- | :---- | :---- |
| `POST` | `/api/demo/validar-acesso-real` | `DemoController@validarAcessoReal` | Valida a senha do portão da loja oficial e retorna o `X-Store-Access-Token`. |
| `POST` | `/api/demo/iniciar` | `DemoController@iniciar` | Cria um banco SQLite isolado para a sessão demo e autentica o usuário inicial. |
| `GET` | `/api/demo/status` | `DemoController@status` | Retorna o estado atual da sessão demo e o perfil ativo. |
| `POST` | `/api/demo/alternar-usuario` | `DemoController@alternarUsuario` | Alterna instantaneamente entre Cliente Demo e Admin Demo. |
| `POST` | `/api/demo/resetar` | `DemoController@resetar` | Restaura o banco SQLite da sessão demo ao estado original de fábrica. |
| `POST` | `/api/demo/pedidos/{pedido}/simular-pagamento` | `DemoController@simularPagamento` | Simula a aprovação imediata de pagamento de um pedido no modo demo. |

### 6.2. Rotas Públicas (Catálogo, Autenticação, Webhooks e Utilidades)

| Método | Endpoint | Controller / Ação | Descrição |
| :---- | :---- | :---- | :---- |
| `POST` | `/api/auth/register` | `AuthController@register` | Inicia o cadastro e envia código de ativação por e-mail. |
| `POST` | `/api/auth/verificar-email` | `AuthController@verificarEmail` | Valida o código recebido e efetiva a criação da conta. |
| `POST` | `/api/auth/reenviar-validacao` | `AuthController@reenviarValidacao` | Reenvia o código de verificação por e-mail. |
| `POST` | `/api/auth/login` | `AuthController@login` | Autentica o usuário e retorna o token Sanctum e o papel. |
| `POST` | `/api/auth/esqueci-senha` | `PasswordResetController@enviarLink` | Solicita link de recuperação de senha por e-mail. |
| `POST` | `/api/auth/redefinir-senha` | `PasswordResetController@redefinirSenha` | Redefine a senha utilizando o token de segurança. |
| `GET` | `/api/produtos` | `ProdutoController@index` | Lista produtos ativos com filtros combinados e paginação. |
| `GET` | `/api/produtos/{produto}` | `ProdutoController@show` | Retorna detalhes do produto, galeria, variações e avaliações. |
| `GET` | `/api/categorias` \| `/api/devocaos` \| `/api/colecoes` \| `/api/modelos` | Respectivos Controllers | Lista categorias, devoções, coleções e modelos ativos para menus e filtros. |
| `GET` | `/api/configuracoes/publicas` | `ConfiguracaoController@publicas` | Retorna banners do carrossel, regras de frete grátis e contatos públicos. |
| `POST` | `/api/frete/calcular` | `FreteController@calcular` | Calcula opções, valores e prazos de entrega via Melhor Envio. |
| `GET` | `/api/cupons/disponiveis` | `CupomController@disponiveis` | Lista cupons promocionais públicos disponíveis na loja. |
| `POST` | `/api/cupons/validar` | `CupomController@validarCheckout` | Valida cupons promocionais e vales-compra no carrinho/*checkout*. |
| `POST` | `/api/carrinho/verificar-estoque` | `ProdutoController@verificarEstoqueCarrinho` | Verifica em tempo real o saldo das variações presentes no carrinho. |
| `POST` | `/api/contato` | `ContatoController@enviar` | Valida o reCAPTCHA e envia mensagem do formulário de contato. |
| `POST` | `/api/webhooks/mercadopago` \| `/api/webhooks/melhor-envio` | `PedidoController` | Recebe notificações automáticas de pagamento e eventos logísticos. |

### 6.3. Rotas Autenticadas do Cliente (`middleware: auth:sanctum`)

| Método | Endpoint | Controller / Ação | Descrição |
| :---- | :---- | :---- | :---- |
| `POST` | `/api/auth/logout` | `AuthController@logout` | Revoga o token de acesso atual do usuário. |
| `GET` | `/api/auth/me` | `AuthController@me` | Retorna os dados do usuário autenticado. |
| `GET` \| `PUT` | `/api/conta/resumo` \| `/api/conta/perfil` \| `/api/conta/senha` | `ContaController` | Consulta e atualiza dados pessoais, troca de e-mail e senha do cliente. |
| `GET` \| `POST` \| `PUT` \| `DELETE` | `/api/conta/enderecos` | `ContaController` | Gerencia a lista de endereços de entrega do cliente. |
| `GET` \| `POST` \| `DELETE` | `/api/conta/cartoes` | `ContaController` | Gerencia os cartões salvos pelo cliente. |
| `GET` \| `POST` | `/api/conta/favoritos` | `ContaController` | Lista, sincroniza e alterna produtos na Lista de Desejos. |
| `GET` | `/api/conta/vales-compra` | `CupomController@meusVales` | Lista os Vales-Compra vinculados ao cliente logado. |
| `POST` | `/api/pedidos` | `PedidoController@store` | Processa o *checkout*, abate estoque e gera a cobrança (Mercado Pago/Vale). |
| `GET` | `/api/conta/pedidos` \| `/api/pedidos/{pedido}` | `ContaController` / `PedidoController` | Retorna o histórico e detalhes de pedidos do cliente. |
| `POST` | `/api/pedidos/{pedido}/cancelar` | `PedidoController@cancelarPeloCliente` | Cancela pedido elegível e estorna o estoque das variações. |
| `POST` | `/api/pedidos/{pedido}/devolucoes` | `DevolucaoController@solicitar` | Registra solicitação de devolução ou troca com fotos e itens selecionados. |
| `GET` | `/api/devolucoes/{devolucao}/declaracao` | `DevolucaoController@baixarDeclaracao` | Gera a declaração de conteúdo para postagem reversa. |
| `GET` \| `POST` | `/api/avisos-estoque` | `AvisoEstoqueController` | Lista ou ativa/desativa avisos de reposição ("Avise-me quando chegar"). |
| `POST` \| `PUT` \| `DELETE` | `/api/produtos/{produto}/avaliacoes` | `AvaliacaoController` | Publica, edita ou exclui avaliação de produto entregue. |
| `GET` \| `PATCH` \| `DELETE` | `/api/notificacoes` | `NotificacaoController` | Lista, marca como lida ou limpa notificações do cliente. |

### 6.4. Rotas Administrativas (`middleware: ['auth:sanctum', 'admin']`)

| Método | Endpoint | Controller / Ação | Descrição |
| :---- | :---- | :---- | :---- |
| `GET` | `/api/admin/dashboard` | `AdminDashboardController@index` | Retorna KPIs financeiros, alertas de estoque e gráfico de vendas. |
| `POST` \| `PUT` \| `PATCH` \| `DELETE` | `/api/produtos` | `ProdutoController` | CRUD completo de produtos, destaque e grades de variações. |
| `POST` | `/api/admin/upload` | `UploadController@upload` | Faz upload de imagens de produtos e banners. |
| `GET` \| `PATCH` | `/api/admin/estoque` | `EstoqueController` | Listagem geral de variações e atualização de saldo com disparo de avisos. |
| `POST` \| `PUT` \| `DELETE` | `/api/categorias` \| `/api/devocaos` \| `/api/colecoes` \| `/api/modelos` | Respectivos Controllers | CRUD administrativo de taxonomias com verificação de vínculo (HTTP `409`). |
| `GET` \| `PATCH` \| `POST` \| `DELETE` | `/api/admin/pedidos` | `PedidoController` | Gestão de pedidos, envio ao Melhor Envio e sincronização de rastreios. |
| `GET` \| `PUT` \| `POST` | `/api/admin/devolucoes` | `DevolucaoController` | Aprovação, envio de etiqueta reversa, recusa e conclusão (estorno/vale-compra). |
| `GET` \| `POST` \| `DELETE` | `/api/admin/clientes` | `AdminClienteController` | Listagem, detalhes, bloqueio/desbloqueio e exclusão de clientes. |
| `GET` \| `POST` \| `PUT` \| `DELETE` | `/api/admin/cupons` \| `/api/admin/vales-compra` | `CupomController` | CRUD, bloqueio, revogação e histórico de cupons e vales-compra. |
| `GET` \| `DELETE` | `/api/admin/avaliacoes` | `AvaliacaoController` | Moderação e exclusão de avaliações de clientes. |
| `GET` \| `PATCH` \| `DELETE` | `/api/admin/notificacoes` \| `/api/admin/contadores` | `NotificacaoController` | Central de notificações administrativas e *badges* de pendências no menu. |
| `GET` | `/api/admin/relatorios` | `RelatorioController@index` | Dados consolidados de faturamento por período, categoria e pagamento. |
| `GET` \| `PUT` | `/api/admin/configuracoes` | `ConfiguracaoController` | Leitura e atualização em lote das configurações gerais e carrossel. |

---

## 7. Acesso à Plataforma e Guia de Utilização

Por se tratar de uma aplicação web hospedada em nuvem (Cloudflare Pages + Railway), não é necessária a instalação de nenhum software ou componente adicional por parte dos clientes, avaliadores ou administradores.

### 7.1. Endereço Oficial de Acesso

- **Loja Virtual e Painel Administrativo (Modo Demo):** [https://salvsacra.com.br](https://salvsacra.com.br)

### 7.2. Requisitos Mínimos para Utilização

- Dispositivo conectado à internet (Desktop, Notebook, Smartphone ou Tablet).  
- Navegador web atualizado (Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge ou Opera).

### 7.3. Fluxo de Navegação e Validação (Modo Demonstração vs. Loja Oficial)

1. **Avaliação no Modo Demonstração (*Sandbox* — Recomendado para Testes):**  
   - Ao acessar [https://salvsacra.com.br](https://salvsacra.com.br), o visitante encontra a barra **Modo Demo** para iniciar uma sessão isolada sem necessidade de cadastro ou senha.  
   - Com um único clique, é possível alternar entre **Cliente Demo** (já autenticado para testar carrinho, cupons, *checkout*, simulação instantânea de pagamento e solicitação de devolução) e **Admin Demo** (com acesso integral a `/admin` para gerenciar produtos, estoque, pedidos, devoluções e configurações), além de acompanhar o guia interativo de validação e resetar os dados de teste a qualquer momento.  
2. **Operação na Loja Oficial (Produção):**  
   - A loja oficial opera conectada ao banco de dados principal PostgreSQL na Railway, com pagamentos reais via Mercado Pago, cálculo logístico via Melhor Envio e disparo de e-mails via Resend (`@salvsacra.com.br`). Por segurança, credenciais administrativas de produção não são expostas neste documento público.

---

## 8. Testes Automatizados e Validação da API

Para assegurar a confiabilidade das regras de negócio e a integridade da comunicação cliente-servidor, o repositório disponibiliza duas frentes complementares de testes:

- **Testes Automatizados de Back-end (PHPUnit 12):** Localizados em `backend/tests/Feature/`, executáveis com `php artisan test`:  
  - `DemoSandboxTest.php`: Valida a criação e o isolamento das sessões SQLite do Modo Demonstração, a alternância de perfis, a simulação de pagamento e o bloqueio de interferência sobre o banco principal.  
  - `CuponsValesCancelamentoTest.php`: Valida as regras de aplicação cumulativa de cupons e vales-compra, abatimento de saldo, auditoria em `cupom_historicos` e estorno de estoque/créditos em cancelamentos.  
- **Coleções de Validação de API (Postman / Newman):** Disponíveis na pasta `postman/`:  
  - `Salv_Sacra_Site_Real_Leitura.postman_collection.json`: Testes seguros de leitura e verificação de proteção das rotas da loja em produção, sem alterar dados reais.  
  - `Salv_Sacra_Integracao_Demo.postman_collection.json`: Suíte completa de testes de integração ponta a ponta (leitura, escrita, *checkout* e controle de acesso) executada sobre o ambiente *sandbox*.  
  - `Salv_Sacra_Local.postman_environment.json`: Variáveis de ambiente pré-configuradas para execução local.
