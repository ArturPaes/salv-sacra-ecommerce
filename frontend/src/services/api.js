import axios from 'axios';

/**
 * Instância base do axios configurada para a API do back-end.
 * O token Bearer é injetado automaticamente via interceptor
 * caso exista um token salvo no localStorage.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Injeta o token em todas as requisições quando disponível
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sanctum_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Detecta bloqueio imediato de conta em qualquer chamada autenticada e notifica o AuthContext
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
    }

    return Promise.reject(error);
  },
);

export default api;
