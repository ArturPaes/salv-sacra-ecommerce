import { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useDemo } from '../../contexts/DemoContext';
import api from '../../services/api';
import '../../styles/institucional.css';

// Sem VITE_RECAPTCHA_SITE_KEY no .env usa a chave de TESTE do Google (sempre passa)
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

export default function ContatoPage() {
  const { isDemoMode } = useDemo() || {};
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' });
  const [configs, setConfigs] = useState({});
  const [token, setToken] = useState(null);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const captchaRef = useRef(null);

  useEffect(() => {
    api.get('/configuracoes/publicas')
      .then((res) => setConfigs(res.data || {}))
      .catch(() => {});
  }, [isDemoMode]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token && !isDemoMode) return;
    setErro('');
    setEnviando(true);
    try {
      await api.post('/contato', { ...form, recaptcha: token || (isDemoMode ? 'demo-bypass' : '') });
      setEnviado(true);
      setForm({ nome: '', email: '', telefone: '', mensagem: '' });
    } catch (err) {
      setEnviado(false);
      setErro(err.response?.data?.message || 'Não foi possível enviar. Tente novamente.');
    } finally {
      captchaRef.current?.reset();
      setToken(null);
      setEnviando(false);
    }
  };

  const pronto = (token || isDemoMode) && form.nome && form.email && form.mensagem && !enviando;
  const whatsappTexto = configs.contato_whatsapp || (isDemoMode ? '5548999990000' : '5548996205153');
  const telefoneTexto = configs.contato_telefone || (isDemoMode ? '(48) 99999-0000' : '48996205153');
  const emailTexto = configs.contato_email || (isDemoMode ? 'contato@demo.salvsacra.com.br' : 'salvsacra2@gmail.com');
  const enderecoTexto = configs.contato_endereco || (isDemoMode ? 'Tubarão/SC - Endereço Fictício de Demonstração (CEP 88701-000)' : 'Rua Manoel Antunes Corrêa, 2171 - Oficinas, Tubarão - SC');

  return (
    <div className="inst-page">
      <div className="inst-container">
        <h1 className="inst-title inst-title-left">Contato</h1>

        <div className="contato-layout">
          <div className="contato-info">
            <p className="contato-horario">Atendimento de segunda a sexta das 9h às 19h.</p>
            <ul>
              <li><span>📱</span> {whatsappTexto}</li>
              <li><span>📞</span> {telefoneTexto}</li>
              <li><span>✉️</span> {emailTexto}</li>
              <li><span>📍</span> {enderecoTexto}</li>
            </ul>
          </div>

          <form className="contato-form" onSubmit={handleSubmit}>
            <label htmlFor="nome">Nome completo</label>
            <input id="nome" name="nome" value={form.nome} onChange={handleChange} required />

            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />

            <label htmlFor="telefone">Telefone</label>
            <input id="telefone" name="telefone" value={form.telefone} onChange={handleChange} />

            <label htmlFor="mensagem">Mensagem</label>
            <textarea id="mensagem" name="mensagem" rows="5" value={form.mensagem} onChange={handleChange} required />

            {!isDemoMode && (
              <div className="contato-captcha">
                <ReCAPTCHA ref={captchaRef} sitekey={SITE_KEY} onChange={setToken} onExpired={() => setToken(null)} />
              </div>
            )}

            <button type="submit" className="contato-btn" disabled={!pronto}>{enviando ? 'Enviando…' : 'Enviar'}</button>
            {enviado && <p className="contato-ok">Mensagem enviada! Responderemos em breve.</p>}
            {erro && <p className="contato-ok" style={{ color: '#c62828' }}>{erro}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
