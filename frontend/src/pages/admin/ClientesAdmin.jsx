import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarClientesAdmin,
  obterClienteAdmin,
  bloquearClienteAdmin,
  desbloquearClienteAdmin,
  excluirClienteAdmin,
} from '../../services/adminClienteService';
import { criarValeCompraAdmin } from '../../services/cupomService';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/admin.css';

const moeda = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatData = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

const formatEnderecoResumo = (end) => {
  if (!end) return null;
  const linha1 = [end.logradouro, end.numero].filter(Boolean).join(', ');
  const linha2 = [end.bairro, end.cidade && end.estado ? `${end.cidade}/${end.estado}` : (end.cidade || end.estado)]
    .filter(Boolean)
    .join(' — ');
  return { linha1, linha2, cep: end.cep, complemento: end.complemento, origem: end.origem };
};

export default function ClientesAdmin() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Busca, Filtros e Ordenação
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('todos'); // todos | com_pedidos | sem_pedidos | verificados
  const [ordenacao, setOrdenacao] = useState('id_desc'); // id_desc | id_asc | nome_asc | nome_desc | pedidos_desc | gasto_desc

  // Paginação (padrão PedidosList)
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Drawer de Detalhes do Cliente
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Modal de Exclusão
  const [clienteParaExcluir, setClienteParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // Modal de Bloqueio / Desbloqueio
  const [modalBloqueio, setModalBloqueio] = useState({
    aberto: false,
    cliente: null,
    motivo: '',
    enviando: false,
  });
  const [desbloqueandoId, setDesbloqueandoId] = useState(null);

  // Modal Rápido para Conceder Vale-Compra
  const [modalVale, setModalVale] = useState({
    aberto: false,
    cliente: null,
    valor: '',
    validade: '',
    valor_minimo_pedido: '',
    condicoes_utilizacao: 'Crédito concedido pela loja para futuras compras.',
    enviando: false,
  });

  const carregarClientes = async () => {
    setLoading(true);
    setErro('');
    try {
      const { data } = await listarClientesAdmin();
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar a lista de clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  const abrirDetalhesCliente = async (cliente) => {
    setClienteSelecionado(cliente);
    setCarregandoDetalhe(true);
    try {
      const { data } = await obterClienteAdmin(cliente.id);
      setClienteSelecionado((prev) => ({ ...(prev || {}), ...data }));
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao carregar detalhes do cliente.');
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const handleExcluirCliente = async () => {
    if (!clienteParaExcluir) return;
    setExcluindo(true);
    setErro('');
    try {
      const { data } = await excluirClienteAdmin(clienteParaExcluir.id);
      setClientes((prev) => prev.filter((c) => c.id !== clienteParaExcluir.id));
      if (clienteSelecionado?.id === clienteParaExcluir.id) {
        setClienteSelecionado(null);
      }
      setSucesso(data?.message || `Cliente #${clienteParaExcluir.id} excluído com sucesso.`);
      setClienteParaExcluir(null);
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível excluir o cliente.');
    } finally {
      setExcluindo(false);
    }
  };

  const abrirModalBloqueio = (cliente) => {
    setModalBloqueio({
      aberto: true,
      cliente,
      motivo: cliente?.bloqueado_motivo || '',
      enviando: false,
    });
  };

  const handleConfirmarBloqueio = async (e) => {
    if (e) e.preventDefault();
    if (!modalBloqueio.cliente) return;
    const alvo = modalBloqueio.cliente;
    setModalBloqueio((prev) => ({ ...prev, enviando: true }));
    setErro('');
    try {
      const { data } = await bloquearClienteAdmin(alvo.id, {
        motivo: modalBloqueio.motivo.trim() || 'Conta bloqueada pela administração.',
      });
      const patch = data?.cliente || { bloqueado: true, bloqueado_motivo: modalBloqueio.motivo.trim() };
      setClientes((prev) => prev.map((c) => (c.id === alvo.id ? { ...c, ...patch } : c)));
      if (clienteSelecionado?.id === alvo.id) {
        setClienteSelecionado((prev) => ({ ...prev, ...patch }));
      }
      setSucesso(data?.message || `Cliente #${alvo.id} bloqueado com sucesso.`);
      setModalBloqueio({ aberto: false, cliente: null, motivo: '', enviando: false });
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível bloquear o cliente.');
      setModalBloqueio((prev) => ({ ...prev, enviando: false }));
    }
  };

  const handleDesbloquearCliente = async (cliente) => {
    if (!cliente) return;
    setDesbloqueandoId(cliente.id);
    setErro('');
    try {
      const { data } = await desbloquearClienteAdmin(cliente.id);
      const patch = data?.cliente || { bloqueado: false, bloqueado_motivo: null, bloqueado_em: null };
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? { ...c, ...patch } : c)));
      if (clienteSelecionado?.id === cliente.id) {
        setClienteSelecionado((prev) => ({ ...prev, ...patch }));
      }
      setSucesso(data?.message || `Cliente #${cliente.id} desbloqueado com sucesso.`);
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível desbloquear o cliente.');
    } finally {
      setDesbloqueandoId(null);
    }
  };

  const abrirModalVale = (cliente) => {
    setModalVale({
      aberto: true,
      cliente,
      valor: '',
      validade: '',
      valor_minimo_pedido: '',
      condicoes_utilizacao: 'Crédito concedido pela loja para futuras compras.',
      enviando: false,
    });
  };

  const handleConcederVale = async (e) => {
    e.preventDefault();
    if (!modalVale.cliente) return;
    const valorNum = Number(modalVale.valor);
    if (!valorNum || valorNum <= 0) {
      setErro('Informe um valor válido maior que zero para o vale-compra.');
      return;
    }

    setModalVale((prev) => ({ ...prev, enviando: true }));
    setErro('');
    try {
      const payload = {
        valor_inicial: valorNum,
        user_id: modalVale.cliente.id,
        validade: modalVale.validade || null,
        valor_minimo_pedido: modalVale.valor_minimo_pedido ? Number(modalVale.valor_minimo_pedido) : null,
        condicoes_utilizacao: modalVale.condicoes_utilizacao?.trim() || null,
        descricao: `Vale-Compra concedido para ${modalVale.cliente.name} (ID #${modalVale.cliente.id})`,
      };
      const { data } = await criarValeCompraAdmin(payload);
      const novoVale = data?.vale || data?.cupom || data;
      setSucesso(
        `Vale-compra ${novoVale?.codigo || ''} (${moeda(valorNum)}) criado para o cliente #${modalVale.cliente.id} (${modalVale.cliente.name})!`
      );
      setModalVale((prev) => ({ ...prev, aberto: false, enviando: false }));

      if (clienteSelecionado?.id === modalVale.cliente.id) {
        abrirDetalhesCliente(modalVale.cliente);
      }
      setTimeout(() => setSucesso(''), 6000);
    } catch (err) {
      setErro(err.response?.data?.message || 'Erro ao gerar vale-compra para o cliente.');
      setModalVale((prev) => ({ ...prev, enviando: false }));
    }
  };

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    const filtrados = clientes.filter((c) => {
      if (filtroPerfil === 'com_pedidos' && Number(c.pedidos_count || 0) <= 0) return false;
      if (filtroPerfil === 'sem_pedidos' && Number(c.pedidos_count || 0) > 0) return false;
      if (filtroPerfil === 'verificados' && !c.email_verificado) return false;
      if (filtroPerfil === 'bloqueados' && !c.bloqueado) return false;

      if (!q) return true;
      const end = c.endereco_principal;
      const textoEndereco = end
        ? `${end.logradouro || ''} ${end.bairro || ''} ${end.cidade || ''} ${end.estado || ''} ${end.cep || ''}`
        : '';

      return (
        String(c.id).includes(q.replace('#', '')) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.cpf || '').toLowerCase().includes(q) ||
        (c.telefone || '').toLowerCase().includes(q) ||
        textoEndereco.toLowerCase().includes(q)
      );
    });

    filtrados.sort((a, b) => {
      switch (ordenacao) {
        case 'id_asc':
          return Number(a.id) - Number(b.id);
        case 'nome_asc':
          return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
        case 'nome_desc':
          return (b.name || '').localeCompare(a.name || '', 'pt-BR', { sensitivity: 'base' });
        case 'pedidos_desc':
          return Number(b.pedidos_count || 0) - Number(a.pedidos_count || 0);
        case 'gasto_desc':
          return Number(b.total_gasto || 0) - Number(a.total_gasto || 0);
        case 'id_desc':
        default:
          return Number(b.id) - Number(a.id);
      }
    });

    return filtrados;
  }, [clientes, busca, filtroPerfil, ordenacao]);

  // Paginação
  const totalClientes = clientesFiltrados.length;
  const totalPaginas =
    itensPorPagina === 'todos' ? 1 : Math.ceil(totalClientes / Number(itensPorPagina)) || 1;
  const paginaCorrigida = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const inicioIdx =
    itensPorPagina === 'todos' ? 0 : (paginaCorrigida - 1) * Number(itensPorPagina);
  const fimIdx =
    itensPorPagina === 'todos'
      ? totalClientes
      : Math.min(inicioIdx + Number(itensPorPagina), totalClientes);
  const clientesPaginados = clientesFiltrados.slice(inicioIdx, fimIdx);

  const copiarTexto = (txt, label) => {
    try {
      navigator.clipboard.writeText(String(txt));
      setSucesso(`${label} copiado: ${txt}`);
      setTimeout(() => setSucesso(''), 2500);
    } catch {}
  };

  return (
    <div className="admin-page">
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="admin-title">Clientes da Loja</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
            Consulte ID, CPF, endereços, histórico de pedidos e conceda vales-compra vinculados ao cliente.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={carregarClientes}
          disabled={loading}
        >
          {loading ? 'Atualizando…' : '↻ Atualizar Lista'}
        </button>
      </div>

      {erro && <div className="admin-alert admin-alert-error">{erro}</div>}
      {sucesso && <div className="admin-alert admin-alert-success">{sucesso}</div>}

      {/* Barra de Pesquisa, Filtros e Ordenação */}
      <div className="admin-filters-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '18px' }}>
        <input
          type="text"
          className="admin-search-input"
          placeholder="Buscar por ID, nome, e-mail, CPF, telefone ou cidade..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPaginaAtual(1);
          }}
          style={{ flex: '1 1 280px', minWidth: '240px' }}
        />

        <select
          className="admin-filter-select"
          value={filtroPerfil}
          onChange={(e) => {
            setFiltroPerfil(e.target.value);
            setPaginaAtual(1);
          }}
          aria-label="Filtrar clientes"
        >
          <option value="todos">Todos os clientes ({clientes.length})</option>
          <option value="com_pedidos">Com pedidos realizados</option>
          <option value="sem_pedidos">Sem pedidos ainda</option>
          <option value="verificados">E-mail verificado</option>
          <option value="bloqueados">Contas bloqueadas</option>
        </select>

        <select
          className="admin-filter-select"
          value={ordenacao}
          onChange={(e) => {
            setOrdenacao(e.target.value);
            setPaginaAtual(1);
          }}
          aria-label="Ordenar clientes"
        >
          <option value="id_desc">Ordenar: ID (Mais recentes)</option>
          <option value="id_asc">Ordenar: ID (Mais antigos)</option>
          <option value="nome_asc">Ordenar: Ordem Alfabética (A–Z)</option>
          <option value="nome_desc">Ordenar: Ordem Alfabética (Z–A)</option>
          <option value="pedidos_desc">Ordenar: Mais Pedidos</option>
          <option value="gasto_desc">Ordenar: Maior Valor Gasto</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <LoadingSpinner size="md" />
        </div>
      ) : totalClientes === 0 ? (
        <div className="admin-empty-state">
          <p>Nenhum cliente encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>CPF / Contato</th>
                <th>Endereço Principal</th>
                <th>Pedidos</th>
                <th>Cadastro</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesPaginados.map((c) => {
                const end = formatEnderecoResumo(c.endereco_principal);
                return (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => copiarTexto(c.id, 'ID do cliente')}
                        title="Clique para copiar o ID do cliente"
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          fontWeight: 800,
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        #{c.id}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#0f172a' }}>{c.name}</strong>
                        {c.bloqueado && (
                          <span
                            title={c.bloqueado_motivo || 'Conta bloqueada pela administração'}
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontWeight: 700,
                              background: '#fee2e2',
                              color: '#b91c1c',
                            }}
                          >
                            🚫 Conta Bloqueada
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{c.email}</div>
                      <span
                        title={
                          c.email_verificado
                            ? 'O cliente confirmou o link de verificação de e-mail'
                            : 'O cliente ainda não confirmou o e-mail de verificação do cadastro'
                        }
                        style={{
                          display: 'inline-block',
                          marginTop: '4px',
                          fontSize: '10.5px',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          fontWeight: 700,
                          background: c.email_verificado ? '#dcfce7' : '#fef9c3',
                          color: c.email_verificado ? '#15803d' : '#a16207',
                        }}
                      >
                        {c.email_verificado ? 'E-mail verificado' : 'E-mail não verificado'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px' }}>
                      <div>
                        <strong>CPF:</strong> {c.cpf || '—'}
                      </div>
                      <div style={{ color: '#64748b', marginTop: '2px' }}>
                        <strong>Tel:</strong> {c.telefone || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', maxWidth: '250px' }}>
                      {end ? (
                        <>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {end.linha1}
                            {end.complemento ? ` (${end.complemento})` : ''}
                          </div>
                          <div style={{ color: '#64748b' }}>
                            {end.linha2} {end.cep ? `· CEP ${end.cep}` : ''}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Sem endereço cadastrado</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {c.pedidos_count} {Number(c.pedidos_count) === 1 ? 'pedido' : 'pedidos'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                        {moeda(c.total_gasto)}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatData(c.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => abrirDetalhesCliente(c)}
                        >
                          Ver Pedidos / Dados
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', fontWeight: 700 }}
                          onClick={() => abrirModalVale(c)}
                        >
                          🎟️ Vale
                        </button>
                        {c.bloqueado ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            disabled={desbloqueandoId === c.id}
                            style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700 }}
                            onClick={() => handleDesbloquearCliente(c)}
                          >
                            {desbloqueandoId === c.id ? 'Desbloqueando…' : 'Desbloquear'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm"
                            style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontWeight: 700 }}
                            onClick={() => abrirModalBloqueio(c)}
                          >
                            🚫 Bloquear
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700 }}
                          onClick={() => setClienteParaExcluir(c)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Controles de Paginação (mesmo padrão das outras telas do Admin) ── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderTop: '1px solid #eee',
              background: '#fafafa',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#555', flexWrap: 'wrap' }}>
              <span>Exibir por página:</span>
              <select
                className="admin-filter-select"
                style={{ padding: '4px 8px', fontSize: '13px' }}
                value={itensPorPagina}
                onChange={(e) => {
                  setItensPorPagina(e.target.value === 'todos' ? 'todos' : Number(e.target.value));
                  setPaginaAtual(1);
                }}
              >
                <option value={10}>10 clientes</option>
                <option value={20}>20 clientes</option>
                <option value={50}>50 clientes</option>
                <option value="todos">Mostrar todos ({totalClientes})</option>
              </select>
              <span>
                Mostrando <strong>{totalClientes === 0 ? 0 : inicioIdx + 1}</strong> a <strong>{fimIdx}</strong> de <strong>{totalClientes}</strong> clientes
              </span>
            </div>

            {itensPorPagina !== 'todos' && totalPaginas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaCorrigida <= 1}
                  style={{ padding: '6px 12px' }}
                >
                  ◀ Anterior
                </button>
                <span style={{ fontSize: '13px', color: '#444', fontWeight: 600, padding: '0 8px' }}>
                  Página {paginaCorrigida} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaCorrigida >= totalPaginas}
                  style={{ padding: '6px 12px' }}
                >
                  Próxima ▶
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Drawer Lateral: Dados completos, Endereços, Vales e Pedidos do Cliente ── */}
      {clienteSelecionado && (
        <div className="admin-drawer-overlay" onClick={() => setClienteSelecionado(null)}>
          <div
            className="admin-drawer"
            style={{ maxWidth: '640px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-drawer-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>
                  Cliente #{clienteSelecionado.id} — {clienteSelecionado.name}
                </h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Cadastrado em {formatData(clienteSelecionado.created_at)}
                </span>
              </div>
              <button
                type="button"
                className="admin-drawer-close"
                onClick={() => setClienteSelecionado(null)}
                aria-label="Fechar detalhes do cliente"
              >
                ✕
              </button>
            </div>

            <div className="admin-drawer-body">
              <div className="admin-drawer-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: 0 }}>Informações Cadastrais</h4>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', fontWeight: 700 }}
                      onClick={() => abrirModalVale(clienteSelecionado)}
                    >
                      🎟️ Conceder Vale-Compra ao ID #{clienteSelecionado.id}
                    </button>
                    {clienteSelecionado.bloqueado ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        disabled={desbloqueandoId === clienteSelecionado.id}
                        style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700 }}
                        onClick={() => handleDesbloquearCliente(clienteSelecionado)}
                      >
                        {desbloqueandoId === clienteSelecionado.id ? 'Desbloqueando…' : 'Desbloquear Conta'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontWeight: 700 }}
                        onClick={() => abrirModalBloqueio(clienteSelecionado)}
                      >
                        🚫 Bloquear Conta
                      </button>
                    )}
                  </div>
                </div>
                {clienteSelecionado.bloqueado && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '12.5px', color: '#991b1b' }}>
                    <strong>🚫 Conta Bloqueada:</strong> Este cliente está impedido de acessar a loja e seu e-mail está bloqueado para novos cadastros.
                    {clienteSelecionado.bloqueado_motivo && (
                      <div style={{ marginTop: '4px' }}>
                        <strong>Motivo:</strong> {clienteSelecionado.bloqueado_motivo}
                      </div>
                    )}
                  </div>
                )}
                <div className="admin-pedido-info-card">
                  <p>
                    <strong>ID do Cliente:</strong> #{clienteSelecionado.id}{' '}
                    <button
                      type="button"
                      onClick={() => copiarTexto(clienteSelecionado.id, 'ID do cliente')}
                      style={{ marginLeft: '6px', fontSize: '11px', padding: '2px 7px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                    >
                      Copiar ID
                    </button>
                  </p>
                  <p><strong>Nome:</strong> {clienteSelecionado.name}</p>
                  <p><strong>E-mail:</strong> {clienteSelecionado.email}</p>
                  <p><strong>CPF:</strong> {clienteSelecionado.cpf || 'Não informado'}</p>
                  <p><strong>Telefone / WhatsApp:</strong> {clienteSelecionado.telefone || 'Não informado'}</p>
                  <p><strong>Data de Nascimento:</strong> {clienteSelecionado.data_nascimento ? formatData(`${clienteSelecionado.data_nascimento}T00:00:00`) : 'Não informada'}</p>
                </div>
              </div>

              {carregandoDetalhe ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                <>
                  {/* Endereços */}
                  <div className="admin-drawer-section">
                    <h4>Endereços Salvos ({(clienteSelecionado.enderecos || []).length})</h4>
                    {(clienteSelecionado.enderecos || []).length === 0 ? (
                      <div className="admin-pedido-info-card" style={{ color: '#64748b' }}>
                        {clienteSelecionado.endereco_principal ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                              Endereço usado no último pedido:
                            </div>
                            {clienteSelecionado.endereco_principal.logradouro}, {clienteSelecionado.endereco_principal.numero}
                            {clienteSelecionado.endereco_principal.complemento ? ` (${clienteSelecionado.endereco_principal.complemento})` : ''}
                            <br />
                            {clienteSelecionado.endereco_principal.bairro} — {clienteSelecionado.endereco_principal.cidade}/{clienteSelecionado.endereco_principal.estado} · CEP {clienteSelecionado.endereco_principal.cep}
                          </div>
                        ) : (
                          'Nenhum endereço cadastrado.'
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {clienteSelecionado.enderecos.map((end) => (
                          <div key={end.id} className="admin-pedido-info-card" style={{ fontSize: '13px' }}>
                            <strong>{end.logradouro}, {end.numero}</strong>
                            {end.complemento ? ` (${end.complemento})` : ''}
                            <div>{end.bairro} — {end.cidade}/{end.estado}</div>
                            <div style={{ color: '#64748b' }}>CEP: {end.cep}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vales-Compra do Cliente */}
                  <div className="admin-drawer-section">
                    <h4>Vales-Compra Vinculados ({(clienteSelecionado.vales_compra || []).length})</h4>
                    {(clienteSelecionado.vales_compra || []).length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Este cliente não possui vales-compra vinculados.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {clienteSelecionado.vales_compra.map((v) => (
                          <div
                            key={v.id}
                            style={{
                              background: '#faf5ff',
                              border: '1px solid #e9d5ff',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '8px',
                              fontSize: '13px',
                            }}
                          >
                            <div>
                              <strong style={{ fontFamily: 'monospace', color: '#6b21a8' }}>{v.codigo}</strong>
                              <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                                ({v.status || (v.ativo ? 'ativo' : 'inativo')})
                              </span>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                Inicial: {moeda(v.valor_inicial ?? v.valor_fixo)} · Saldo atual: <strong>{moeda(v.saldo_atual ?? v.valor_fixo)}</strong>
                              </div>
                            </div>
                            <Link
                              to="/admin/categorias"
                              style={{ fontSize: '12px', color: '#6b21a8', fontWeight: 700 }}
                            >
                              Gerenciar em Descontos →
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pedidos do Cliente */}
                  <div className="admin-drawer-section">
                    <h4>Pedidos Realizados ({(clienteSelecionado.pedidos || []).length})</h4>
                    {(clienteSelecionado.pedidos || []).length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        Este cliente ainda não realizou pedidos na loja.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {clienteSelecionado.pedidos.map((ped) => (
                          <div
                            key={ped.id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '12px',
                              background: '#fff',
                              fontSize: '13px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                              <div>
                                <strong>Pedido #{ped.id}</strong>{' '}
                                <span style={{ color: '#64748b', fontSize: '12px' }}>
                                  ({formatData(ped.data_pedido || ped.created_at)})
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: ped.status === 'Cancelado' ? '#fee2e2' : '#f1f5f9',
                                  color: ped.status === 'Cancelado' ? '#b91c1c' : '#0f172a',
                                }}
                              >
                                {ped.status}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: '12.5px' }}>
                              <span>Pagamento: <strong style={{ textTransform: 'uppercase' }}>{ped.metodo_pagamento}</strong></span>
                              <span>Total: <strong>{moeda(ped.valor_total)}</strong></span>
                            </div>
                            {(ped.cupom_codigo || ped.vale_compra_codigo) && (
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                                {ped.cupom_codigo && `Cupom: ${ped.cupom_codigo} `}
                                {ped.vale_compra_codigo && `· Vale: ${ped.vale_compra_codigo} (-${moeda(ped.valor_vale_compra)})`}
                              </div>
                            )}
                            {Array.isArray(ped.itens) && ped.itens.length > 0 && (
                              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '12px', color: '#475569' }}>
                                {ped.itens.map((it) => (
                                  <div key={it.id}>
                                    • {it.quantidade}x {it.variacao?.produto?.nome || 'Produto'} ({it.variacao?.tamanho || '—'})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Rápido: Conceder Vale-Compra ao Cliente ── */}
      {modalVale.aberto && modalVale.cliente && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 99999 }}
          onClick={() => !modalVale.enviando && setModalVale((prev) => ({ ...prev, aberto: false }))}
        >
          <div className="admin-modal" style={{ maxWidth: '470px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#6b21a8' }}>
              🎟️ Conceder Vale-Compra — Cliente #{modalVale.cliente.id}
            </h3>
            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 14px' }}>
              O vale será vinculado diretamente a <strong>{modalVale.cliente.name}</strong> ({modalVale.cliente.email}).
            </p>
            <form onSubmit={handleConcederVale}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                  Valor do Vale-Compra (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={modalVale.valor}
                  onChange={(e) => setModalVale((prev) => ({ ...prev, valor: e.target.value }))}
                  placeholder="Ex: 50.00"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                    Validade (opcional)
                  </label>
                  <input
                    type="date"
                    value={modalVale.validade}
                    onChange={(e) => setModalVale((prev) => ({ ...prev, validade: e.target.value }))}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                    Pedido Mínimo (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalVale.valor_minimo_pedido}
                    onChange={(e) => setModalVale((prev) => ({ ...prev, valor_minimo_pedido: e.target.value }))}
                    placeholder="Ex: 100.00"
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                  Condições de Utilização
                </label>
                <input
                  type="text"
                  value={modalVale.condicoes_utilizacao}
                  onChange={(e) => setModalVale((prev) => ({ ...prev, condicoes_utilizacao: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div className="admin-modal-actions" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  disabled={modalVale.enviando}
                  onClick={() => setModalVale((prev) => ({ ...prev, aberto: false }))}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  style={{ background: '#6b21a8', borderColor: '#6b21a8' }}
                  disabled={modalVale.enviando}
                >
                  {modalVale.enviando ? 'Gerando…' : 'Criar Vale-Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Bloqueio de Conta do Cliente ── */}
      {modalBloqueio.aberto && modalBloqueio.cliente && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 99999 }}
          onClick={() => !modalBloqueio.enviando && setModalBloqueio({ aberto: false, cliente: null, motivo: '', enviando: false })}
        >
          <div className="admin-modal" style={{ maxWidth: '470px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#c2410c', marginTop: 0 }}>
              🚫 Bloquear Conta — Cliente #{modalBloqueio.cliente.id}
            </h3>
            <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#475569', margin: '0 0 12px' }}>
              Ao bloquear <strong>{modalBloqueio.cliente.name}</strong> ({modalBloqueio.cliente.email}), todas as sessões ativas serão encerradas, o acesso à conta será impedido e o <strong>e-mail ficará bloqueado</strong> para impedir novos cadastros.
            </p>
            <form onSubmit={handleConfirmarBloqueio}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                  Motivo do bloqueio (opcional)
                </label>
                <textarea
                  rows={3}
                  value={modalBloqueio.motivo}
                  onChange={(e) => setModalBloqueio((prev) => ({ ...prev, motivo: e.target.value }))}
                  disabled={modalBloqueio.enviando}
                  placeholder="Ex: Chargeback recorrente / uso indevido / fraude identificada..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', resize: 'vertical' }}
                />
              </div>
              <div className="admin-modal-actions" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  disabled={modalBloqueio.enviando}
                  onClick={() => setModalBloqueio({ aberto: false, cliente: null, motivo: '', enviando: false })}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  style={{ background: '#c2410c', borderColor: '#c2410c' }}
                  disabled={modalBloqueio.enviando}
                >
                  {modalBloqueio.enviando ? 'Bloqueando…' : 'Confirmar Bloqueio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Exclusão do Cliente ── */}
      {clienteParaExcluir && (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 99999 }}
          onClick={() => !excluindo && setClienteParaExcluir(null)}
        >
          <div className="admin-modal" style={{ maxWidth: '450px', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#b91c1c', marginTop: 0 }}>Confirmar Exclusão de Cliente</h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569' }}>
              Tem certeza que deseja excluir o cliente <strong>#{clienteParaExcluir.id} — {clienteParaExcluir.name}</strong> ({clienteParaExcluir.email})?
              <br />
              O acesso será revogado e os dados de pedidos são preservados.{' '}
              {clienteParaExcluir.bloqueado
                ? 'Como esta conta está bloqueada, o e-mail continuará impedido de realizar novos cadastros.'
                : 'O e-mail será liberado caso o cliente queira criar uma nova conta no futuro.'}
            </p>
            <div className="admin-modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setClienteParaExcluir(null)}
                disabled={excluindo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleExcluirCliente}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo…' : 'Sim, excluir cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
