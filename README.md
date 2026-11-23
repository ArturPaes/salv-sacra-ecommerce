# Salv Sacra — E-commerce para Vestuário Sacro

- **Projeto:** Salv Sacra: E-commerce para Vestuário Sacro
- **Autor:** Artur Paes de Medeiros
- **Orientador:** Prof. Fernando Silvano Gonçalves
- **Instituição:** Instituto Federal de Santa Catarina (IFSC) — Câmpus Tubarão
- **Curso:** Tecnologia em Análise e Desenvolvimento de Sistemas
- **Endereço da Aplicação:** [https://salvsacra.com.br](https://salvsacra.com.br)

---

## Sobre o Projeto

Projeto de e-commerce completo desenvolvido como **Trabalho de Conclusão de Curso (TCC)**, voltado à comercialização de vestuário sacro. A plataforma integra loja virtual responsiva, área do cliente, painel administrativo completo e um modo demonstração (sandbox) para validação das funcionalidades sem afetar os dados oficiais.

---

## Funcionalidades Principais

### Loja Virtual e Área do Cliente
- **Vitrine e Catálogo:** Carrossel responsivo (desktop e mobile), busca, filtros por categoria, devoção, coleção, modelo, cor e faixa de preço, além de paginação e ordenação.
- **Página de Produto:** Galeria de imagens com variação por cor, seleção de tamanho, guia de medidas (Regular Fit e Oversized), cálculo de frete e avaliações de clientes.
- **Carrinho e Checkout:** Carrinho persistido por usuário, aplicação de cupons de desconto, cálculo de frete, pagamento via Pix/Cartão e emissão de confirmação por e-mail.
- **Minha Conta:** Cadastro com verificação de e-mail, login, recuperação de senha, gestão de endereços, favoritos, histórico de pedidos, solicitação de trocas/devoluções e avaliações.
- **Contato:** Formulário de atendimento protegido com Google reCAPTCHA e envio de notificações por e-mail.

### Painel Administrativo
- **Dashboard:** Indicadores de vendas, faturamento, pedidos recentes e gráfico interativo de desempenho.
- **Gestão de Catálogo:** CRUD completo de produtos, variações (cor/tamanho), upload de imagens, categorias, devoções, coleções e modelos de camiseta.
- **Controle de Estoque e Pedidos:** Atualização de estoque por variação, gestão de status de pedidos, código de rastreio e acompanhamento de devoluções/trocas.
- **Clientes e Avaliações:** Listagem de clientes, histórico e moderação de avaliações.
- **Relatórios e Configurações:** Relatórios gerenciais, gestão de banners do carrossel (desktop e mobile) e configurações da loja e pagamentos.

### Modo Demonstração (Sandbox)
- Ambiente isolado acessível diretamente pela barra de demonstração em [salvsacra.com.br](https://salvsacra.com.br), permitindo testar fluxos de **Cliente Demo** e **Admin Demo** com dados próprios, sem interferir na loja oficial.

---

## Tecnologias Utilizadas

### Frontend
- **React 19** (`react`, `react-dom`)
- **Vite 8** (build e servidor de desenvolvimento)
- **React Router DOM 7** (roteamento SPA)
- **Axios** (comunicação com a API REST)
- **CSS3** (layout responsivo para desktop, notebook e mobile)
- **Google reCAPTCHA** (`react-google-recaptcha`)

### Backend e Integrações
- **PHP 8.4**
- **Laravel 13** (API RESTful e Eloquent ORM)
- **Laravel Sanctum 4** (autenticação via tokens)
- **PostgreSQL** (persistência em produção) e **SQLite** (isolamento do modo demonstração e testes automatizados)
- **Mercado Pago** (integração de pagamentos via Pix e Cartão de Crédito)
- **Melhor Envio** (cálculo de frete e rastreamento)
- **Resend** (envio de e-mails transacionais via HTTPS)
- **PHPUnit 12** (testes automatizados)

### Infraestrutura e Ferramentas
- **Cloudflare Pages** (hospedagem do frontend e DNS)
- **Railway** (hospedagem da API Laravel e banco de dados PostgreSQL)
- **VS Code**, **Git / GitHub** e **Postman** (coleções disponíveis em `postman/`)

---

## Estrutura do Projeto

```text
salv-sacra-ecommerce/
├── backend/       # API REST em Laravel (controllers, models, migrations, testes)
├── frontend/      # Aplicação SPA em React + Vite (páginas, componentes, estilos)
├── postman/       # Coleções de requisições da API para testes no Postman / Newman
└── README.md
```

---

## Como Executar Localmente

### 1. Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

---

## Testes Automatizados e Validação da API

- **PHPUnit (Backend):** A suíte de testes automatizados cobre os principais fluxos da API e o isolamento do modo demonstração (`cd backend && php artisan test`).
- **Postman / Newman:** A pasta `postman/` contém duas coleções de validação:
  - `Salv_Sacra_Site_Real_Leitura.postman_collection.json`: testes seguros de leitura e proteção da loja oficial.
  - `Salv_Sacra_Integracao_Demo.postman_collection.json`: suíte completa de integração de ponta a ponta no ambiente Demo (Sandbox).
