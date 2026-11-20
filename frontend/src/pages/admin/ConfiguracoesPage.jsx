import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getConfiguracoesAdmin, updateConfiguracoesAdmin } from '../../services/configuracaoService';
import { uploadArquivoImagem } from '../../services/uploadService';
import { useDemo } from '../../contexts/DemoContext';
import { useAuth } from '../../contexts/AuthContext';
import { alterarSenha } from '../../services/contaService';
import PasswordStrengthMeter, { IconEye, PasswordConfirmMatch, avaliarSenha } from '../../components/PasswordStrengthMeter';
import api from '../../services/api';
import bannerSaoJose from '../../assets/banner-sao-jose.jpg';
import bannerDesatadora from '../../assets/banner-desatadora.jpg';
import bannerPorVoce from '../../assets/banner-por-voce.jpg';
import bannerSaoJoseMobile from '../../assets/banner-sao-jose-mobile.jpg';
import bannerDesatadoraMobile from '../../assets/banner-desatadora-mobile.jpg';
import bannerPorVoceMobile from '../../assets/banner-por-voce-mobile.jpg';
import '../../styles/admin.css';
import CuponsAdmin from './CuponsAdmin';
import LoadingSpinner from '../../components/LoadingSpinner';

const DEFAULT_CARROSSEL_SLIDES = [
  {
    id: 1,
    tag: 'Camiseta Regular Fit',
    title: 'São José',
    cta: 'Saiba mais',
    image: '',
    image_mobile: '',
    tema: 'claro',
    produto_id: '',
  },
  {
    id: 2,
    tag: 'Camiseta Regular Fit',
    title: 'Desatadora',
    cta: 'Saiba mais',
    image: '',
    image_mobile: '',
    tema: 'escuro',
    produto_id: '',
  },
  {
    id: 3,
    tag: 'Camiseta Oversized',
    title: 'Por Você',
    cta: 'Saiba mais',
    image: '',
    image_mobile: '',
    tema: 'claro',
    produto_id: '',
  },
];

const FALLBACK_BANNER_IMGS = [bannerSaoJose, bannerDesatadora, bannerPorVoce];
const FALLBACK_BANNER_MOBILE_IMGS = [bannerSaoJoseMobile, bannerDesatadoraMobile, bannerPorVoceMobile];

export default function ConfiguracoesPage() {
  const { isDemoMode } = useDemo();
  const { user } = useAuth();
  const [form, setForm] = useState({
    // Loja
    nome_loja: '',
    slogan_loja: '',

    // Frete & Avisos
    frete_gratis_minimo: '',
    cep_origem: '88702-280',
    melhor_envio_ambiente: 'production',
    melhor_envio_token: '',
    melhor_envio_sandbox_token: '',
    aviso_topo_texto: '',
    aviso_topo_ativo: '1',

    // PIX & Pagamentos
    mercadopago_access_token: '',
    mercadopago_public_key: '',
    cartao_gateway_modo: 'mercadopago',
    cartao_parcelas_max: '6',
    cartao_parcela_minima: '50.00',
    pix_chave: '',
    pix_beneficiario: '',
    pix_cidade: '',
    pix_desconto_pct: '',

    // Atendimento & Contato
    contato_email: '',
    contato_telefone: '',
    contato_whatsapp: '',
    contato_endereco: '',
    instagram_url: '',

    // Carrossel da Home (JSON)
    carrossel_slides: '',
  });

  const [slidesCarrossel, setSlidesCarrossel] = useState(DEFAULT_CARROSSEL_SLIDES);
  const [produtosLista, setProdutosLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });

  // Estado do formulário de alteração de senha do Administrador
  const [senhaForm, setSenhaForm] = useState({
    senha_atual: '',
    password: '',
    password_confirmation: '',
  });
  const [showSenha, setShowSenha] = useState({
    atual: false,
    nova: false,
    conf: false,
  });
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState({ tipo: '', texto: '' });

  const [searchParams, setSearchParams] = useSearchParams();
  const abasValidas = ['loja', 'carrossel', 'frete', 'pagamento', 'cupons', 'contato', 'seguranca'];
  const [abaAtiva, setAbaAtiva] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('aba');
    return p && abasValidas.includes(p) ? p : 'loja';
  });

  useEffect(() => {
    const p = searchParams.get('aba');
    if (p && abasValidas.includes(p) && p !== abaAtiva) {
      setAbaAtiva(p);
    }
  }, [searchParams]);

  const handleMudarAba = (novaAba) => {
    setAbaAtiva(novaAba);
    setSearchParams({ aba: novaAba });
  };

  useEffect(() => {
    carregarConfiguracoes();
    api.get('/produtos')
      .then((res) => setProdutosLista(res.data || []))
      .catch(() => setProdutosLista([]));
  }, []);

  const carregarConfiguracoes = async () => {
    setLoading(true);
    try {
      const { data } = await getConfiguracoesAdmin();
      if (data) {
        setForm((prev) => ({
          ...prev,
          ...data,
          ...(isDemoMode
            ? {
                melhor_envio_ambiente: 'sandbox',
                cartao_gateway_modo: 'simulacao',
              }
            : {}),
        }));
        if (data.carrossel_slides) {
          try {
            const parsed = JSON.parse(data.carrossel_slides);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSlidesCarrossel(parsed);
            }
          } catch {
            // mantém padrão
          }
        }
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Não foi possível carregar as configurações da loja.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSlideChange = (idx, campo, valor) => {
    setSlidesCarrossel((prev) => {
      const novo = [...prev];
      novo[idx] = { ...novo[idx], [campo]: valor };
      return novo;
    });
  };

  const handleAdicionarSlide = () => {
    setSlidesCarrossel((prev) => [
      ...prev,
      {
        id: Date.now(),
        tag: 'Nova Coleção',
        title: 'Título do Slide',
        cta: 'Saiba mais',
        image: '',
        image_mobile: '',
        tema: 'claro',
        produto_id: '',
      },
    ]);
  };

  const handleRemoverSlide = (idx) => {
    if (slidesCarrossel.length <= 1) {
      alert('O carrossel precisa ter pelo menos 1 slide.');
      return;
    }
    setSlidesCarrossel((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setFeedback({ tipo: '', texto: '' });

    try {
      const payload = {
        ...form,
        carrossel_slides: JSON.stringify(slidesCarrossel),
      };
      await updateConfiguracoesAdmin(payload);
      window.dispatchEvent(new Event('salv-config-atualizadas'));
      try {
        localStorage.setItem('salv_sync_trigger', String(Date.now()));
      } catch {
        // ignore storage errors
      }
      setFeedback({ tipo: 'sucesso', texto: 'Configurações atualizadas com sucesso!' });
      setTimeout(() => setFeedback({ tipo: '', texto: '' }), 4000);
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao salvar as configurações.' });
    } finally {
      setSalvando(false);
    }
  };

  const handleAlterarSenhaAdmin = async (e) => {
    e.preventDefault();
    setMsgSenha({ tipo: '', texto: '' });

    if (!avaliarSenha(senhaForm.password).isValid) {
      setMsgSenha({ tipo: 'erro', texto: 'A nova senha deve atender a todos os requisitos mínimos de segurança.' });
      return;
    }

    if (senhaForm.password !== senhaForm.password_confirmation) {
      setMsgSenha({ tipo: 'erro', texto: 'A confirmação da nova senha não confere.' });
      return;
    }

    setSalvandoSenha(true);
    try {
      const { data } = await alterarSenha(senhaForm);
      setSenhaForm({ senha_atual: '', password: '', password_confirmation: '' });
      setMsgSenha({ tipo: 'sucesso', texto: data?.message || 'Senha alterada com sucesso.' });
    } catch (err) {
      const errs = err?.response?.data?.errors;
      const primeiro = errs ? Object.values(errs)[0]?.[0] : null;
      setMsgSenha({
        tipo: 'erro',
        texto: primeiro || err?.response?.data?.message || 'Não foi possível alterar a senha.',
      });
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <div className="admin-page">
      {/* ── Topo do Painel de Configurações ── */}
      <div className="admin-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="admin-title">Configurações da Loja</h1>
          <p style={{ color: '#777', fontSize: '14px', marginTop: '4px' }}>
            Personalize informações de contato, banner de frete grátis, chave PIX e dados gerais do e-commerce.
          </p>
        </div>

        {abaAtiva !== 'cupons' && abaAtiva !== 'seguranca' && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || salvando}
            className="admin-btn admin-btn-primary"
          >
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        )}
      </div>

      {isDemoMode && (
        <div
          style={{
            background: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '22px',
            color: '#1e3a8a',
            fontSize: '13.5px',
            lineHeight: 1.55,
          }}
        >
          <strong style={{ display: 'block', marginBottom: '3px' }}>
            🛡️ Modo Demo Ativo — Dados e Credenciais Protegidas
          </strong>
          Os tokens de API (Mercado Pago, Melhor Envio) e informações de remetente exibidos nesta
          sessão são valores fictícios exclusivos de sandbox. As credenciais reais e tokens de
          produção da Salv Sacra permanecem 100% ocultos e protegidos no servidor oficial.
        </div>
      )}

      {feedback.texto && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontWeight: 600,
          fontSize: '14px',
          background: feedback.tipo === 'sucesso' ? '#dcfce7' : '#fee2e2',
          color: feedback.tipo === 'sucesso' ? '#15803d' : '#b91c1c',
          border: `1px solid ${feedback.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {feedback.texto}
        </div>
      )}

      {/* ── Abas de Navegação das Configurações ── */}
      <div
        className="admin-tabs-scroll"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e5e7eb',
          marginBottom: '28px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {[
          { id: 'loja', label: 'Identidade da Loja' },
          { id: 'carrossel', label: 'Carrossel da Vitrine' },
          { id: 'frete', label: 'Frete & Banner de Topo' },
          { id: 'pagamento', label: 'Pagamentos & PIX' },
          { id: 'cupons', label: 'Cupons de Desconto' },
          { id: 'contato', label: 'Atendimento & Contato' },
          { id: 'seguranca', label: 'Segurança & Senha' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleMudarAba(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: 700,
              color: abaAtiva === tab.id ? '#111' : '#64748b',
              borderBottom: abaAtiva === tab.id ? '2px solid #111' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '60px' }}>
          <LoadingSpinner size="md" />
        </div>
      ) : abaAtiva === 'cupons' ? (
        <div className="admin-config-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', padding: '32px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <CuponsAdmin />
        </div>
      ) : abaAtiva === 'seguranca' ? (
        <div className="admin-config-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', padding: '32px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px', alignItems: 'start' }}>
            {/* Coluna Esquerda: Formulário de Alteração de Senha */}
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e1e1e', margin: '0 0 6px' }}>
                Segurança da Conta Administradora
              </h2>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.55 }}>
                Altere a senha de acesso ao painel administrativo. Ao salvar, outras sessões autenticadas em outros dispositivos serão desconectadas automaticamente.
              </p>

              {msgSenha.texto && (
                <div
                  style={{
                    padding: '12px 15px',
                    borderRadius: '8px',
                    marginBottom: '18px',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    background: msgSenha.tipo === 'sucesso' ? '#dcfce7' : '#fee2e2',
                    color: msgSenha.tipo === 'sucesso' ? '#15803d' : '#b91c1c',
                    border: `1px solid ${msgSenha.tipo === 'sucesso' ? '#bbf7d0' : '#fecaca'}`,
                  }}
                >
                  {msgSenha.texto}
                </div>
              )}

              <form onSubmit={handleAlterarSenhaAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="admin-senha-atual" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '7px' }}>
                    Senha atual *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="admin-senha-atual"
                      type={showSenha.atual ? 'text' : 'password'}
                      value={senhaForm.senha_atual}
                      onChange={(e) => setSenhaForm((f) => ({ ...f, senha_atual: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '11px 42px 11px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      aria-label={showSenha.atual ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                      onClick={() => setShowSenha((s) => ({ ...s, atual: !s.atual }))}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'inline-flex', width: '20px', height: '20px', padding: 0 }}
                    >
                      <IconEye open={showSenha.atual} />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-nova-senha" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '7px' }}>
                    Nova senha *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="admin-nova-senha"
                      type={showSenha.nova ? 'text' : 'password'}
                      value={senhaForm.password}
                      onChange={(e) => setSenhaForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      placeholder="Mínimo de 8 caracteres"
                      style={{ width: '100%', padding: '11px 42px 11px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      aria-label={showSenha.nova ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                      onClick={() => setShowSenha((s) => ({ ...s, nova: !s.nova }))}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'inline-flex', width: '20px', height: '20px', padding: 0 }}
                    >
                      <IconEye open={showSenha.nova} />
                    </button>
                  </div>
                  <PasswordStrengthMeter password={senhaForm.password} />
                </div>

                <div>
                  <label htmlFor="admin-conf-senha" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '7px' }}>
                    Confirmar nova senha *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="admin-conf-senha"
                      type={showSenha.conf ? 'text' : 'password'}
                      value={senhaForm.password_confirmation}
                      onChange={(e) => setSenhaForm((f) => ({ ...f, password_confirmation: e.target.value }))}
                      required
                      placeholder="Repita a nova senha"
                      style={{ width: '100%', padding: '11px 42px 11px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      aria-label={showSenha.conf ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                      onClick={() => setShowSenha((s) => ({ ...s, conf: !s.conf }))}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'inline-flex', width: '20px', height: '20px', padding: 0 }}
                    >
                      <IconEye open={showSenha.conf} />
                    </button>
                  </div>
                  <PasswordConfirmMatch password={senhaForm.password} confirmation={senhaForm.password_confirmation} />
                </div>

                <div style={{ paddingTop: '6px' }}>
                  <button
                    type="submit"
                    disabled={salvandoSenha}
                    className="admin-btn admin-btn-primary"
                  >
                    {salvandoSenha ? 'Atualizando senha...' : 'Alterar Senha do Admin'}
                  </button>
                </div>
              </form>
            </div>

            {/* Coluna Direita: Resumo da Conta Administradora e Proteções Ativas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Administrador Logado
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e1e1e', marginTop: '4px' }}>
                    {user?.name || 'Administrador'}
                  </div>
                  <div style={{ fontSize: '13.5px', color: '#475569', marginTop: '2px' }}>
                    {user?.email || ''}
                  </div>
                </div>
                {isDemoMode && (
                  <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                    Isolado nesta Sessão Demo
                  </span>
                )}
              </div>

              <div
                style={{
                  background: '#faf9f6',
                  border: '1px solid #e5e2dc',
                  borderRadius: '10px',
                  padding: '18px 20px',
                  color: '#44403c',
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e1e1e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Proteções Ativas na Troca de Senha
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Confirmação obrigatória da senha atual antes de qualquer alteração.</li>
                  <li>Validação automática de força mínima (8+ caracteres, maiúscula, minúscula e número).</li>
                  <li>Encerramento imediato de sessões ativas em outros navegadores/dispositivos após salvar.</li>
                  <li>Independência entre o e-mail de login do administrador e o servidor SMTP de envio de e-mails da loja.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="admin-config-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eaeaea', padding: '32px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          {/* ════════ ABA 1: IDENTIDADE DA LOJA ════════ */}
          {abaAtiva === 'loja' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#333' }}>
                    Nome da Loja
                  </label>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Onde aparece: título da logo no cabeçalho, rodapé da loja (Quem somos e Copyright) e cabeçalho/rodapé dos e-mails.
                  </span>
                </div>
                <input
                  type="text"
                  name="nome_loja"
                  value={form.nome_loja}
                  onChange={handleChange}
                  placeholder="Ex: Salv Sacra"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#333' }}>
                    Slogan ou Frase Institucional
                  </label>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Onde aparece: rodapé da loja (em Quem somos e na barra de Copyright) e cabeçalho/rodapé de todos os e-mails enviados.
                  </span>
                </div>
                <input
                  type="text"
                  name="slogan_loja"
                  value={form.slogan_loja}
                  onChange={handleChange}
                  placeholder="Ex: Vestindo a Fé com Elegância"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* ════════ ABA 2: FRETE & BANNER DE TOPO ════════ */}
          {abaAtiva === 'frete' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    CEP de Origem da Loja (Centro de Distribuição)
                  </label>
                  <input
                    type="text"
                    name="cep_origem"
                    value={form.cep_origem || '88702-280'}
                    onChange={handleChange}
                    placeholder={isDemoMode ? 'Ex: 88701-000' : 'Ex: 88702-280'}
                    style={{ width: '100%', maxWidth: '400px', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                  <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '6px' }}>
                    Utilizado como ponto de partida no cálculo do frete (Ex: Tubarão/SC).
                  </span>
                </div>
              </div>

              <div style={{ background: '#fafafa', padding: '18px 20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px', color: '#111' }}>
                  Integração com Melhor Envio (Cotação de Frete & Logística)
                </h4>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Ambiente Ativo do Melhor Envio
                  </label>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {!isDemoMode && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="radio"
                          name="melhor_envio_ambiente"
                          value="production"
                          checked={form.melhor_envio_ambiente !== 'sandbox'}
                          onChange={handleChange}
                        />
                        🟢 Produção Oficial (Frete Real)
                      </label>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="radio"
                        name="melhor_envio_ambiente"
                        value="sandbox"
                        checked={isDemoMode || form.melhor_envio_ambiente === 'sandbox'}
                        onChange={handleChange}
                      />
                      🧪 Sandbox (Ambiente de Testes Gratuito)
                    </label>
                  </div>
                  <span style={{ display: 'block', fontSize: '12px', color: '#666', marginTop: '6px' }}>
                    {isDemoMode
                      ? 'No Ambiente Demo apenas o modo Sandbox fica ativo para proteger as integrações reais.'
                      : (
                        <>
                          Em <strong>Produção</strong>, conecta em <code>melhorenvio.com.br</code>. Em <strong>Sandbox</strong>, conecta em <code>sandbox.melhorenvio.com.br</code> com saldo e postagens fictícias.
                        </>
                      )}
                  </span>
                </div>

                {(isDemoMode || form.melhor_envio_ambiente === 'sandbox') ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#b45309', marginBottom: '6px' }}>
                      Token de Sandbox (sandbox.melhorenvio.com.br)
                    </label>
                    <input
                      type="password"
                      name="melhor_envio_sandbox_token"
                      value={form.melhor_envio_sandbox_token || ''}
                      onChange={handleChange}
                      placeholder="Cole aqui seu Token gerado na conta do Sandbox do Melhor Envio"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1.5px solid #f59e0b', fontSize: '14px', outline: 'none', background: '#fffbeb' }}
                    />
                    <span style={{ display: 'block', fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                      Obtenha criando uma conta gratuita em <strong>https://sandbox.melhorenvio.com.br</strong> (Painel &gt; Integrações &gt; Gerar Token). Seu token de produção permanece salvo intacto.
                    </span>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '6px' }}>
                      Token de Produção (melhorenvio.com.br)
                    </label>
                    <input
                      type="password"
                      name="melhor_envio_token"
                      value={form.melhor_envio_token || ''}
                      onChange={handleChange}
                      placeholder="Cole aqui seu Bearer Token Oficial do Melhor Envio"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                    />
                    <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '4px' }}>
                      Quando preenchido, cota os valores oficiais em tempo real para Correios SEDEX e PAC.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                  Texto do Banner de Avisos no Topo do Site
                </label>
                <input
                  type="text"
                  name="aviso_topo_texto"
                  value={form.aviso_topo_texto}
                  onChange={handleChange}
                  placeholder="Ex: ✦ FRETE GRÁTIS PARA COMPRAS ACIMA DE R$500 ✦"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 600, color: '#333', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.aviso_topo_ativo === '1'}
                    onChange={(e) => setForm((prev) => ({ ...prev, aviso_topo_ativo: e.target.checked ? '1' : '0' }))}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Exibir banner de aviso no topo da loja
                </label>
              </div>
            </div>
          )}

          {/* ════════ ABA 3: PAGAMENTOS & PIX ════════ */}
          {abaAtiva === 'pagamento' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ padding: '18px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#111' }}>
                  Credenciais do Gateway — Mercado Pago (PIX, Cartão de Crédito e Débito)
                </h3>
                <p style={{ margin: '0 0 18px', fontSize: '12px', color: '#64748b' }}>
                  Obtenha suas chaves em <strong>Mercado Pago Developers → Suas integrações → Credenciais</strong>. A mesma conta processa PIX, Crédito e Débito.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                      Access Token — Mercado Pago (Chave Privada)
                    </label>
                    <input
                      type="password"
                      name="mercadopago_access_token"
                      value={form.mercadopago_access_token || ''}
                      onChange={handleChange}
                      placeholder="Ex: APP_USR-123456789... ou TEST-123456789..."
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    />
                    <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      Usado no servidor para gerar o QR Code PIX e aprovar pagamentos por Cartão.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                      Public Key — Mercado Pago (Chave Pública)
                    </label>
                    <input
                      type="text"
                      name="mercadopago_public_key"
                      value={form.mercadopago_public_key || ''}
                      onChange={handleChange}
                      placeholder="Ex: APP_USR-987654321... ou TEST-987654321..."
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    />
                    <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      Usada para criptografar e tokenizar Cartões de Crédito e Débito com segurança.
                    </span>
                  </div>
                </div>
              </div>

              {/* Configurações de Cartão de Crédito */}
              <div style={{ padding: '18px 20px', background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#111' }}>
                  Cartão de Crédito (Mercado Pago)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                      Modo de Processamento do Cartão
                    </label>
                    <select
                      name="cartao_gateway_modo"
                      value={isDemoMode ? 'simulacao' : (form.cartao_gateway_modo || 'mercadopago')}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    >
                      {!isDemoMode && (
                        <option value="mercadopago">Produção — Mercado Pago API (Cobrança real no cartão)</option>
                      )}
                      <option value="simulacao">Simulação / Sandbox (Testes e cenários Mercado Pago)</option>
                    </select>
                    <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '6px' }}>
                      No modo Produção, o cartão é cobrado via Mercado Pago. No modo Simulação, você pode testar aprovações e erros usando as regras oficiais do Mercado Pago (ex.: titular APRO aprova, FUND recusa por saldo, SECU recusa por CVV, etc.).
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                      Parcelamento Máximo sem Juros
                    </label>
                    <select
                      name="cartao_parcelas_max"
                      value={form.cartao_parcelas_max || '6'}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={String(n)}>
                          Até {n}x sem juros
                        </option>
                      ))}
                    </select>
                    <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '6px' }}>
                      Aceita cartões de crédito e cartões múltiplos (à vista em 1x ou parcelado sem juros).
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                      Valor da Parcela Mínima (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      name="cartao_parcela_minima"
                      value={form.cartao_parcela_minima ?? '50.00'}
                      onChange={handleChange}
                      placeholder="50.00"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    />
                    <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '6px' }}>
                      Valor mínimo por parcela para o cálculo das opções de parcelamento no checkout (padrão: R$ 50,00).
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Chave PIX (Recebimento / Fallback EMV)
                  </label>
                  <input
                    type="text"
                    name="pix_chave"
                    value={form.pix_chave}
                    onChange={handleChange}
                    placeholder="E-mail, CPF/CNPJ ou Chave Aleatória"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Nome do Titular / Beneficiário PIX
                  </label>
                  <input
                    type="text"
                    name="pix_beneficiario"
                    value={form.pix_beneficiario}
                    onChange={handleChange}
                    placeholder="Ex: SALV SACRA ECOMMERCE"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Cidade do Titular
                  </label>
                  <input
                    type="text"
                    name="pix_cidade"
                    value={form.pix_cidade}
                    onChange={handleChange}
                    placeholder="Ex: Tubarão"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Desconto para Pagamento com PIX (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    name="pix_desconto_pct"
                    value={form.pix_desconto_pct}
                    onChange={handleChange}
                    placeholder="Ex: 5"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                  <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '6px' }}>
                    Desconto aplicado automaticamente na finalização de compra via PIX.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ════════ ABA 4: ATENDIMENTO & CONTATO ════════ */}
          {abaAtiva === 'carrossel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111' }}>
                    Slides do Carrossel Principal (Página Inicial)
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>
                    Configure a foto de fundo de cada slide, os textos exibidos e para qual camiseta o botão &quot;Saiba mais&quot; deve levar o cliente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAdicionarSlide}
                  style={{
                    background: '#f3f4f6',
                    color: '#111',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + ADICIONAR SLIDE
                </button>
              </div>

              {slidesCarrossel.map((slide, idx) => {
                const previewImg = slide.image?.trim() || FALLBACK_BANNER_IMGS[idx % FALLBACK_BANNER_IMGS.length];
                const previewImgMobile = slide.image_mobile?.trim() || FALLBACK_BANNER_MOBILE_IMGS[idx] || '';
                return (
                  <div
                    key={slide.id || idx}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '20px',
                      background: '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '18px',
                    }}
                  >
                    {/* Cabeçalho do Card de Carrossel */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#111' }}>
                        Slide #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoverSlide(idx)}
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Apagar Carrossel
                      </button>
                    </div>

                    <div className="admin-carousel-slide-body">
                      {/* Preview da Foto (Coluna Esquerda) */}
                      <div>
                        <div
                          style={{
                            width: '100%',
                            height: '155px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: '#e5e7eb',
                            border: '1px solid #d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}
                        >
                          <img
                            src={previewImg}
                            alt={`Slide ${idx + 1} Desktop`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.68)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                            Desktop
                          </span>
                        </div>

                        {previewImgMobile && (
                          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '72px',
                                height: '90px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: '#e5e7eb',
                                border: '1px solid #d1d5db',
                                flexShrink: 0,
                                position: 'relative',
                              }}
                            >
                              <img
                                src={previewImgMobile}
                                alt={`Slide ${idx + 1} Mobile`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>
                                Mobile
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                              Imagem específica para celulares ativa (até 768px).
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Campos do Slide (Coluna Direita) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '6px' }}>
                          Foto do Banner (Desktop)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              background: '#1e1e1e',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📁 Escolher Foto Desktop
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  try {
                                    const url = await uploadArquivoImagem(e.target.files[0]);
                                    handleSlideChange(idx, 'image', url);
                                  } catch (err) {
                                    alert(err.response?.data?.message || 'Erro ao enviar a imagem.');
                                  }
                                }
                              }}
                              style={{ display: 'none' }}
                            />
                          </label>

                          {slide.image && (
                            <button
                              type="button"
                              onClick={() => handleSlideChange(idx, 'image', '')}
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Remover foto desktop
                            </button>
                          )}

                          {slide.image && (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Arquivo atual: <strong>{slide.image.split('/').pop()}</strong>
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          value={slide.image || ''}
                          onChange={(e) => handleSlideChange(idx, 'image', e.target.value)}
                          placeholder="Ou cole a URL direta da imagem desktop aqui (ou deixe vazio para foto padrão)"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', background: '#fff', color: '#555' }}
                        />
                      </div>

                      <div style={{ paddingTop: '10px', borderTop: '1px dashed #e5e7eb' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '4px' }}>
                          Foto do Banner — Mobile (Opcional · Recomendado 4:5 ou 1:1)
                        </label>
                        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b' }}>
                          Se preenchida, substitui a foto do desktop em celulares (até 768px) para evitar cortes laterais nos modelos.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              background: '#334155',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            📱 Escolher Foto Mobile
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  try {
                                    const url = await uploadArquivoImagem(e.target.files[0]);
                                    handleSlideChange(idx, 'image_mobile', url);
                                  } catch (err) {
                                    alert(err.response?.data?.message || 'Erro ao enviar a imagem mobile.');
                                  }
                                }
                              }}
                              style={{ display: 'none' }}
                            />
                          </label>

                          {slide.image_mobile && (
                            <button
                              type="button"
                              onClick={() => handleSlideChange(idx, 'image_mobile', '')}
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Remover foto mobile
                            </button>
                          )}

                          {slide.image_mobile && (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Mobile atual: <strong>{slide.image_mobile.split('/').pop()}</strong>
                            </span>
                          )}
                        </div>

                        <input
                          type="text"
                          value={slide.image_mobile || ''}
                          onChange={(e) => handleSlideChange(idx, 'image_mobile', e.target.value)}
                          placeholder="Opcional: URL da imagem mobile (vazio = usa a imagem desktop)"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', background: '#fff', color: '#555' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '6px' }}>
                            Título Principal
                          </label>
                          <input
                            type="text"
                            value={slide.title || ''}
                            onChange={(e) => handleSlideChange(idx, 'title', e.target.value)}
                            placeholder="Ex: São José"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', background: '#fff' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '6px' }}>
                            Subtítulo / Tag Superior
                          </label>
                          <input
                            type="text"
                            value={slide.tag || ''}
                            onChange={(e) => handleSlideChange(idx, 'tag', e.target.value)}
                            placeholder="Ex: Camiseta Regular Fit"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', background: '#fff' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '6px' }}>
                            Cor do Texto / Tema
                          </label>
                          <select
                            value={slide.tema || 'claro'}
                            onChange={(e) => handleSlideChange(idx, 'tema', e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', background: '#fff' }}
                          >
                            <option value="claro">Claro (Texto Branco)</option>
                            <option value="escuro">Escuro (Texto Escuro)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#333', marginBottom: '6px' }}>
                          Produto de destino do botão &quot;Saiba mais&quot;
                        </label>
                        <select
                          value={slide.produto_id || ''}
                          onChange={(e) => handleSlideChange(idx, 'produto_id', e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="">Catálogo Geral de Camisetas (/produtos?categoria=camisetas)</option>
                          {produtosLista.map((prod) => (
                            <option key={prod.id} value={String(prod.id)}>
                              {prod.nome} — Reg: R$ {Number(prod.preco_base || 0).toFixed(2).replace('.', ',')} / Over: R$ {Number(prod.preco_oversized ?? prod.preco_base ?? 0).toFixed(2).replace('.', ',')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {abaAtiva === 'contato' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    E-mail Oficial de Atendimento
                  </label>
                  <input
                    type="email"
                    name="contato_email"
                    value={form.contato_email}
                    onChange={handleChange}
                    placeholder={isDemoMode ? 'Ex: contato@demo.salvsacra.com.br' : 'Ex: salvsacra2@gmail.com'}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    name="contato_telefone"
                    value={form.contato_telefone}
                    onChange={handleChange}
                    placeholder={isDemoMode ? 'Ex: (48) 99999-0000' : 'Ex: (48) 99620-5153'}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    WhatsApp (somente números com DDD/DDI)
                  </label>
                  <input
                    type="text"
                    name="contato_whatsapp"
                    value={form.contato_whatsapp}
                    onChange={handleChange}
                    placeholder={isDemoMode ? 'Ex: 5548999990000' : 'Ex: 5548996205153'}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                  <span style={{ display: 'block', fontSize: '12px', color: '#888', marginTop: '6px' }}>
                    Usado para o link direto de conversa do WhatsApp no rodapé.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                    Perfil do Instagram
                  </label>
                  <input
                    type="url"
                    name="instagram_url"
                    value={form.instagram_url}
                    onChange={handleChange}
                    placeholder="Ex: https://instagram.com/salvsacra"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
                  Endereço Físico Exibido no Rodapé
                </label>
                <input
                  type="text"
                  name="contato_endereco"
                  value={form.contato_endereco}
                  onChange={handleChange}
                  placeholder={isDemoMode ? 'Ex: Tubarão/SC - Endereço Fictício de Demonstração' : 'Ex: Rua Manoel Antunes Corrêa, 2171 - Bairro Oficinas, Tubarão - SC'}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Botão de Rodapé do Formulário */}
          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={salvando}
              className="admin-btn admin-btn-primary"
            >
              {salvando ? 'Salvando Alterações...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
