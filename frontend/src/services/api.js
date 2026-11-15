import axios from 'axios';

export const ACCESS_MODE_KEY = '@SalvSacra:access_mode';
export const DEMO_SESSION_KEY = '@SalvSacra:demo_session_id';
export const REAL_ACCESS_TOKEN_KEY = '@SalvSacra:real_access_token';

/**
 * Instância base do axios configurada para a API do back-end.
 * O token Bearer é injetado automaticamente via interceptor
 * caso exista um token salvo no localStorage, bem como o header de
 * isolamento da sessão Demo (X-Demo-Session) ou acesso à Loja Real (X-Store-Access-Token).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Injeta token Sanctum e headers do Modo Demo / Loja Oficial em todas as requisições
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('sanctum_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const accessMode = localStorage.getItem(ACCESS_MODE_KEY);
    const bypassModeHeaders = config.headers?.['X-Skip-Mode-Headers'];
    if (bypassModeHeaders) {
      delete config.headers['X-Skip-Mode-Headers'];
      return config;
    }

    if (accessMode === 'demo') {
      const demoSessionId = localStorage.getItem(DEMO_SESSION_KEY);
      if (demoSessionId && !config.headers['X-Demo-Session']) {
        config.headers['X-Demo-Session'] = demoSessionId;
      }
    } else if (accessMode === 'real') {
      const realAccessToken = localStorage.getItem(REAL_ACCESS_TOKEN_KEY);
      if (realAccessToken && !config.headers['X-Store-Access-Token']) {
        config.headers['X-Store-Access-Token'] = realAccessToken;
      }
    }
  } catch {}

  return config;
});

// Detecta bloqueio imediato de conta ou exigência de senha do portão da Loja Oficial
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;

    if (status === 403 && data?.code === 'ACCOUNT_BLOCKED') {
      try {
        localStorage.removeItem('sanctum_token');
        localStorage.removeItem('minha_conta_resumo');
        localStorage.removeItem('minha_conta_pedidos');
      } catch {}

      window.dispatchEvent(
        new CustomEvent('salv-conta-bloqueada', {
          detail: {
            message: data.message || 'Sua conta foi bloqueada pela administração.',
            motivo: data.motivo || '',
          },
        }),
      );
    } else if (status === 403 && data?.code === 'STORE_ACCESS_REQUIRED') {
      try {
        localStorage.removeItem(REAL_ACCESS_TOKEN_KEY);
        if (localStorage.getItem(ACCESS_MODE_KEY) === 'real') {
          localStorage.removeItem(ACCESS_MODE_KEY);
        }
      } catch {}

      window.dispatchEvent(
        new CustomEvent('salv-store-access-required', {
          detail: {
            message:
              data.message ||
              'Acesso restrito ao site oficial em período de testes. Informe a senha de acesso real ou utilize o Modo Demo.',
          },
        }),
      );
    }

    return Promise.reject(error);
  },
);

export default api;
