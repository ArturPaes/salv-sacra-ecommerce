import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';
import AccessGateModal from './components/AccessGateModal';
import DemoToolbar from './components/DemoToolbar';
import PublicLayout from './components/PublicLayout';
import LoadingSpinner from './components/LoadingSpinner';
import Home from './pages/public/Home';
import './App.css';

// Carregamento sob demanda (Code Splitting) para acelerar a abertura inicial da loja
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const EsqueciSenhaPage = lazy(() => import('./pages/EsqueciSenhaPage'));
const RedefinirSenhaPage = lazy(() => import('./pages/RedefinirSenhaPage'));
const VerificarEmailPage = lazy(() => import('./pages/VerificarEmailPage'));
const MinhaContaPage = lazy(() => import('./pages/MinhaContaPage'));
const ProdutoDetalhe = lazy(() => import('./pages/public/ProdutoDetalhe'));
const CatalogoPage = lazy(() => import('./pages/public/CatalogoPage'));
const CheckoutPage = lazy(() => import('./pages/public/CheckoutPage'));
const ContatoPage = lazy(() => import('./pages/public/ContatoPage'));
const GuiaMedidasPage = lazy(() => import('./pages/public/GuiaMedidasPage'));
const PoliticaPrivacidadePage = lazy(() => import('./pages/public/PoliticaPrivacidadePage'));
const TermosUsoPage = lazy(() => import('./pages/public/TermosUsoPage'));
const QuemSomosPage = lazy(() => import('./pages/public/QuemSomosPage'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage'));
const ProdutosList = lazy(() => import('./pages/admin/ProdutosList'));
const ProdutoForm = lazy(() => import('./pages/admin/ProdutoForm'));
const PedidosList = lazy(() => import('./pages/admin/PedidosList'));
const EstoqueList = lazy(() => import('./pages/admin/EstoqueList'));
const RelatoriosPage = lazy(() => import('./pages/admin/RelatoriosPage'));
const ConfiguracoesPage = lazy(() => import('./pages/admin/ConfiguracoesPage'));
const CategoriasDevocoesPage = lazy(() => import('./pages/admin/CategoriasDevocoesPage'));
const AvaliacoesAdminPage = lazy(() => import('./pages/admin/AvaliacoesAdminPage'));
const DevolucoesList = lazy(() => import('./pages/admin/DevolucoesList'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ClientesAdmin = lazy(() => import('./pages/admin/ClientesAdmin'));

/**
 * Redireciona a rota `/admin` para o destino correto:
 * - Admin autenticado → /admin/produtos
 * - Qualquer outro → / (vitrine)
 * Aguarda o loading do AuthContext para não redirecionar antes de saber o estado.
 */
function AdminRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated && user?.papel === 'admin') {
    return <Navigate to="/admin/produtos" replace />;
  }
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<LoadingSpinner size="lg" text="Carregando página..." />}>
      <Routes>
      {/* ── Vitrine Pública ── */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/produtos" element={<CatalogoPage />} />
        <Route path="/catalogo" element={<Navigate to="/produtos?categoria=camisetas" replace />} />
        <Route path="/produto/:id" element={<ProdutoDetalhe />} />
        <Route path="/contato" element={<ContatoPage />} />
        <Route path="/guia-de-medidas" element={<GuiaMedidasPage />} />
        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
        <Route path="/termos-de-uso" element={<TermosUsoPage />} />
        <Route path="/quem-somos" element={<QuemSomosPage />} />
        {/* Rota 404 personalizada para URLs não mapeadas */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ── Fluxo de Checkout ── */}
      <Route path="/checkout" element={<CheckoutPage />} />

      {/* ── Autenticação ── */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/esqueci-minha-senha" element={<EsqueciSenhaPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route path="/verificar-email" element={<VerificarEmailPage />} />
      <Route path="/minha-conta" element={<MinhaContaPage />} />

      {/* ── Painel Administrativo (layout compartilhado) ── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* /admin → Início / Dashboard */}
        <Route index element={<AdminDashboard />} />

        {/* UC03 — Produtos */}
        <Route path="produtos"            element={<ProdutosList />} />
        <Route path="produtos/novo"       element={<ProdutoForm />} />
        <Route path="produtos/editar/:id" element={<ProdutoForm />} />

        {/* Gestão de Pedidos e Pagamentos */}
        <Route path="pedidos"             element={<PedidosList />} />

        {/* Gestão de Devoluções e Trocas */}
        <Route path="devolucoes"          element={<DevolucoesList />} />

        {/* Gestão de Clientes */}
        <Route path="clientes"            element={<ClientesAdmin />} />

        {/* Categorias e Devoções */}
        <Route path="categorias"          element={<CategoriasDevocoesPage />} />

        {/* Gestão de Estoque */}
        <Route path="estoque"             element={<EstoqueList />} />

        {/* Moderação de Avaliações */}
        <Route path="avaliacoes"          element={<AvaliacoesAdminPage />} />

        {/* Relatórios e Faturamento */}
        <Route path="relatorios"          element={<RelatoriosPage />} />

        {/* Configurações da Loja */}
        <Route path="config"              element={<ConfiguracoesPage />} />
      </Route>
    </Routes>
      </Suspense>
      <AccessGateModal />
      <DemoToolbar />
    </>
  );
}

export default App;
