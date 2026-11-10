import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Login, Signup, Logout } from './auth.jsx';
import { Legal } from './legal.jsx';
import { Dashboard, Account, TopBar, NewFormModal } from './dashboard.jsx';
import { ProjectPage } from './projects.jsx';
import { Builder } from './builder.jsx';
import { Fill } from './fill.jsx';
import { db, subscribe } from './store.js';
import { go } from './shared.jsx';

function useForceUpdate() {
  const [, set] = useState(0);
  useEffect(() => subscribe(() => set((x) => x + 1)), []);
}

function App() {
  const [path, setPath] = useState(location.pathname);
  useForceUpdate();
  useEffect(() => {
    const f = () => {
      setPath(location.pathname);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  const p = path.replace(/\/+$/, '') || '/';
  const needAuth = (el) => {
    if (db().session) return el;
    setTimeout(() => go('/login?redirect_uri=' + encodeURIComponent(location.href)), 0);
    return <Login />;
  };

  if (p === '/' || p === '/login') return <Login />;
  if (p === '/login/logout') return <Logout />;
  if (p === '/signup') return <Signup />;
  if (p === '/to/dwk6gt') return <Legal />;
  if (p === '/f') return <Fill />;
  if (p === '/builder') return needAuth(<Builder />);
  if (p === '/project') return needAuth(<ProjectPage TopBar={TopBar} NewFormModal={NewFormModal} />);
  if (p === '/account') return needAuth(<Account />);
  const m = p.match(/^\/accounts\/[^/]+\/workspaces\/([^/]+)$/);
  if (m) return needAuth(<Dashboard workspaceId={m[1]} />);
  if (p === '/workspace') return needAuth(<Dashboard />);
  return <Login />;
}

createRoot(document.getElementById('root')).render(<App />);
