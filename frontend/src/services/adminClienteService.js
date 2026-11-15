import api from './api';

export function listarClientesAdmin() {
  return api.get('/admin/clientes');
}

export function obterClienteAdmin(id) {
  return api.get(`/admin/clientes/${id}`);
}

export function bloquearClienteAdmin(id, dados = {}) {
  return api.post(`/admin/clientes/${id}/bloquear`, dados);
}

export function desbloquearClienteAdmin(id) {
  return api.post(`/admin/clientes/${id}/desbloquear`);
}

export function excluirClienteAdmin(id) {
  return api.delete(`/admin/clientes/${id}`);
}
