import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDemo } from '../contexts/DemoContext';
import logoImg from '../assets/logo.webp';

export default function AccessGateModal() {
  const {
    accessMode,
    isGateOpen,
    gateError,
    hasSavedDemoSession,
    loadingAction,
    entrarModoDemo,
    entrarModoReal,
    fecharPortao,
  } = useDemo();

  const navigate = useNavigate();
  const location = useLocation();

  const [mostrarFormReal, setMostrarFormReal] = useState(false);
  const [senhaReal, setSenhaReal] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroDemo, setErroDemo] = useState('');
  const [erroReal, setErroReal] = useState('');
  const [loadingTarget, setLoadingTarget] = useState(null); // 'demo' | 'real' | null
  const [confirmandoResetInicio, setConfirmandoResetInicio] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(null);

  const visivel = isGateOpen || !accessMode;

  useEffect(() => {
    if (!visivel) return;
    setErroDemo('');
    setErroReal('');
    setLoadingTarget(null);
    setConfirmandoResetInicio(false);

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [visivel]);

  if (!visivel) return null;

  const podeFechar = Boolean(accessMode);

  const handleEntrarDemo = async (reset = false) => {
    setErroDemo('');
    setErroReal('');
    setLoadingTarget('demo');
    try {
      await entrarModoDemo({ reset });
      if (
        location.pathname.startsWith('/admin') ||
        location.pathname.startsWith('/login') ||
        location.pathname.startsWith('/register') ||
        location.pathname.startsWith('/cadastro')
      ) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setErroDemo(
        err?.response?.data?.message ||
          'Não foi possível iniciar o Modo Demo. Verifique se o backend está em execução.',
      );
    } finally {
      setLoadingTarget(null);
    }
  };

  const handleEntrarReal = async (e) => {
    e.preventDefault();
    if (!senhaReal.trim()) {
      setErroReal('Informe a senha de acesso ao site oficial.');
      return;
    }

    setErroDemo('');
    setErroReal('');
    setLoadingTarget('real');
    try {
      await entrarModoReal(senhaReal.trim());
      setSenhaReal('');
      setMostrarFormReal(false);
      if (location.pathname.startsWith('/admin')) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setErroReal(
        err?.response?.data?.message ||
          'Senha incorreta. Para testar sem restrições, utilize o Modo Demo.',
      );
    } finally {
      setLoadingTarget(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="salv-access-gate-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background:
          'radial-gradient(circle at top center, rgba(42, 34, 22, 0.96) 0%, rgba(12, 13, 17, 0.98) 65%)',
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
        padding: 'clamp(20px, 4vw, 44px) 12px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '940px',
          margin: 'auto',
          position: 'relative',
          color: '#f8fafc',
        }}
      >
        {podeFechar && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={fecharPortao}
              disabled={loadingAction}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '999px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕ Voltar ao modo atual ({accessMode === 'demo' ? 'Modo Demo' : 'Loja Oficial'})
            </button>
          </div>
        )}

        {/* Cabeçalho com logo e boas-vindas */}
        <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '26px' }}>
          <img
            src={logoImg}
            alt="Salv Sacra"
            style={{
              height: 'clamp(88px, 11vw, 116px)',
              width: 'auto',
              objectFit: 'contain',
              margin: '0 auto 16px',
              display: 'block',
            }}
          />
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.6px',
              textTransform: 'uppercase',
              color: '#d4b483',
              marginBottom: '8px',
            }}
          >
            ✦ Vista a sua fé com elegância e propósito ✦
          </div>
          <h1
            id="salv-access-gate-title"
            style={{
              fontSize: 'clamp(22px, 3vw, 29px)',
              fontWeight: 800,
              margin: '0 0 8px',
              color: '#ffffff',
              letterSpacing: '-0.3px',
            }}
          >
            Escolha como deseja acessar a Salv Sacra
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#cbd5e1',
              maxWidth: '640px',
              margin: '0 auto',
              lineHeight: 1.55,
            }}
          >
            Nossa loja oficial está em fase final de validação. Para testar todo o sistema sem
            restrições — como <strong>Cliente</strong> e como <strong>Administrador</strong> —
            utilize o Ambiente Demo isolado.
          </p>
        </div>

        {gateError && !erroDemo && !erroReal && (
          <div
            style={{
              background: 'rgba(185, 28, 28, 0.22)',
              border: '1px solid rgba(248, 113, 113, 0.55)',
              color: '#fecaca',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '13.5px',
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            ⚠️ {gateError}
          </div>
        )}

        {/* Grade de Opções */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '20px',
            alignItems: 'stretch',
          }}
        >
          {/* Card 1: Versão Demo (Principal) */}
          <div
            style={{
              background: '#ffffff',
              color: '#111827',
              borderRadius: '16px',
              padding: 'clamp(18px, 3vw, 26px)',
              border: '2px solid #c5a880',
              boxShadow:
                hoverBtn === 'demo' && !loadingAction
                  ? '0 32px 72px rgba(0, 0, 0, 0.58), 0 0 0 2px rgba(197, 168, 128, 0.45)'
                  : '0 24px 60px rgba(0, 0, 0, 0.45)',
              transform:
                hoverBtn === 'demo' && !loadingAction
                  ? 'translateY(-6px) scale(1.02)'
                  : 'translateY(0) scale(1)',
              transition: 'transform 0.24s ease, box-shadow 0.24s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    letterSpacing: '0.5px',
                  }}
                >
                  AMBIENTE DE VALIDAÇÃO ISOLADO
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                  ✓ Recomendado
                </span>
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  margin: '0 0 10px',
                  color: '#0f172a',
                  lineHeight: 1.3,
                }}
              >
                Experimentar Versão Demo (Validação / Testes)
              </h2>

              <p
                style={{
                  fontSize: '13.5px',
                  color: '#475569',
                  lineHeight: 1.6,
                  margin: '0 0 14px',
                }}
              >
                Ambiente completo com catálogo real, onde pagamentos (PIX, Cartão e Vale-Compra) e
                fretes/rastreios são <strong>100% simulados</strong>.
              </p>

              <ul
                style={{
                  margin: '0 0 16px',
                  paddingLeft: '18px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: 1.65,
                }}
              >
                <li>
                  Alterne em 1 clique entre <strong>Visão Cliente</strong> e{' '}
                  <strong>Painel Admin</strong>. Barra flutuante expandível no lado inferior
                  direito, que contém também outras opções.
                </li>
                <li>
                  Crie contas, faça pedidos, edite produtos/estoque e gerencie devoluções livremente.
                </li>
                <li>
                  <strong>Privacidade total:</strong> suas movimentações ficam salvas exclusivamente
                  na sua sessão e nenhum outro avaliador as enxerga.
                </li>
              </ul>

              {hasSavedDemoSession && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#166534',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    lineHeight: 1.45,
                    marginBottom: '16px',
                  }}
                >
                  ✓ Sessão Demo salva encontrada neste navegador — suas movimentações anteriores
                  serão retomadas de onde você parou.
                </div>
              )}
            </div>

            <div>
              {erroDemo && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    marginBottom: '12px',
                  }}
                >
                  ⚠️ {erroDemo}
                </div>
              )}
              <button
                type="button"
                disabled={loadingAction}
                onClick={() => handleEntrarDemo(false)}
                onMouseEnter={() => setHoverBtn('demo')}
                onMouseLeave={() => setHoverBtn(null)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background:
                    hoverBtn === 'demo' && !loadingAction
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #111827 0%, #27272a 100%)',
                  color: '#f8fafc',
                  fontSize: '14.5px',
                  fontWeight: 800,
                  cursor: loadingAction && loadingTarget === 'demo' ? 'wait' : loadingAction ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)',
                  transition: 'background 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {loadingAction && loadingTarget === 'demo'
                  ? 'Preparando sua sessão isolada...'
                  : hasSavedDemoSession
                    ? '▶ Retomar Minha Sessão Demo'
                    : '▶ Entrar no Modo Demo Agora'}
              </button>

              {hasSavedDemoSession && !confirmandoResetInicio && (
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => setConfirmandoResetInicio(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    Ou iniciar uma sessão limpa do zero (Resetar Demo)
                  </button>
                </div>
              )}

              {hasSavedDemoSession && confirmandoResetInicio && (
                <div
                  style={{
                    marginTop: '10px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#9a3412',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <span>
                    Isso apagará os pedidos e contas de teste criados nesta sessão Demo. Deseja
                    continuar?
                  </span>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmandoResetInicio(false)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={loadingAction}
                      onClick={() => handleEntrarDemo(true)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#c2410c',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Confirmar e Resetar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Site Real Protegido por Senha */}
          <div
            style={{
              background: 'rgba(24, 26, 32, 0.9)',
              color: '#f1f5f9',
              borderRadius: '16px',
              padding: 'clamp(18px, 3vw, 26px)',
              border:
                (hoverBtn === 'real' || hoverBtn === 'real-submit') && !loadingAction
                  ? '1px solid rgba(197, 168, 128, 0.6)'
                  : '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow:
                (hoverBtn === 'real' || hoverBtn === 'real-submit') && !loadingAction
                  ? '0 28px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(197, 168, 128, 0.3)'
                  : '0 16px 40px rgba(0, 0, 0, 0.3)',
              transform:
                (hoverBtn === 'real' || hoverBtn === 'real-submit') && !loadingAction
                  ? 'translateY(-6px) scale(1.02)'
                  : 'translateY(0) scale(1)',
              transition: 'transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ marginBottom: '12px' }}>
                <span
                  style={{
                    background: 'rgba(148, 163, 184, 0.16)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '999px',
                    letterSpacing: '0.5px',
                  }}
                >
                  🔒 SITE REAL EM PERÍODO DE TESTES
                </span>
              </div>

              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  margin: '0 0 10px',
                  color: '#ffffff',
                  lineHeight: 1.3,
                }}
              >
                Acessar Loja Oficial (Acesso Restrito)
              </h2>

              <p
                style={{
                  fontSize: '13.5px',
                  color: '#cbd5e1',
                  lineHeight: 1.6,
                  margin: '0 0 16px',
                }}
              >
                O ambiente de produção está protegido por senha durante a etapa de testes para
                evitar compras acidentais ou alterações no catálogo oficial da loja.
              </p>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '12.5px',
                  color: '#94a3b8',
                  lineHeight: 1.5,
                  marginBottom: '18px',
                }}
              >
                Apenas administradores autorizados possuem a senha para desbloquear a loja oficial.
              </div>
            </div>

            {!mostrarFormReal ? (
              <button
                type="button"
                disabled={loadingAction}
                onClick={() => {
                  setErroReal('');
                  setMostrarFormReal(true);
                }}
                onMouseEnter={() => setHoverBtn('real')}
                onMouseLeave={() => setHoverBtn(null)}
                style={{
                  width: '100%',
                  padding: '13px 18px',
                  borderRadius: '10px',
                  border: '1px solid rgba(197, 168, 128, 0.55)',
                  background:
                    hoverBtn === 'real' && !loadingAction
                      ? 'rgba(197, 168, 128, 0.24)'
                      : 'rgba(197, 168, 128, 0.12)',
                  color: '#e6d3b3',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: loadingAction ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                }}
              >
                🔑 Entrar no Site Real (Solicitar Senha)
              </button>
            ) : (
              <form onSubmit={handleEntrarReal} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label
                  htmlFor="salv-real-store-password"
                  style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}
                >
                  Senha de Acesso ao Site Oficial
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="salv-real-store-password"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoFocus
                    value={senhaReal}
                    onChange={(e) => {
                      setSenhaReal(e.target.value);
                      if (erroReal) setErroReal('');
                    }}
                    placeholder="Digite a senha de acesso..."
                    style={{
                      width: '100%',
                      padding: '11px 68px 11px 12px',
                      borderRadius: '8px',
                      border: erroReal
                        ? '1px solid rgba(248, 113, 113, 0.85)'
                        : '1px solid rgba(255, 255, 255, 0.25)',
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {erroReal && (
                  <div
                    role="alert"
                    style={{
                      background: 'rgba(185, 28, 28, 0.26)',
                      border: '1px solid rgba(248, 113, 113, 0.65)',
                      color: '#fecaca',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      lineHeight: 1.4,
                    }}
                  >
                    ⚠️ {erroReal}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => {
                      setMostrarFormReal(false);
                      setSenhaReal('');
                      setErroReal('');
                    }}
                    style={{
                      padding: '11px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'transparent',
                      color: '#cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction}
                    onMouseEnter={() => setHoverBtn('real-submit')}
                    onMouseLeave={() => setHoverBtn(null)}
                    style={{
                      flex: 1,
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: hoverBtn === 'real-submit' && !loadingAction ? '#d4b890' : '#c5a880',
                      color: '#111827',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: loadingAction && loadingTarget === 'real' ? 'wait' : loadingAction ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {loadingAction && loadingTarget === 'real' ? 'Verificando...' : 'Desbloquear Loja Oficial'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
