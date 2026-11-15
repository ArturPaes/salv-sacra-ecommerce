import api, {
  ACCESS_MODE_KEY,
  DEMO_SESSION_KEY,
  REAL_ACCESS_TOKEN_KEY,
} from './api';

export { ACCESS_MODE_KEY, DEMO_SESSION_KEY, REAL_ACCESS_TOKEN_KEY };

export const REAL_SANCTUM_BACKUP_KEY = '@SalvSacra:real_sanctum_backup';

export const validarAcessoReal = (senha) =>
  api.post(
    '/demo/validar-acesso-real',
    { senha },
    {
      headers: {
        'X-Skip-Mode-Headers': '1',
      },
    },
  );

export const iniciarSessaoDemo = ({ sessionId = null, reset = false } = {}) =>
  api.post(
    '/demo/iniciar',
    {
      ...(sessionId ? { session_id: sessionId } : {}),
      reset: Boolean(reset),
    },
    {
      headers: {
        'X-Skip-Mode-Headers': '1',
        ...(sessionId ? { 'X-Demo-Session': sessionId } : {}),
      },
    },
  );

export const obterStatusDemo = () => api.get('/demo/status');

export const alternarUsuarioDemo = ({ user_id = null, papel = null } = {}) =>
  api.post('/demo/alternar-usuario', {
    ...(user_id ? { user_id } : {}),
    ...(papel ? { papel } : {}),
  });

export const resetarSessaoDemo = () => api.post('/demo/resetar');

export const simularPagamentoPedidoDemo = (pedidoId) =>
  api.post(`/demo/pedidos/${pedidoId}/simular-pagamento`);
