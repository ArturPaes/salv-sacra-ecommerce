import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getMe } from '../services/authService';
import {
  ACCESS_MODE_KEY,
  DEMO_SESSION_KEY,
  REAL_ACCESS_TOKEN_KEY,
  REAL_SANCTUM_BACKUP_KEY,
  alternarUsuarioDemo,
  iniciarSessaoDemo,
  obterStatusDemo,
  resetarSessaoDemo,
  validarAcessoReal,
} from '../services/demoService';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';

const DemoContext = createContext(null);

const lerModoInicial = () => {
  try {
    // Limpa eventuais resquícios antigos de localStorage para que novas abas/janelas abram o Portão
    localStorage.removeItem(ACCESS_MODE_KEY);
    localStorage.removeItem(REAL_ACCESS_TOKEN_KEY);

    const modo = sessionStorage.getItem(ACCESS_MODE_KEY);
    if (modo === 'demo') {
      const sid = localStorage.getItem(DEMO_SESSION_KEY);
      return sid ? 'demo' : null;
    }
    if (modo === 'real') {
      const realToken = sessionStorage.getItem(REAL_ACCESS_TOKEN_KEY);
      return realToken ? 'real' : null;
    }
  } catch {}
  return null;
};

const lerSessionIdInicial = () => {
  try {
    return localStorage.getItem(DEMO_SESSION_KEY) || null;
  } catch {
    return null;
  }
};

const limparCachesDeConta = () => {
  try {
    localStorage.removeItem('minha_conta_resumo');
    localStorage.removeItem('minha_conta_pedidos');
  } catch {}
};

export function DemoProvider({ children }) {
  const { setSession } = useAuth();
  const { clearCart, removerTodosBeneficios } = useCart();

  const [accessMode, setAccessMode] = useState(lerModoInicial);
  const [demoSessionId, setDemoSessionId] = useState(lerSessionIdInicial);
  const [isGateOpen, setIsGateOpen] = useState(() => !lerModoInicial());
  const [gateError, setGateError] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const [demoCupons, setDemoCupons] = useState([]);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const atualizarStatusDemo = useCallback(async () => {
    try {
      const { data } = await obterStatusDemo();
      setDemoUsers(Array.isArray(data?.usuarios) ? data.usuarios : []);
      setDemoCupons(Array.isArray(data?.cupons_ativos) ? data.cupons_ativos : []);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Sincroniza estado ao carregar a página se já estiver em Modo Demo salvo
  useEffect(() => {
    if (accessMode !== 'demo' || !demoSessionId) return;

    let cancelado = false;
    const tokenAtual = (() => {
      try {
        return localStorage.getItem('sanctum_token');
      } catch {
        return null;
      }
    })();

    obterStatusDemo()
      .then(async ({ data }) => {
        if (cancelado) return;
        setDemoUsers(Array.isArray(data?.usuarios) ? data.usuarios : []);
        setDemoCupons(Array.isArray(data?.cupons_ativos) ? data.cupons_ativos : []);

        // Caso exista sessão demo salva mas sem token ativo no navegador, autentica no cliente padrão da sessão
        if (!tokenAtual) {
          const resInit = await iniciarSessaoDemo({ sessionId: demoSessionId, reset: false });
          if (cancelado) return;
          const initData = resInit.data;
          const nextToken = initData?.tokens?.cliente || initData?.tokens?.admin || '';
          const nextUser = initData?.contas_padrao?.cliente || initData?.contas_padrao?.admin || null;
          if (nextToken && nextUser) {
            setSession(nextToken, nextUser);
          }
          setDemoUsers(Array.isArray(initData?.usuarios) ? initData.usuarios : []);
          setDemoCupons(Array.isArray(initData?.cupons_ativos) ? initData.cupons_ativos : []);
        }
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, [accessMode, demoSessionId, setSession]);

  // Ouve eventos globais do interceptor axios caso o token de acesso real expire/seja inválido
  useEffect(() => {
    const handleStoreAccessRequired = (e) => {
      try {
        sessionStorage.removeItem(REAL_ACCESS_TOKEN_KEY);
        if (sessionStorage.getItem(ACCESS_MODE_KEY) === 'real') {
          sessionStorage.removeItem(ACCESS_MODE_KEY);
        }
        localStorage.removeItem(REAL_ACCESS_TOKEN_KEY);
        localStorage.removeItem(ACCESS_MODE_KEY);
      } catch {}

      setAccessMode((prev) => (prev === 'real' ? null : prev));
      setGateError(e?.detail?.message || '');
      setIsGateOpen(true);
    };

    window.addEventListener('salv-store-access-required', handleStoreAccessRequired);
    return () => window.removeEventListener('salv-store-access-required', handleStoreAccessRequired);
  }, []);

  const entrarModoDemo = useCallback(
    async ({ reset = false } = {}) => {
      setLoadingAction(true);
      setGateError('');
      try {
        const modoAnterior = sessionStorage.getItem(ACCESS_MODE_KEY);
        const tokenAtual = localStorage.getItem('sanctum_token');
        if (modoAnterior !== 'demo' && tokenAtual) {
          try {
            localStorage.setItem(REAL_SANCTUM_BACKUP_KEY, tokenAtual);
          } catch {}
        }

        const existingSessionId = demoSessionId || localStorage.getItem(DEMO_SESSION_KEY) || null;
        const { data } = await iniciarSessaoDemo({
          sessionId: existingSessionId,
          reset: Boolean(reset),
        });

        const nextSessionId = data?.session_id;
        if (nextSessionId) {
          localStorage.setItem(DEMO_SESSION_KEY, nextSessionId);
          setDemoSessionId(nextSessionId);
        }
        sessionStorage.setItem(ACCESS_MODE_KEY, 'demo');
        setAccessMode('demo');

        if (reset) {
          if (clearCart) clearCart();
          if (removerTodosBeneficios) removerTodosBeneficios();
          try {
            localStorage.removeItem('@SalvSacra:checkout_dados');
          } catch {}
        } else {
          // Impede vazamento de dados salvos na Loja Real (ou sem escopo de sessão) para dentro do Modo Demo
          try {
            const rawCheckout = localStorage.getItem('@SalvSacra:checkout_dados');
            if (rawCheckout) {
              const parsed = JSON.parse(rawCheckout);
              if (parsed?.mode !== 'demo' || (nextSessionId && parsed?.demoSessionId !== nextSessionId)) {
                localStorage.removeItem('@SalvSacra:checkout_dados');
              }
            }
          } catch {}
        }

        limparCachesDeConta();

        const tokenCliente = data?.tokens?.cliente || data?.tokens?.admin || '';
        const contaCliente = data?.contas_padrao?.cliente || data?.contas_padrao?.admin || null;
        setSession(tokenCliente, contaCliente);

        setDemoUsers(Array.isArray(data?.usuarios) ? data.usuarios : []);
        setDemoCupons(Array.isArray(data?.cupons_ativos) ? data.cupons_ativos : []);
        setIsGateOpen(false);

        try {
          localStorage.setItem('salv_sync_trigger', String(Date.now()));
        } catch {}
        window.dispatchEvent(new Event('salv-pedidos-atualizados'));

        return data;
      } finally {
        setLoadingAction(false);
      }
    },
    [demoSessionId, clearCart, removerTodosBeneficios, setSession],
  );

  const entrarModoReal = useCallback(
    async (senha) => {
      setLoadingAction(true);
      setGateError('');
      try {
        const { data } = await validarAcessoReal(senha);
        const storeToken = data?.store_access_token;
        if (!storeToken) {
          throw new Error('Token de acesso oficial não retornado.');
        }

        const modoAnterior = sessionStorage.getItem(ACCESS_MODE_KEY);
        sessionStorage.setItem(REAL_ACCESS_TOKEN_KEY, storeToken);
        sessionStorage.setItem(ACCESS_MODE_KEY, 'real');
        setAccessMode('real');

        // Ao sair do Modo Demo para a Loja Oficial, limpa o carrinho/caches da Demo
        // preservando @SalvSacra:demo_session_id para retorno futuro
        if (modoAnterior === 'demo') {
          if (clearCart) clearCart();
          if (removerTodosBeneficios) removerTodosBeneficios();
          limparCachesDeConta();

          const backupRealToken = localStorage.getItem(REAL_SANCTUM_BACKUP_KEY);
          if (backupRealToken) {
            localStorage.setItem('sanctum_token', backupRealToken);
            localStorage.removeItem(REAL_SANCTUM_BACKUP_KEY);
            try {
              const meRes = await getMe();
              if (meRes?.data?.user) {
                setSession(backupRealToken, meRes.data.user);
              } else {
                setSession('', null);
              }
            } catch {
              setSession('', null);
            }
          } else {
            setSession('', null);
          }
        }

        setIsGateOpen(false);
        window.dispatchEvent(new Event('salv-pedidos-atualizados'));
        return data;
      } finally {
        setLoadingAction(false);
      }
    },
    [clearCart, removerTodosBeneficios, setSession],
  );

  const alternarUsuario = useCallback(
    async ({ user_id = null, papel = null } = {}) => {
      setLoadingAction(true);
      try {
        const { data } = await alternarUsuarioDemo({ user_id, papel });
        limparCachesDeConta();
        setSession(data?.token || '', data?.user || null);
        await atualizarStatusDemo();

        try {
          localStorage.setItem('salv_sync_trigger', String(Date.now()));
        } catch {}
        window.dispatchEvent(new Event('salv-pedidos-atualizados'));

        return data?.user || null;
      } finally {
        setLoadingAction(false);
      }
    },
    [setSession, atualizarStatusDemo],
  );

  const resetarDemo = useCallback(async () => {
    setLoadingAction(true);
    try {
      const { data } = await resetarSessaoDemo();
      if (clearCart) clearCart();
      if (removerTodosBeneficios) removerTodosBeneficios();
      limparCachesDeConta();
      try {
        localStorage.removeItem('@SalvSacra:checkout_dados');
      } catch {}

      if (data?.session_id) {
        localStorage.setItem(DEMO_SESSION_KEY, data.session_id);
        setDemoSessionId(data.session_id);
      }

      const nextToken = data?.tokens?.cliente || data?.tokens?.admin || '';
      const nextUser = data?.contas_padrao?.cliente || data?.contas_padrao?.admin || null;
      setSession(nextToken, nextUser);
      setDemoUsers(Array.isArray(data?.usuarios) ? data.usuarios : []);
      setDemoCupons(Array.isArray(data?.cupons_ativos) ? data.cupons_ativos : []);

      try {
        localStorage.setItem('salv_sync_trigger', String(Date.now()));
      } catch {}
      window.dispatchEvent(new Event('salv-pedidos-atualizados'));

      return data;
    } finally {
      setLoadingAction(false);
    }
  }, [clearCart, removerTodosBeneficios, setSession]);

  const abrirPortaoTrocaModo = useCallback(() => {
    setGateError('');
    setIsGateOpen(true);
  }, []);

  const fecharPortao = useCallback(() => {
    if (accessMode === 'demo' && demoSessionId) {
      setIsGateOpen(false);
      return;
    }
    if (accessMode === 'real' && sessionStorage.getItem(REAL_ACCESS_TOKEN_KEY)) {
      setIsGateOpen(false);
    }
  }, [accessMode, demoSessionId]);

  const value = useMemo(
    () => ({
      accessMode,
      isDemoMode: accessMode === 'demo',
      isRealMode: accessMode === 'real',
      demoSessionId,
      hasSavedDemoSession: Boolean(demoSessionId),
      isGateOpen,
      gateError,
      loadingAction,
      demoUsers,
      demoCupons,
      isSwitchingRole,
      setIsSwitchingRole,
      entrarModoDemo,
      entrarModoReal,
      alternarUsuario,
      resetarDemo,
      atualizarStatusDemo,
      abrirPortaoTrocaModo,
      fecharPortao,
    }),
    [
      accessMode,
      demoSessionId,
      isGateOpen,
      gateError,
      loadingAction,
      demoUsers,
      demoCupons,
      isSwitchingRole,
      entrarModoDemo,
      entrarModoReal,
      alternarUsuario,
      resetarDemo,
      atualizarStatusDemo,
      abrirPortaoTrocaModo,
      fecharPortao,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
