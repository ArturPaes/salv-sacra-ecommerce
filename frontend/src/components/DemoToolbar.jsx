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
    cor: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    codigo: 'FRETEGRATIS',
    titulo: '100% OFF no frete',
    detalhe: 'Zera o valor do frete SEDEX ou PAC no checkout.',
    cor: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
  {
    codigo: 'VALE50',
    titulo: 'R$ 50,00 em Vale-Compra',
    detalhe: 'Vinculado ao Cliente Demo; preserva saldo restante se o pedido for menor.',
    cor: '#6b21a8',
    bg: '#faf5ff',
    border: '#e9d5ff',
  },
];

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
    } catch {}
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
            bottom: minimizado ? '62px' : '74px',
            ...(isCartOpen ? { left: '16px' } : { right: '16px' }),
            zIndex: 1120,
            background: '#111827',
            color: '#f8fafc',
            border: '1px solid #c5a880',
            borderRadius: '10px',
            padding: '10px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
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
              background: '#111827',
              color: '#f8fafc',
              border: '1.5px solid #c5a880',
              borderRadius: '999px',
              padding: '10px 16px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
            title="Expandir barra do Modo Demo"
          >
            <span>🧪 Modo Demo</span>
            <span style={{ color: '#d4b483', fontWeight: 600 }}>
              ({ehAdminAtual ? 'Admin' : 'Cliente'}) ▲
            </span>
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
            right: isCartOpen ? '428px' : '12px',
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
              background: 'rgba(17, 24, 39, 0.96)',
              backdropFilter: 'blur(8px)',
              color: '#f8fafc',
              border: '1.5px solid #c5a880',
              borderRadius: '14px',
              padding: '10px 14px',
              boxShadow: '0 14px 40px rgba(0, 0, 0, 0.45)',
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
                  background: 'linear-gradient(135deg, #c5a880 0%, #a38252 100%)',
                  color: '#111827',
                  fontSize: '11px',
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  letterSpacing: '0.4px',
                  whiteSpace: 'nowrap',
                }}
              >
                🧪 MODO DEMO (Sessão Isolada Salva)
              </span>
              <span style={{ fontSize: '12px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                {user ? (
                  <>
                    Ativo:{' '}
                    <strong style={{ color: '#fff' }}>
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
                background: !ehAdminAtual && user ? '#2563eb' : 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border:
                  !ehAdminAtual && user
                    ? '1px solid #60a5fa'
                    : '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: loadingAction ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              👤 Visão Cliente
            </button>

            <button
              type="button"
              disabled={loadingAction}
              onClick={handleVisaoAdmin}
              style={{
                background: ehAdminAtual ? '#b45309' : 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: ehAdminAtual
                  ? '1px solid #fbbf24'
                  : '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: loadingAction ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🛠️ Painel Admin
            </button>

            {usuariosAtivos.length > 0 && (
              <select
                aria-label="Selecionar conta da sessão Demo"
                value={user?.id || ''}
                disabled={loadingAction}
                onFocus={atualizarStatusDemo}
                onChange={handleSelecionarUsuario}
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: '8px',
                  padding: '6px 9px',
                  fontSize: '12px',
                  fontWeight: 600,
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
                background: 'rgba(197, 168, 128, 0.18)',
                color: '#f3e3c9',
                border: '1px solid rgba(197, 168, 128, 0.5)',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              💡 Guia & Cupons
            </button>

            <button
              type="button"
              disabled={loadingAction}
              onClick={() => setModalResetAberto(true)}
              style={{
                background: 'rgba(239, 68, 68, 0.14)',
                color: '#fecaca',
                border: '1px solid rgba(248, 113, 113, 0.45)',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: loadingAction ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🔄 Resetar Demo
            </button>

            <button
              type="button"
              disabled={loadingAction}
              onClick={abrirPortaoTrocaModo}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px 11px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🚪 Trocar Modo
            </button>

            <button
              type="button"
              onClick={() => setMinimizado(true)}
              aria-label="Minimizar barra Demo"
              title="Recolher barra do Modo Demo"
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                padding: '6px 9px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ▼
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
              color: '#1e293b',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                💡 Guia Rápido e Dados de Teste (Modo Demo)
              </h2>
              <button
                type="button"
                onClick={() => setModalGuiaAberto(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 11px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.55, marginTop: 0 }}>
              Tudo o que você criar ou editar nesta sessão fica salvo apenas para você. Use os
              códigos e cartões abaixo para testar todo o fluxo:
            </p>

            {/* Cupons e Vales */}
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '16px 0 8px' }}>
              🎟️ Cupons e Vales-Compra Disponíveis na Sessão
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
                      borderRadius: '10px',
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
                            fontWeight: 900,
                            fontSize: '13.5px',
                            color: item.cor,
                            background: '#fff',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${item.border}`,
                          }}
                        >
                          {item.codigo}
                        </code>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.titulo}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                        {item.detalhe}
                        {saldoStr}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiarTexto(item.codigo, item.codigo)}
                      style={{
                        background: copiadoChave === item.codigo ? '#15803d' : '#0f172a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
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
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '18px 0 8px' }}>
              💳 Cartão de Crédito de Teste (Checkout Simulado)
            </h3>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#334155',
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
                    background: copiadoChave === 'CARTAO' ? '#15803d' : '#1e293b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
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
              <div style={{ color: '#0369a1', fontWeight: 600, marginTop: '4px' }}>
                💡 No Checkout, você também encontra um botão para preencher estes dados com 1
                clique!
              </div>
            </div>

            {/* Roteiro de Validação */}
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '18px 0 8px' }}>
              📋 Sugestões do que testar
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                gap: '10px',
                fontSize: '12.5px',
                color: '#334155',
                lineHeight: 1.55,
              }}
            >
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <strong style={{ color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                  👤 Na Visão Cliente:
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
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <strong style={{ color: '#92400e', display: 'block', marginBottom: '4px' }}>
                  🛠️ No Painel Admin:
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
            background: 'rgba(15, 23, 42, 0.72)',
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
              background: '#fff',
              color: '#1e293b',
              borderRadius: '14px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: '#b91c1c' }}>
              🔄 Resetar Sessão Demo?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
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
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
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
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 800,
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
