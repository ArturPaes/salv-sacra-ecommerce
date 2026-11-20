import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMe, login as loginService, logout as logoutService, register as registerService } from '../services/authService';

const TOKEN_KEY = 'sanctum_token';
const CART_STORAGE_KEYS = [
  '@SalvSacra:carrinho',
  '@SalvSacra:cupom',
  '@SalvSacra:vale_compra',
  '@SalvSacra:cep',
];

const limparArmazenamentoCarrinho = () => {
  try {
    CART_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

const AuthContext = createContext(null);

/**
 * Provedor de autenticação.
 * Gerencia o token no localStorage e o estado do usuário logado.
 */
export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null);
  const [loading, setLoading]           = useState(true); // true enquanto verifica sessão existente
  const [blockedNotice, setBlockedNotice] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const encerrarSessaoPorBloqueio = useCallback((detail) => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('minha_conta_resumo');
      localStorage.removeItem('minha_conta_pedidos');
    } catch {}
    limparArmazenamentoCarrinho();

    setUser(null);
    window.dispatchEvent(new Event('salv-auth-logout'));
    setBlockedNotice((prev) => prev || {
      message: detail?.message || 'Sua conta foi bloqueada pela administração.',
      motivo: detail?.motivo || '',
    });
  }, []);

  // Ouve evento disparado pelo interceptor da API quando a conta é bloqueada
  useEffect(() => {
    const handleBloqueio = (e) => {
      encerrarSessaoPorBloqueio(e?.detail || {});
    };

    window.addEventListener('salv-conta-bloqueada', handleBloqueio);
    return () => window.removeEventListener('salv-conta-bloqueada', handleBloqueio);
  }, [encerrarSessaoPorBloqueio]);

  // Ao montar, verifica se já existe um token salvo e busca os dados do usuário
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    getMe()
      .then(({ data }) => {
        if (data?.user?.bloqueado) {
          encerrarSessaoPorBloqueio({
            message: 'Sua conta foi bloqueada pela administração.',
            motivo: data.user.bloqueado_motivo || '',
          });
          return;
        }
        setUser(data.user);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, [encerrarSessaoPorBloqueio]);

  // Verifica em tempo real (polling leve enquanto aba visível + ao focar a janela) se a conta foi bloqueada
  useEffect(() => {
    if (!user || user.papel === 'admin') return;

    let cancelado = false;
    const checarStatusSessao = () => {
      if (cancelado || document.visibilityState === 'hidden') return;
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      getMe()
        .then(({ data }) => {
          if (cancelado) return;
          if (data?.user?.bloqueado) {
            encerrarSessaoPorBloqueio({
              message: 'Sua conta foi bloqueada pela administração.',
              motivo: data.user.bloqueado_motivo || '',
            });
          }
        })
        .catch(() => {
          // Tratado automaticamente pelo interceptor em caso de 403 ACCOUNT_BLOCKED
        });
    };

    const intervalId = setInterval(checarStatusSessao, 3500);
    const onFocusOrVisibility = () => {
      if (document.visibilityState !== 'hidden') {
        checarStatusSessao();
      }
    };

    window.addEventListener('focus', onFocusOrVisibility);
    document.addEventListener('visibilitychange', onFocusOrVisibility);

    return () => {
      cancelado = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocusOrVisibility);
      document.removeEventListener('visibilitychange', onFocusOrVisibility);
    };
  }, [user, encerrarSessaoPorBloqueio]);

  const signIn = useCallback(async (credentials) => {
    const { data } = await loginService(credentials);
    localStorage.setItem(TOKEN_KEY, data.token);
    setBlockedNotice(null);
    setUser(data.user);
    return data;
  }, []);

  const signUp = useCallback(async (userData) => {
    const { data } = await registerService(userData);
    // Nota: O usuário só recebe token e sessão após validar o e-mail
    return data;
  }, []);

  const setSession = useCallback((token, userData) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setUser(userData);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutService();
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      limparArmazenamentoCarrinho();
      setUser(null);
      window.dispatchEvent(new Event('salv-auth-logout'));
    }
  }, []);

  const fecharModalBloqueio = useCallback(() => {
    setBlockedNotice(null);
    if (
      location.pathname.startsWith('/minha-conta') ||
      location.pathname.startsWith('/checkout') ||
      location.pathname.startsWith('/admin')
    ) {
      navigate('/login', { replace: true });
    }
  }, [location.pathname, navigate]);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, setSession, updateUser: setUser, isAuthenticated: !!user }),
    [user, loading, signIn, signUp, signOut, setSession],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}

      {blockedNotice && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="modal-conta-bloqueada-titulo"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              borderTop: '5px solid #dc2626',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '10px', lineHeight: 1 }}>🚫</div>
            <h2
              id="modal-conta-bloqueada-titulo"
              style={{ margin: '0 0 10px', fontSize: '19px', fontWeight: 800, color: '#991b1b' }}
            >
              Sua conta foi bloqueada
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#374151', lineHeight: 1.55 }}>
              A administração bloqueou o acesso da sua conta e sua sessão foi encerrada automaticamente.
            </p>
            {blockedNotice.motivo && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  lineHeight: 1.45,
                  marginBottom: '18px',
                  textAlign: 'left',
                }}
              >
                <strong>Motivo:</strong> {blockedNotice.motivo}
              </div>
            )}
            <button
              type="button"
              onClick={fecharModalBloqueio}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: '#1e1e1e',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir o contexto de autenticação.
 * Deve ser utilizado dentro de <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
