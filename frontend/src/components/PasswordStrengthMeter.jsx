export function IconEye({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function avaliarSenha(password = '') {
  const pwd = typeof password === 'string' ? password : '';

  const requisitos = [
    { key: 'min8', label: 'Mínimo de 8 caracteres', met: pwd.length >= 8 },
    { key: 'upper', label: 'Letra Maiúscula', met: /[A-Z]/.test(pwd) },
    { key: 'lower', label: 'Letra minúscula', met: /[a-z]/.test(pwd) },
    { key: 'number', label: 'Número', met: /[0-9]/.test(pwd) },
  ];

  const cumpridos = requisitos.filter((r) => r.met).length;

  let nivel = {
    label: '',
    barColor: '#e2e8f0',
    badgeBg: '#f1f5f9',
    badgeText: '#64748b',
  };

  if (pwd.length > 0 && cumpridos <= 1) {
    nivel = {
      label: 'Fraca',
      barColor: '#dc2626',
      badgeBg: '#fee2e2',
      badgeText: '#b91c1c',
    };
  } else if (cumpridos === 2) {
    nivel = {
      label: 'Média',
      barColor: '#eab308',
      badgeBg: '#fef9c3',
      badgeText: '#a16207',
    };
  } else if (cumpridos === 3) {
    nivel = {
      label: 'Boa',
      barColor: '#4ade80',
      badgeBg: '#dcfce7',
      badgeText: '#15803d',
    };
  } else if (cumpridos === 4) {
    nivel = {
      label: 'Forte',
      barColor: '#15803d',
      badgeBg: '#bbf7d0',
      badgeText: '#14532d',
    };
  }

  return {
    requisitos,
    cumpridos,
    nivel,
    isValid: cumpridos === 4,
  };
}

export function PasswordConfirmMatch({ password = '', confirmation = '' }) {
  if (!confirmation) return null;
  const match = password === confirmation;
  return (
    <div
      role="status"
      style={{
        marginTop: '6px',
        fontSize: '12.5px',
        fontWeight: 600,
        color: match ? '#15803d' : '#dc2626',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span>{match ? '✓' : '✕'}</span>
      <span>{match ? 'As senhas conferem.' : 'As senhas não conferem.'}</span>
    </div>
  );
}

export default function PasswordStrengthMeter({ password = '' }) {
  const { requisitos, cumpridos, nivel } = avaliarSenha(password);

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '12px 14px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
          Força da senha
        </span>
        {nivel.label && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '2px 10px',
              borderRadius: '999px',
              background: nivel.badgeBg,
              color: nivel.badgeText,
            }}
          >
            {nivel.label}
          </span>
        )}
      </div>

      {/* Barra com 4 níveis */}
      <div
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '6px',
          marginBottom: '12px',
        }}
      >
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            style={{
              height: '6px',
              borderRadius: '999px',
              background: idx < cumpridos ? nivel.barColor : '#e2e8f0',
              transition: 'background-color 0.2s ease',
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
        Requisitos
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {requisitos.map((req) => (
          <li
            key={req.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12.5px',
              fontWeight: req.met ? 600 : 500,
              color: req.met ? '#166534' : '#dc2626',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 800,
                flexShrink: 0,
                background: req.met ? '#15803d' : '#fee2e2',
                color: req.met ? '#ffffff' : '#dc2626',
                border: req.met ? 'none' : '1px solid #fecaca',
              }}
            >
              {req.met ? '✓' : '✕'}
            </span>
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
