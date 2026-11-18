import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDemo } from '../contexts/DemoContext';
import MainLayout from '../layouts/MainLayout';
import LoadingSpinner from './LoadingSpinner';

/**
 * PublicLayout — wrapper da Vitrine Pública.
 * Reutiliza o MainLayout existente (header com topbar, navbar, footer completo)
 * e renderiza o conteúdo da rota filha via <Outlet />.
 * Admins autenticados não acessam a vitrine de cliente — devem clicar em "Sair" antes.
 */
export default function PublicLayout() {
  const { user, isAuthenticated, loading } = useAuth();
  const { isSwitchingRole } = useDemo() || {};

  if (isSwitchingRole) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e8e8' }}>
        <LoadingSpinner size="lg" text="Alternando para Visão Cliente..." />
      </div>
    );
  }

  if (!loading && isAuthenticated && user?.papel === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}
