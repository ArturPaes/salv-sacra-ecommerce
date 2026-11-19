import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useDemo } from '../contexts/DemoContext';

const CODIGOS_PADRAO_GUIA = [
  {
    codigo: 'PROMO10',
    titulo: '10% OFF nos produtos',
    detalhe: 'Cupom promocional acumulável com vale-compra.',
    cor: '#166534',
    bg: '#f8faf8',
    border: '#d1d5db',
  },
  {
    codigo: 'FRETEGRATIS',
    titulo: '100% OFF no frete',
    detalhe: 'Zera o valor do frete SEDEX ou PAC no checkout.',
    cor: '#1e293b',
    bg: '#f8fafc',
    border: '#d1d5db',
  },
  {
    codigo: 'VALE50',
    titulo: 'R$ 50,00 em Vale-Compra',
    detalhe: 'Vinculado ao Cliente Demo; preserva saldo restante se o pedido for menor.',
    cor: '#3f3f46',
    bg: '#faf9f6',
    border: '#d6d3cd',
  },
];

// Ícones SVG minimalistas (sem emojis de IA)
const IconLayers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconSliders = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconTag = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const IconSwitch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconChevron = ({ up = false }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
  </svg>
);

export default function DemoToolbar() {
  const { user } = useAuth();
  const { isCartOpen } = useCart();
  const {
    isDemoMode,
    demoUsers,
    demoCupons,
    loadingAction,
    alternarUsuario,
    resetarDemo,
    atualizarStatusDemo,
    abrirPortaoTrocaModo,
    setIsSwitchingRole,
  } = useDemo();

  const navigate = useNavigate();
  const location = useLocation();

  const [minimizado, setMinimizado] = useState(true);
  const [modalGuiaAberto, setModalGuiaAberto] = useState(false);
  const [modalResetAberto, setModalResetAberto] = useState(false);
  const [copiadoChave, setCopiadoChave] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (isDemoMode) {
      setMinimizado(true);
      document.body.classList.add('demo-mode-active');
    } else {
      document.body.classList.remove('demo-mode-active');
    }
    return () => {
      document.body.classList.remove('demo-mode-active');
    };
  }, [isDemoMode]);

  if (!isDemoMode) return null;

  const exibirToast = (texto) => {
    setToastMsg(texto);
    setTimeout(() => {
      setToastMsg((atual) => (atual === texto ? '' : atual));
    }, 3200);
  };

  const copiarTexto = (chave, valor) => {
    try {
      navigator.clipboard.writeText(valor);
      setCopiadoChave(chave);
      setTimeout(() => setCopiadoChave(''), 2000);
    } catch { }
  };

  const usuariosAtivos = (demoUsers || []).filter((u) => !u.deleted_at);
  const ehAdminAtual = user?.papel === 'admin';

  const handleVisaoCliente = async () => {
    try {
      setMinimizado(true);
      if (user && user.papel === 'cliente') {
        navigate('/', { replace: true });
        return;
      }
      setIsSwitchingRole(true);
      navigate('/', { replace: true });
      // Garante desmontagem de rotas /admin antes da troca de papel no AuthContext
      await new Promise((resolve) => setTimeout(resolve, 0));
      const nextUser = await alternarUsuario({ papel: 'cliente' });
      if (nextUser) {
        exibirToast(`Visão Cliente ativada (${nextUser.name})`);
      }
    } catch (err) {
      exibirToast(err?.response?.data?.message || 'Não foi possível alternar para Visão Cliente.');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleVisaoAdmin = async () => {
    try {
      setMinimizado(true);
      if (user && user.papel === 'admin') {
        if (!location.pathname.startsWith('/admin')) {
          navigate('/admin');
        }
        return;
      }
      const nextUser = await alternarUsuario({ papel: 'admin' });
      navigate('/admin');
      if (nextUser) {
        exibirToast(`Painel Admin ativado (${nextUser.name})`);
      }
    } catch (err) {
      exibirToast(err?.response?.data?.message || 'Não foi possível alternar para Painel Admin.');
    }
  };

  const handleSelecionarUsuario = async (e) => {
    const val = e.target.value;
    if (!val) return;
    const userId = Number(val);
    if (!userId || userId === user?.id) return;

    const usuarioAlvo = usuariosAtivos.find((u) => Number(u.id) === userId);
    const indoParaCliente = usuarioAlvo && usuarioAlvo.papel !== 'admin';

    try {
      setMinimizado(true);
      if (location.pathname.startsWith('/admin') && indoParaCliente) {
        setIsSwitchingRole(true);
        navigate('/', { replace: true });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const nextUser = await alternarUsuario({ user_id: userId });
      if (nextUser?.papel === 'admin') {
        navigate('/admin');
      } else if (location.pathname.startsWith('/admin')) {
        navigate('/', { replace: true });
      }
      if (nextUser) {
        exibirToast(`Conta alterada para #${nextUser.id} ${nextUser.name}`);
      }
    } catch (err) {
      exibirToast(err?.response?.data?.message || 'Não foi possível trocar para esta conta.');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleConfirmarReset = async () => {
    try {
      setModalResetAberto(false);
      setMinimizado(true);
      setIsSwitchingRole(true);
      navigate('/', { replace: true });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await resetarDemo();
      exibirToast('✓ Sessão Demo restaurada para o estado inicial!');
    } catch (err) {
      setModalResetAberto(false);
      exibirToast(err?.response?.data?.message || 'Erro ao resetar sessão Demo.');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  return (
    <>
      {/* Notificação discreta acima da barra */}
      {toastMsg && (
        <div
          className={`demo-toolbar-toast${isCartOpen ? ' demo-toolbar-cart-open' : ''}`}
          style={{
            position: 'fixed',
            bottom: minimizado ? '60px' : '82px',
            ...(isCartOpen ? { left: '16px' } : { right: '16px' }),
            zIndex: 1120,
            background: '#1e1e1e',
            color: '#f5f5f4',
            border: '1px solid #3f3f46',
            borderLeft: '3px solid #c4953a',
            borderRadius: '6px',
            padding: '9px 14px',
            fontSize: '12.5px',
            fontWeight: 600,
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.28)',
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Modo Minimizado */}
      {minimizado ? (
        <div
          className={`demo-toolbar-pill-wrap${isCartOpen ? ' demo-toolbar-cart-open' : ''}`}
          style={{
            position: 'fixed',
            bottom: '16px',
            ...(isCartOpen ? { left: '16px', right: 'auto' } : { right: '16px', left: 'auto' }),
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <button
            type="button"
            className="demo-toolbar-pill-btn"
            onClick={() => {
              setMinimizado(false);
              atualizarStatusDemo();
            }}
            style={{
              background: '#1e1e1e',
              color: '#f5f5f4',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
              letterSpacing: '0.02em',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            title="Expandir barra do Modo Demo"
          >
            <IconLayers />
            <span>Modo Demo</span>
            <span style={{ color: '#52525b', fontWeight: 400 }}>|</span>
            <span style={{ color: '#c4953a', fontWeight: 700 }}>
              {ehAdminAtual ? 'Admin' : 'Cliente'}
            </span>
            <IconChevron up />
          </button>
        </div>
      ) : (
        /* Barra Flutuante Expandida */
        <div
          className={`demo-toolbar-expanded-wrap${isCartOpen ? ' demo-toolbar-cart-open' : ''}`}
          style={{
            position: 'fixed',
            bottom: '12px',
            left: '12px',
            right: isCartOpen ? 'calc(var(--cart-drawer-w, 500px) + 16px)' : '12px',
            zIndex: 1100,
            display: 'flex',
            justifyContent: isCartOpen ? 'flex-start' : 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            role="region"
            aria-label="Barra de Controle do Modo Demo"
            className="demo-toolbar-expanded-panel"
            style={{
              pointerEvents: 'auto',
              width: 'fit-content',
              maxWidth: '100%',
              background: '#1e1e1e',
              color: '#f5f5f4',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              padding: '10px 14px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.32)',
              fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Identificação da Sessão */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span
                style={{
                  background: '#2c2c2c',
                  color: '#e7e5e4',
                  border: '1px solid #44403c',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '4px',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconLayers />
                Modo Demo · Sessão Isolada
              </span>
              <span style={{ fontSize: '12px', color: '#a8a29e', whiteSpace: 'nowrap' }}>
                {user ? (
                  <>
                    Ativo:{' '}
                    <strong style={{ color: '#ffffff', fontWeight: 700 }}>
                      {user.papel === 'admin' ? 'Admin' : 'Cliente'} · {user.name}
                    </strong>
                  </>
                ) : (
                  'Visitante Demo'
                )}
              </span>
            </div>

            {/* Ações de Troca e Controles */}
            <div
              className="demo-toolbar-actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'nowrap',
                gap: '7px',
                maxWidth: '100%',
                overflowX: 'auto',
              }}
            >
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleVisaoCliente}
                style={{
                  background: !ehAdminAtual && user ? '#c4953a' : '#2c2c2c',
                  color: !ehAdminAtual && user ? '#141414' : '#e4e4e7',
                  border:
                    !ehAdminAtual && user
                      ? '1px solid #d4af37'
                      : '1px solid #44403c',
                  borderRadius: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  fontWeight: !ehAdminAtual && user ? 700 : 600,
                  cursor: loadingAction ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconUser />
                Visão Cliente
              </button>

              <button
                type="button"
                disabled={loadingAction}
                onClick={handleVisaoAdmin}
                style={{
                  background: ehAdminAtual ? '#c4953a' : '#2c2c2c',
                  color: ehAdminAtual ? '#141414' : '#e4e4e7',
                  border: ehAdminAtual
                    ? '1px solid #d4af37'
                    : '1px solid #44403c',
                  borderRadius: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  fontWeight: ehAdminAtual ? 700 : 600,
                  cursor: loadingAction ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconSliders />
                Painel Admin
              </button>

              {usuariosAtivos.length > 0 && (
                <select
                  aria-label="Selecionar conta da sessão Demo"
                  value={user?.id || ''}
                  disabled={loadingAction}
                  onFocus={atualizarStatusDemo}
                  onChange={handleSelecionarUsuario}
                  style={{
                    background: '#2c2c2c',
                    color: '#f5f5f4',
                    border: '1px solid #44403c',
                    borderRadius: '5px',
                    padding: '6px 9px',
                    fontSize: '12px',
                    fontWeight: 500,
                    maxWidth: '220px',
                    cursor: 'pointer',
                  }}
                >
                  {!user && <option value="">Selecionar conta da sessão...</option>}
                  {usuariosAtivos.map((u) => (
                    <option key={u.id} value={u.id} disabled={Boolean(u.bloqueado)}>
                      [{u.papel === 'admin' ? 'Admin' : 'Cliente'}] #{u.id} {u.name}
                      {u.bloqueado ? ' (Bloqueada)' : ''}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => {
                  atualizarStatusDemo();
                  setModalGuiaAberto(true);
                }}
                style={{
                  background: '#2c2c2c',
                  color: '#e4e4e7',
                  border: '1px solid #44403c',
                  borderRadius: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconTag />
                Guia &amp; Cupons
              </button>

              <button
                type="button"
                disabled={loadingAction}
                onClick={() => setModalResetAberto(true)}
                style={{
                  background: '#2c2c2c',
                  color: '#fca5a5',
                  border: '1px solid #7f1d1d',
                  borderRadius: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: loadingAction ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconRefresh />
                Resetar Demo
              </button>

              <button
                type="button"
                disabled={loadingAction}
                onClick={abrirPortaoTrocaModo}
                style={{
                  background: '#2c2c2c',
                  color: '#e4e4e7',
                  border: '1px solid #44403c',
                  borderRadius: '5px',
                  padding: '6px 11px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <IconSwitch />
                Trocar Modo
              </button>

              <button
                type="button"
                onClick={() => setMinimizado(true)}
                aria-label="Minimizar barra Demo"
                title="Recolher barra do Modo Demo"
                style={{
                  background: '#2c2c2c',
                  color: '#d4d4d8',
                  border: '1px solid #44403c',
                  borderRadius: '5px',
                  padding: '6px 9px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconChevron />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Guia Rápido & Cupons de Teste */}
      {modalGuiaAberto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalGuiaAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(15, 23, 42, 0.68)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              color: '#1e1e1e',
              border: '1px solid #d6d3cd',
              borderRadius: '6px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.14)',
              fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '14px',
                paddingBottom: '12px',
                borderBottom: '1px solid #efede8',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e1e1e', letterSpacing: '-0.2px' }}>
                Guia Rápido e Dados de Teste (Modo Demo)
              </h2>
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                style={{
                  background: '#faf9f6',
                  border: '1px solid #d6d3cd',
                  borderRadius: '5px',
                  padding: '5px 10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#3f3f46',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#57534e', lineHeight: 1.55, marginTop: 0 }}>
              Tudo o que você criar ou editar nesta sessão fica salvo apenas para você. Use os
              códigos e cartões abaixo para testar todo o fluxo:
            </p>

            {/* Cupons e Vales */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#1e1e1e', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '18px 0 8px' }}>
              Cupons e Vales-Compra Disponíveis na Sessão
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CODIGOS_PADRAO_GUIA.map((item) => {
                const cupomSessao = (demoCupons || []).find((c) => c.codigo === item.codigo);
                const saldoStr =
                  item.codigo === 'VALE50' && cupomSessao?.saldo_atual !== undefined
                    ? ` (Saldo atual na sessão: R$ ${Number(cupomSessao.saldo_atual)
                      .toFixed(2)
                      .replace('.', ',')})`
                    : '';

                return (
                  <div
                    key={item.codigo}
                    style={{
                      background: item.bg,
                      border: `1px solid ${item.border}`,
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code
                          style={{
                            fontWeight: 800,
                            fontSize: '13px',
                            color: item.cor,
                            background: '#fff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: `1px solid ${item.border}`,
                          }}
                        >
                          {item.codigo}
                        </code>
                        <strong style={{ fontSize: '13px', color: '#1e1e1e' }}>{item.titulo}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#57534e', marginTop: '3px' }}>
                        {item.detalhe}
                        {saldoStr}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiarTexto(item.codigo, item.codigo)}
                      style={{
                        background: copiadoChave === item.codigo ? '#166534' : '#1e1e1e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {copiadoChave === item.codigo ? '✓ Copiado!' : 'Copiar'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Cartão de Crédito de Teste */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#1e1e1e', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 8px' }}>
              Cartão de Crédito de Teste (Checkout Simulado)
            </h3>
            <div
              style={{
                background: '#faf9f6',
                border: '1px solid #d6d3cd',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#3f3f46',
                lineHeight: 1.6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  <strong>Número:</strong> <code>4000 1234 5678 9010</code> ·{' '}
                  <strong>Validade:</strong> <code>12/30</code> · <strong>CVV:</strong>{' '}
                  <code>123</code>
                </span>
                <button
                  type="button"
                  onClick={() => copiarTexto('CARTAO', '4000 1234 5678 9010')}
                  style={{
                    background: copiadoChave === 'CARTAO' ? '#166534' : '#1e1e1e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copiadoChave === 'CARTAO' ? '✓ Número Copiado!' : 'Copiar Número'}
                </button>
              </div>
              <div style={{ marginTop: '4px' }}>
                <strong>Titular para Aprovação Imediata:</strong> <code>CLIENTE DEMO APRO</code>
              </div>
              <div>
                <strong>Titular para Simular Análise / Pendente:</strong> <code>CONT</code>
              </div>
              <div style={{ color: '#57534e', fontWeight: 600, marginTop: '4px' }}>
                No Checkout, você também encontra um botão para preencher estes dados com 1 clique.
              </div>
            </div>

            {/* Roteiro de Validação */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#1e1e1e', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 8px' }}>
              Sugestões do que testar
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                gap: '10px',
                fontSize: '12.5px',
                color: '#3f3f46',
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  background: '#faf9f6',
                  border: '1px solid #d6d3cd',
                  borderRadius: '6px',
                  padding: '12px',
                }}
              >
                <strong style={{ color: '#1e1e1e', display: 'block', marginBottom: '4px' }}>
                  Na Visão Cliente:
                </strong>
                • Adicionar camisetas ao carrinho e testar <code>PROMO10</code> +{' '}
                <code>VALE50</code>.<br />• Finalizar compra via PIX e clicar em{' '}
                <strong>Simular Pagamento Aprovado Agora</strong>.<br />• Criar uma conta própria em{' '}
                <strong>Cadastre-se</strong> (sem reCAPTCHA / com ativação automática) e alternar
                para ela no seletor.<br />• Cancelar um pedido pago ou solicitar devolução/troca em{' '}
                <strong>Minha Conta</strong>.
              </div>
              <div
                style={{
                  background: '#faf9f6',
                  border: '1px solid #d6d3cd',
                  borderRadius: '6px',
                  padding: '12px',
                }}
              >
                <strong style={{ color: '#1e1e1e', display: 'block', marginBottom: '4px' }}>
                  No Painel Admin:
                </strong>
                • Visualizar seus pedidos criados em <strong>Pedidos e Pagamentos</strong>.<br />•
                Gerar etiqueta Melhor Envio simulada e avançar rastreio até <strong>Entregue</strong>
                .<br />• Abrir <strong>Clientes</strong>, conceder um novo vale-compra ou testar o
                bloqueio de uma conta.<br />• Editar produtos, estoque ou cupons sabendo que o site
                real permanece 100% intacto.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Reset */}
      {modalResetAberto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !loadingAction && setModalResetAberto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(15, 23, 42, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              color: '#1e1e1e',
              border: '1px solid #d6d3cd',
              borderRadius: '6px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.14)',
              fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: 700, color: '#991b1b' }}>
              Resetar Sessão Demo?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#57534e', lineHeight: 1.6 }}>
              Todas as contas, pedidos, devoluções, alterações de catálogo e movimentações criadas
              por você nesta sessão serão apagadas, restaurando o catálogo oficial, as contas Demo
              padrão e os cupons <strong>PROMO10</strong>, <strong>FRETEGRATIS</strong> e{' '}
              <strong>VALE50</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={loadingAction}
                onClick={() => setModalResetAberto(false)}
                style={{
                  background: '#faf9f6',
                  color: '#3f3f46',
                  border: '1px solid #d6d3cd',
                  borderRadius: '5px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loadingAction}
                onClick={handleConfirmarReset}
                style={{
                  background: '#991b1b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: loadingAction ? 'wait' : 'pointer',
                }}
              >
                {loadingAction ? 'Resetando...' : 'Sim, Resetar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
