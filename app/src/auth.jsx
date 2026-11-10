import React, { useEffect, useState } from 'react';
import { Logo, Mark, LangMenu, Cookies, GoogleG, MsLogo, Link, go, useLang } from './shared.jsx';
import { save, db } from './store.js';
import { validEmail } from './br.js';

const WS_PATH = '/accounts/01M71R2K5KHS11H3M65ZEYW6ME/workspaces/2TWMSF';

function signIn(email, name) {
  save((d) => {
    d.session = { email: email || 'voce@exemplo.com', name: name || (email ? email.split('@')[0] : 'Você'), at: Date.now() };
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

// Placeholder artwork for the carousel: shapes and gradients, no photos.
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

export function Login() {
  const [t] = useLang();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [sso, setSso] = useState(false);
  useEffect(() => {
    document.title = 'Formaria';
  }, []);
  const submit = (e) => {
    e.preventDefault();
    if (step === 'email') {
      if (!validEmail(email)) return setErr('Please enter a valid email address.');
      setErr('');
      setStep(sso ? 'sso' : 'password');
      return;
    }
    if (step === 'password' && pw.length < 1) return setErr('Enter your password.');
    signIn(email);
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
            <h1>{sso ? 'Log in with SSO' : t.login}</h1>
            <p className="l-sub">{t.loginSub}</p>
            {!sso && (
              <>
                <button type="button" className="oauth" onClick={() => signIn('', 'Google user')}>
                  <GoogleG />
                  <span>{t.google}</span>
                </button>
                <button type="button" className="oauth" onClick={() => signIn('', 'Microsoft user')}>
                  <MsLogo />
                  <span>{t.microsoft}</span>
                </button>
              </>
            )}
            <label className="l-label" htmlFor="email">
              {t.email}
            </label>
            <input id="email" name="email" type="email" autoComplete="email" className="l-input" value={email} onChange={(e) => setEmail(e.target.value)} />
            {step === 'password' && (
              <>
                <label className="l-label" htmlFor="pw">
                  {t.password}
                </label>
                <input id="pw" type="password" autoFocus autoComplete="current-password" className="l-input" value={pw} onChange={(e) => setPw(e.target.value)} />
              </>
            )}
            {err && <p className="l-err">{err}</p>}
            <button type="submit" className="l-primary">
              {step === 'email' ? t.contEmail : t.login}
            </button>
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
    </div>
  );
}

export function Signup() {
  const [t] = useLang();
  const [mode, setMode] = useState('choose');
  const [f, setF] = useState({ name: '', email: '', pw: '', agree: false });
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Please tell us your name.');
    if (!validEmail(f.email)) return setErr('Please enter a valid email address.');
    if (f.pw.length < 8) return setErr('Use at least 8 characters for your password.');
    if (!f.agree) return setErr('Please accept the terms to continue.');
    signIn(f.email, f.name);
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
              <button type="button" className="oauth" onClick={() => signIn('', 'Google user')}>
                <GoogleG />
                <span>{t.sgoogle}</span>
              </button>
              <button type="button" className="oauth" onClick={() => signIn('', 'Microsoft user')}>
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
              <input id="sn" className="l-input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <label className="l-label" htmlFor="se">
                {t.email}
              </label>
              <input id="se" type="email" className="l-input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <label className="l-label" htmlFor="sp">
                {t.password}
              </label>
              <input id="sp" type="password" className="l-input" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />
              <label className="s-check">
                <input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /> {t.agree}
              </label>
              {err && <p className="l-err">{err}</p>}
              <button type="submit" className="l-primary">
                {t.create}
              </button>
              <button type="button" className="l-link" onClick={() => setMode('choose')}>
                ←
              </button>
            </form>
          )}
        </main>
      </div>
      <Cookies />
    </div>
  );
}

export function Logout() {
  useEffect(() => {
    save((d) => {
      d.session = null;
    });
    const t = setTimeout(() => go('/login'), 3000);
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
