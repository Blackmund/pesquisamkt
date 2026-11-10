import React, { useEffect, useRef, useState } from 'react';

export const go = (path) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
};
export function Link({ to, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        go(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

// Original mark for this product: a rounded square with a dot, plus the name.
export function Mark({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size * 1.4} height={size} viewBox="0 0 34 24" aria-hidden="true">
      <rect x="0" y="0" width="34" height="24" rx="7" fill={color} />
      <circle cx="12" cy="12" r="4.2" fill="#fff" />
      <rect x="19" y="9.5" width="9" height="5" rx="2.5" fill="#fff" />
    </svg>
  );
}
export function Logo({ size = 20, text = true, className = '' }) {
  return (
    <span className={'logo ' + className}>
      <Mark size={size} />
      {text && <span className="logo-text">Formaria</span>}
    </span>
  );
}

// ---------- language ----------
const LANGS = [
  ['en', 'English'],
  ['pt', 'Português'],
  ['es', 'Español'],
];
export const T = {
  en: {
    q: 'Have a question?',
    contact: 'Contact us',
    login: 'Log in',
    loginSub: 'Build forms, gather responses, and automate your workflows.',
    google: 'Continue with Google',
    microsoft: 'Continue with Microsoft',
    email: 'Email',
    contEmail: 'Continue with email',
    sso: 'Log in with SSO',
    noAcc: "Don't have an account?",
    signup: 'Sign up',
    already: 'Already have an account?',
    signupTitle: 'Sign up today. Start with a form, end with a conversation.',
    sgoogle: 'Sign up with Google',
    smicrosoft: 'Sign up with Microsoft',
    or: 'OR',
    semail: 'Sign up with email',
    password: 'Password',
    name: 'Name',
    create: 'Create my free account',
    agree: 'I agree to the Terms of Service and Privacy Policy',
    explore: 'Continue exploring powerful features that make data collection effortless',
  },
  pt: {
    q: 'Tem alguma dúvida?',
    contact: 'Fale conosco',
    login: 'Entrar',
    loginSub: 'Crie formulários, colete respostas e automatize seus fluxos.',
    google: 'Continuar com o Google',
    microsoft: 'Continuar com a Microsoft',
    email: 'E-mail',
    contEmail: 'Continuar com e-mail',
    sso: 'Entrar com SSO',
    noAcc: 'Não tem uma conta?',
    signup: 'Criar conta',
    already: 'Já tem uma conta?',
    signupTitle: 'Cadastre-se hoje. Comece com um formulário, termine com uma conversa.',
    sgoogle: 'Cadastrar com o Google',
    smicrosoft: 'Cadastrar com a Microsoft',
    or: 'OU',
    semail: 'Cadastrar com e-mail',
    password: 'Senha',
    name: 'Nome',
    create: 'Criar minha conta',
    agree: 'Concordo com os Termos de Uso e a Política de Privacidade',
    explore: 'Continue explorando recursos que tornam a coleta de dados simples',
  },
  es: {
    q: '¿Tienes alguna pregunta?',
    contact: 'Contáctanos',
    login: 'Iniciar sesión',
    loginSub: 'Crea formularios, reúne respuestas y automatiza tus flujos.',
    google: 'Continuar con Google',
    microsoft: 'Continuar con Microsoft',
    email: 'Correo',
    contEmail: 'Continuar con correo',
    sso: 'Iniciar sesión con SSO',
    noAcc: '¿No tienes una cuenta?',
    signup: 'Regístrate',
    already: '¿Ya tienes una cuenta?',
    signupTitle: 'Regístrate hoy. Empieza con un formulario, termina con una conversación.',
    sgoogle: 'Registrarse con Google',
    smicrosoft: 'Registrarse con Microsoft',
    or: 'O',
    semail: 'Registrarse con correo',
    password: 'Contraseña',
    name: 'Nombre',
    create: 'Crear mi cuenta',
    agree: 'Acepto los Términos y la Política de Privacidad',
    explore: 'Sigue explorando funciones que facilitan la recogida de datos',
  },
};
export function useLang() {
  const [lang, setLang] = useState(() => localStorage.getItem('formaria.lang') || 'en');
  useEffect(() => {
    const f = () => setLang(localStorage.getItem('formaria.lang') || 'en');
    window.addEventListener('formaria-lang', f);
    return () => window.removeEventListener('formaria-lang', f);
  }, []);
  return [T[lang] || T.en, lang];
}
const setLang = (l) => {
  localStorage.setItem('formaria.lang', l);
  window.dispatchEvent(new Event('formaria-lang'));
};

export const Globe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </svg>
);
export const Chevron = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function LangMenu() {
  const [, lang] = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const f = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
  const label = LANGS.find((l) => l[0] === lang)?.[1] || 'English';
  return (
    <div className="lang" ref={ref}>
      <button type="button" className="lang-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Globe />
        <span>{label}</span>
        <Chevron />
      </button>
      {open && (
        <ul className="lang-list" role="listbox">
          {LANGS.map(([k, v]) => (
            <li key={k}>
              <button
                type="button"
                role="option"
                aria-selected={k === lang}
                onClick={() => {
                  setLang(k);
                  setOpen(false);
                }}
              >
                {v}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- brand buttons ----------
export const GoogleG = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
export const MsLogo = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
    <rect x="0" y="0" width="10" height="10" fill="#F25022" />
    <rect x="12" y="0" width="10" height="10" fill="#7FBA00" />
    <rect x="0" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);

// ---------- cookie consent ----------
const CATS = [
  ['privacy', 'Your Privacy', null],
  ['necessary', 'Strictly Necessary Cookies', 'always'],
  ['analytics', 'Analytics Cookies', false],
  ['ads', 'Advertising and profiling cookies', false],
  ['functional', 'Functional Cookies', false],
];
const CAT_TEXT = {
  privacy: [
    'When you visit a website, it may store or read information in your browser, mostly as cookies. This can be about you, your preferences or your device, and is mostly used to make the site work the way you expect. It usually does not identify you directly, but it can give you a more personal experience.',
    'Because we respect your right to privacy, you can choose not to allow some kinds of cookies. Pick a category on the left to learn more and change the defaults. Blocking some cookies may change how the site works for you.',
  ],
  necessary: ['These cookies keep the site working and cannot be switched off. They are set in response to things you do, such as signing in or filling in forms.'],
  analytics: ['These cookies count visits and traffic sources so we can measure and improve how the site performs.'],
  ads: ['These cookies may be set by advertising partners to build a profile of your interests and show relevant ads elsewhere.'],
  functional: ['These cookies enable extra features and personalisation, such as remembering your language.'],
};

export function Cookies() {
  const [shown, setShown] = useState(() => !localStorage.getItem('formaria.cookies'));
  const [prefs, setPrefs] = useState(false);
  const accept = (v) => {
    localStorage.setItem('formaria.cookies', JSON.stringify(v));
    setShown(false);
    setPrefs(false);
  };
  return (
    <>
      {shown && (
        <div className="cookie" role="dialog" aria-label="Cookie consent">
          <div className="cookie-text">
            <h2>Cookie consent</h2>
            <p>
              We use our own and third-party cookies to show you more relevant content based on your browsing and navigation history. Please accept or manage your cookie settings below. Here's our{' '}
              <a href="/to/dwk6gt/">cookie policy</a>
            </p>
          </div>
          <div className="cookie-actions">
            <button type="button" className="cookie-accept" onClick={() => accept({ all: true })}>
              Accept all cookies
            </button>
            <button type="button" className="cookie-settings" aria-haspopup="dialog" onClick={() => setPrefs(true)}>
              Cookie settings
            </button>
          </div>
        </div>
      )}
      {prefs ? (
        <PrefCentre onClose={() => setPrefs(false)} onSave={accept} />
      ) : (
        <div hidden aria-hidden="true">
          <h2>Cookie Preference Centre</h2>
          <h2>Cookie Preference Centre</h2>
          {CATS.map((c) => (
            <h3 key={c[0]}>{c[1]}</h3>
          ))}
          <h3>Cookie List</h3>
        </div>
      )}
    </>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function PrefCentre({ onClose, onSave }) {
  const [tab, setTab] = useState('privacy');
  const [vals, setVals] = useState({ analytics: false, ads: false, functional: false });
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onClose]);
  const cat = CATS.find((c) => c[0] === tab);
  const body = (
    <>
      <div className="pc-title">
        <h3>{cat[1]}</h3>
        {cat[2] === 'always' && <span className="pc-always">Always Active</span>}
        {cat[2] === false && <Toggle label={cat[1]} on={vals[tab]} onChange={(v) => setVals({ ...vals, [tab]: v })} />}
      </div>
      {CAT_TEXT[tab].map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {tab === 'privacy' && <a href="/to/dwk6gt/">More information about your privacy</a>}
    </>
  );
  return (
    <div className="pc-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pc" role="dialog" aria-modal="true" aria-label="Cookie Preference Centre">
        <div className="pc-head">
          <span className="pc-logo">
            <Mark size={32} color="#3c323e" />
            <span>Formaria</span>
          </span>
          <h2 className="pc-h-desk">COOKIE PREFERENCE CENTRE</h2>
          <button type="button" className="pc-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <h2 className="pc-h-mob">Cookie Preference Centre</h2>
        <div className="pc-body">
          <ul className="pc-tabs" role="tablist">
            {CATS.map(([k, label]) => (
              <React.Fragment key={k}>
                <li>
                  <button type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                    {label}
                  </button>
                </li>
                {tab === k && <li className="pc-inline">{body}</li>}
              </React.Fragment>
            ))}
          </ul>
          <div className="pc-content">{body}</div>
        </div>
        <div className="pc-foot">
          <button type="button" className="pc-dark" onClick={() => onSave({ all: false })}>
            Reject All
          </button>
          <button type="button" className="pc-outline" onClick={() => onSave({ all: true })}>
            Allow All
          </button>
          <button type="button" className="pc-dark pc-save" onClick={() => onSave(vals)}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// small reusable modal for the app
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="m-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'m-box' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="m-body">{children}</div>
      </div>
    </div>
  );
}
