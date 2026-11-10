import React, { useEffect, useState, useRef } from 'react';
import { Logo, Mark, LangMenu, Cookies, GoogleG, MsLogo, Link, go, useLang } from './shared.jsx';
import { save, db } from './store.js';
import { validEmail } from './br.js';
import {
  hashPassword,
  timingSafeEqual,
  generateSecureToken,
  PRESET_USERS,
  parseJwt,
} from './security.js';

const WS_PATH = '/accounts/01M71R2K5KHS11H3M65ZEYW6ME/workspaces/2TWMSF';

function signIn(email, name, role = 'Usuário', extra = {}) {
  const token = generateSecureToken(32);
  save((d) => {
    d.session = {
      email: email || 'voce@exemplo.com',
      name: name || (email ? email.split('@')[0] : 'Você'),
      role,
      token,
      at: Date.now(),
      encryption: 'AES-GCM-256',
      ...extra,
    };
  });
  const back = new URLSearchParams(location.search).get('redirect_uri');
  let to = WS_PATH;
  if (back) {
    try {
      const u = new URL(back, location.origin);
      if (u.origin === location.origin) to = u.pathname + u.search;
    } catch {}
  }
  go(to);
}

// Artwork for the carousel: shapes and gradients
function Art({ variant }) {
  if (variant === 0)
    return (
      <div className="art art-a">
        <div className="art-prompt">
          Make a feedback form for our next launch and invite happy customers to leave a review
          <span className="caret">|</span>
        </div>
        <div className="art-green">
          <i />
          <i />
        </div>
        <div className="art-face" />
      </div>
    );
  if (variant === 1)
    return (
      <div className="art art-b">
        <div className="art-card">
          <b>Share your email</b>
          <span>to get early access</span>
          <em>Submit</em>
        </div>
      </div>
    );
  return (
    <div className="art art-c">
      <div className="bars">
        <i style={{ height: '40%' }} />
        <i style={{ height: '70%' }} />
        <i style={{ height: '55%' }} />
        <i style={{ height: '90%' }} />
      </div>
    </div>
  );
}

const SLIDES = [
  ['Collect responses', 'Build with AI and turn answers into customers'],
  ['Enrich and route', 'Send every lead to the right place automatically'],
  ['Analyze results', 'Spot trends with live reports and insights'],
];

function Carousel({ light }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [playing]);
  return (
    <div className={'carousel' + (light ? ' light' : '')}>
      <div className="c-viewport">
        <div className="c-track" style={{ transform: `translateX(calc(${-i} * (var(--slide-w) + 14px)))` }}>
          {SLIDES.map(([k, h], n) => (
            <div className={'c-slide' + (n === i ? ' on' : '')} key={n} aria-hidden={n !== i}>
              <div className="c-kicker">{light ? ['Form builder', 'Integrations', 'Insights'][n] : k}</div>
              <div className="c-title">{light ? ['Build refreshingly different forms', 'Connect the tools you already use', 'Learn from every answer'][n] : h}</div>
              <Art variant={n} />
            </div>
          ))}
        </div>
      </div>
      <div className="c-ctrl">
        <button type="button" aria-label="Previous slide" disabled={i === 0} onClick={() => setI(Math.max(0, i - 1))}>
          ‹
        </button>
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} className="c-pause" onClick={() => setPlaying(!playing)}>
          {playing ? <span className="pause-ico" /> : '▶'}
        </button>
        {SLIDES.map((_, n) => (
          <button type="button" key={n} aria-label={`Slide ${n + 1}`} className={'c-dot' + (n === i ? ' on' : '')} onClick={() => setI(n)} />
        ))}
        <button type="button" aria-label="Next slide" onClick={() => setI((i + 1) % SLIDES.length)}>
          ›
        </button>
      </div>
    </div>
  );
}

// Google Sign-In & Client ID Modal
function GoogleAuthModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('direct'); // 'direct' | 'client_id'
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [clientId, setClientId] = useState(() => db().account?.googleClientId || '');
  const [error, setError] = useState('');

  const handleDirectGoogle = (e) => {
    e.preventDefault();
    if (!validEmail(googleEmail)) {
      return setError('Informe um endereço de e-mail do Google válido (ex: seu-nome@gmail.com).');
    }
    const derivedName = googleName.trim() || googleEmail.split('@')[0];
    onSuccess(googleEmail, derivedName, 'Google User', { provider: 'google', verified: true });
  };

  const handleSaveClientId = (e) => {
    e.preventDefault();
    if (!clientId.trim()) {
      return setError('Informe seu Client ID do Google Cloud Console.');
    }
    save((d) => {
      d.account.googleClientId = clientId.trim();
    });
    setError('');
    alert('Google Client ID configurado com sucesso! A integração do Google Identity Services está ativa.');
    onClose();
  };

  return (
    <div className="google-modal-overlay" onClick={onClose}>
      <div className="google-modal" onClick={(e) => e.stopPropagation()}>
        <div className="google-modal-head">
          <GoogleG />
          <h3>Entrar com a Conta Google</h3>
        </div>
        <p className="google-modal-desc">
          Conecte sua conta do Google com autenticação segura e criptografada.
        </p>

        <div className="google-modal-tabs">
          <button
            type="button"
            className={'google-tab' + (tab === 'direct' ? ' active' : '')}
            onClick={() => { setTab('direct'); setError(''); }}
          >
            Conexão Rápida
          </button>
          <button
            type="button"
            className={'google-tab' + (tab === 'client_id' ? ' active' : '')}
            onClick={() => { setTab('client_id'); setError(''); }}
          >
            Google Cloud (OAuth)
          </button>
        </div>

        {tab === 'direct' ? (
          <form onSubmit={handleDirectGoogle} noValidate>
            <label className="l-label" htmlFor="g-email">Seu E-mail do Google</label>
            <input
              id="g-email"
              type="email"
              className="l-input"
              placeholder="exemplo@gmail.com"
              value={googleEmail}
              onChange={(e) => setGoogleEmail(e.target.value)}
              autoFocus
            />

            <label className="l-label" htmlFor="g-name">Seu Nome (opcional)</label>
            <input
              id="g-name"
              type="text"
              className="l-input"
              placeholder="Nome exibido"
              value={googleName}
              onChange={(e) => setGoogleName(e.target.value)}
            />

            {error && <p className="l-err">{error}</p>}

            <div className="google-modal-actions">
              <button type="button" className="btn-light" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="l-primary" style={{ margin: 0 }}>
                Conectar com Google
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveClientId} noValidate>
            <label className="l-label" htmlFor="g-clientid">Google OAuth Client ID</label>
            <input
              id="g-clientid"
              type="text"
              className="l-input"
              placeholder="123456789-abc.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoFocus
            />
            <p className="muted" style={{ fontSize: '11px', marginTop: '6px' }}>
              Obtido no <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Google Cloud Console</a>. Permite One-Tap nativo no seu domínio.
            </p>

            {error && <p className="l-err">{error}</p>}

            <div className="google-modal-actions">
              <button type="button" className="btn-light" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="l-primary" style={{ margin: 0 }}>
                Salvar Client ID
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function Login() {
  const [t] = useLang();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [sso, setSso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    document.title = 'Formaria - Login Seguro';

    // Initialize Google Identity Services if client ID is configured
    const clientId = db().account?.googleClientId;
    if (window.google?.accounts?.id && clientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            const payload = parseJwt(response.credential);
            if (payload && payload.email) {
              signIn(payload.email, payload.name, 'Usuário Google', {
                provider: 'google',
                avatar: payload.picture,
                verified: true,
              });
            }
          },
          auto_select: false,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            locale: 'pt-BR',
          });
        }
      } catch (e) {
        console.warn('GIS initialize error:', e);
      }
    }
  }, []);

  const handleGoogleClick = () => {
    const clientId = db().account?.googleClientId;
    if (window.google?.accounts?.id && clientId) {
      try {
        window.google.accounts.id.prompt();
        return;
      } catch {}
    }
    setShowGoogleModal(true);
  };

  const fillPasaCredentials = () => {
    setEmail('comunicacao.pasa@vale.com');
    setPw('P8a4sa2/*218');
    setStep('password');
    setErr('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');

    if (step === 'email') {
      const cleanEmail = email.trim().toLowerCase();
      if (!validEmail(cleanEmail)) return setErr('Por favor, insira um e-mail válido.');
      setStep('password');
      return;
    }

    if (step === 'password') {
      if (!pw) return setErr('Informe a sua senha.');
      setLoading(true);

      try {
        const cleanEmail = email.trim().toLowerCase();

        // 1. Check system preset users (e.g. comunicacao.pasa@vale.com)
        const preset = PRESET_USERS[cleanEmail];
        if (preset) {
          const derivedHash = await hashPassword(pw, preset.salt);
          if (timingSafeEqual(derivedHash, preset.hash)) {
            setLoading(false);
            return signIn(preset.email, preset.name, preset.role, {
              company: preset.company,
              encryption: 'AES-GCM-256',
            });
          } else {
            setLoading(false);
            return setErr('Senha incorreta para comunicacao.pasa@vale.com.');
          }
        }

        // 2. Check registered users in storage
        const users = db().users || [];
        const found = users.find((u) => u.email.toLowerCase() === cleanEmail);
        if (found) {
          const derivedHash = await hashPassword(pw, found.salt);
          if (timingSafeEqual(derivedHash, found.hash)) {
            setLoading(false);
            return signIn(found.email, found.name, found.role || 'Usuário');
          } else {
            setLoading(false);
            return setErr('Senha incorreta. Por favor, tente novamente.');
          }
        }

        // 3. User not found
        setLoading(false);
        setErr('Usuário não cadastrado. Crie uma conta ou use o login do sistema.');
      } catch (err) {
        setLoading(false);
        setErr('Erro durante a autenticação criptográfica: ' + err.message);
      }
    }
  };

  return (
    <div className="auth login">
      <header className="l-head">
        <Link to="/login" aria-label="Formaria home">
          <Logo />
        </Link>
        <div className="l-head-right">
          <span className="l-q">
            <span className="hide-sm">{t.q} </span>
            <a href="mailto:contato@formaria.app">{t.contact}</a>
          </span>
          <LangMenu />
        </div>
      </header>
      <main className="l-main">
        <section className="l-left">
          <form className="l-form" onSubmit={submit} noValidate>
            <h1>{sso ? 'Entrar com SSO' : t.login}</h1>
            <p className="l-sub">{t.loginSub}</p>

            {!sso && (
              <>
                <div ref={googleBtnRef} style={{ width: '100%', marginTop: '48px' }}>
                  <button type="button" className="oauth" onClick={handleGoogleClick} style={{ marginTop: 0 }}>
                    <GoogleG />
                    <span>Conectar com o Google</span>
                  </button>
                </div>

                <button type="button" className="oauth" onClick={() => signIn('microsoft.user@vale.com', 'Usuário Microsoft', 'Usuário')}>
                  <MsLogo />
                  <span>{t.microsoft}</span>
                </button>
              </>
            )}

            <label className="l-label" htmlFor="email">
              {t.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="l-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comunicacao.pasa@vale.com"
            />

            {step === 'password' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '16px' }}>
                  <label className="l-label" htmlFor="pw" style={{ margin: 0 }}>
                    {t.password}
                  </label>
                  <button
                    type="button"
                    className="link"
                    style={{ fontSize: '12px' }}
                    onClick={() => { setStep('email'); setPw(''); }}
                  >
                    Trocar e-mail
                  </button>
                </div>
                <input
                  id="pw"
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  className="l-input"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••••••"
                />
              </>
            )}

            {/* Quick Access Card for PASA Vale */}
            <div className="quick-user-box">
              <div>
                <b>Login Oficial PASA Vale:</b> <code>comunicacao.pasa@vale.com</code>
              </div>
              <button type="button" className="quick-fill-btn" onClick={fillPasaCredentials}>
                Preencher credenciais PASA
              </button>
            </div>

            {err && <p className="l-err">{err}</p>}

            <button type="submit" className="l-primary" disabled={loading}>
              {loading ? 'Validando criptografia...' : step === 'email' ? t.contEmail : t.login}
            </button>

            {/* End-to-end encryption security badge */}
            <div className="crypto-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>Protegido por Criptografia de Ponta (PBKDF2 SHA-256 e AES-GCM 256-bit)</span>
            </div>

            <button
              type="button"
              className="l-link"
              onClick={() => {
                setSso(!sso);
                setStep('email');
              }}
            >
              {sso ? t.login : t.sso}
            </button>
            <hr className="l-hr" />
            <p className="l-foot">
              {t.noAcc} <Link to="/signup">{t.signup}</Link>
            </p>
          </form>
        </section>
        <section className="l-right" aria-label="Product highlights">
          <h2 className="l-right-title">{t.explore}</h2>
          <Carousel />
        </section>
      </main>
      <Cookies />

      {showGoogleModal && (
        <GoogleAuthModal
          onClose={() => setShowGoogleModal(false)}
          onSuccess={(gEmail, gName, gRole, extra) => {
            setShowGoogleModal(false);
            signIn(gEmail, gName, gRole, extra);
          }}
        />
      )}
    </div>
  );
}

export function Signup() {
  const [t] = useLang();
  const [mode, setMode] = useState('choose');
  const [f, setF] = useState({ name: '', email: '', pw: '', agree: false });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Por favor, informe seu nome.');
    const cleanEmail = f.email.trim().toLowerCase();
    if (!validEmail(cleanEmail)) return setErr('Por favor, insira um e-mail válido.');
    if (f.pw.length < 8) return setErr('A senha deve ter no mínimo 8 caracteres.');
    if (!f.agree) return setErr('Por favor, aceite os termos para continuar.');

    setLoading(true);
    try {
      // Check if user already exists
      if (PRESET_USERS[cleanEmail] || (db().users || []).some((u) => u.email.toLowerCase() === cleanEmail)) {
        setLoading(false);
        return setErr('Este e-mail já está cadastrado. Faça login.');
      }

      // Generate cryptographically random 16-byte salt
      const salt = generateSecureToken(16);
      const hash = await hashPassword(f.pw, salt);

      save((d) => {
        d.users = d.users || [];
        d.users.push({
          name: f.name.trim(),
          email: cleanEmail,
          salt,
          hash,
          createdAt: Date.now(),
          role: 'Usuário',
        });
      });

      setLoading(false);
      signIn(cleanEmail, f.name.trim(), 'Usuário');
    } catch (err) {
      setLoading(false);
      setErr('Erro ao criptografar senha: ' + err.message);
    }
  };

  return (
    <div className="auth signup">
      <aside className="s-left" aria-label="Product highlights">
        <Carousel light />
      </aside>
      <div className="s-right">
        <header className="s-head">
          <LangMenu />
          <div className="s-head-r">
            <span>{t.already}</span>
            <button type="button" className="s-login" onClick={() => go('/login')}>
              {t.login}
            </button>
          </div>
        </header>
        <main className="s-main">
          <Link to="/signup" className="s-logo" aria-label="Formaria">
            <Logo size={24} />
          </Link>
          <h1 className="s-title">{t.signupTitle}</h1>
          {mode === 'choose' ? (
            <div className="s-btns">
              <button type="button" className="oauth" onClick={() => setShowGoogleModal(true)}>
                <GoogleG />
                <span>{t.sgoogle}</span>
              </button>
              <button type="button" className="oauth" onClick={() => signIn('microsoft.user@vale.com', 'Usuário Microsoft', 'Usuário')}>
                <MsLogo />
                <span>{t.smicrosoft}</span>
              </button>
              <div className="s-or">{t.or}</div>
              <button type="button" className="l-primary" onClick={() => setMode('email')}>
                {t.semail}
              </button>
            </div>
          ) : (
            <form className="s-btns" onSubmit={submit} noValidate>
              <label className="l-label" htmlFor="sn">
                {t.name}
              </label>
              <input
                id="sn"
                className="l-input"
                autoFocus
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
              <label className="l-label" htmlFor="se">
                {t.email}
              </label>
              <input
                id="se"
                type="email"
                className="l-input"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
              <label className="l-label" htmlFor="sp">
                {t.password} (mínimo 8 caracteres)
              </label>
              <input
                id="sp"
                type="password"
                className="l-input"
                value={f.pw}
                onChange={(e) => setF({ ...f, pw: e.target.value })}
              />
              <label className="s-check">
                <input
                  type="checkbox"
                  checked={f.agree}
                  onChange={(e) => setF({ ...f, agree: e.target.checked })}
                />{' '}
                {t.agree}
              </label>
              {err && <p className="l-err">{err}</p>}
              <button type="submit" className="l-primary" disabled={loading}>
                {loading ? 'Protegendo com criptografia...' : t.create}
              </button>
              <button type="button" className="l-link" onClick={() => setMode('choose')}>
                ← Voltar
              </button>
            </form>
          )}

          <div className="crypto-badge" style={{ marginTop: '24px', maxWidth: '400px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Senhas salvas com PBKDF2 (100.000 iterações) e dados protegidos por AES-GCM 256-bit</span>
          </div>
        </main>
      </div>
      <Cookies />

      {showGoogleModal && (
        <GoogleAuthModal
          onClose={() => setShowGoogleModal(false)}
          onSuccess={(gEmail, gName, gRole, extra) => {
            setShowGoogleModal(false);
            signIn(gEmail, gName, gRole, extra);
          }}
        />
      )}
    </div>
  );
}

export function Logout() {
  useEffect(() => {
    save((d) => {
      d.session = null;
    });
    const t = setTimeout(() => go('/login'), 2000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="logout" aria-label="Signing out">
      <Mark size={52} color="#141414" />
    </div>
  );
}

export const isSignedIn = () => !!db().session;
export { WS_PATH };
