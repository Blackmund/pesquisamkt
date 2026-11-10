import React, { useEffect, useRef, useState } from 'react';
import { db, save, uid, newForm, newQuestion, formResponses } from './store.js';
import { Logo, Link, go, Modal } from './shared.jsx';
import { Home } from './projects.jsx';
import { projectsOf } from './analytics.js';

const ACC = '01M71R2K5KHS11H3M65ZEYW6ME';
export const wsPath = (id) => `/accounts/${ACC}/workspaces/${id}`;

function q(type, title, extra = {}) {
  return { ...newQuestion(type), title, ...extra };
}
function opts(...labels) {
  return labels.map((l) => ({ id: uid('o_'), label: l, score: 0, image: '' }));
}

export const TEMPLATES = [
  {
    name: 'Captura de leads',
    desc: 'Nome, WhatsApp, e-mail e interesse — com pixel e recuperação de abandono.',
    make: () => [
      q('short_text', 'Qual é o seu nome?', { required: true, ref: 'nome' }),
      q('phone', 'Qual é o seu WhatsApp, {{nome}}?', { required: true, ref: 'whatsapp' }),
      q('email', 'E o seu melhor e-mail?', { required: true }),
      q('multiple_choice', 'O que você procura?', { options: opts('Orçamento', 'Demonstração', 'Só conhecendo') }),
    ],
  },
  {
    name: 'Cadastro de cliente (Brasil)',
    desc: 'CPF ou CNPJ validados e endereço preenchido pelo CEP.',
    make: () => [
      q('short_text', 'Nome completo', { required: true, ref: 'nome' }),
      q('cpf', 'Qual é o seu CPF?', { required: true }),
      q('cnpj', 'CNPJ da empresa (se houver)'),
      q('cep', 'Endereço de entrega', { required: true }),
      q('phone', 'Telefone com DDD', { required: true }),
      q('legal', 'Você concorda com nossa política de privacidade?', { required: true }),
    ],
  },
  {
    name: 'Pesquisa NPS',
    desc: 'Mede a satisfação e pergunta o motivo da nota.',
    make: () => {
      const a = q('nps', 'De 0 a 10, quanto você recomendaria a gente para um amigo?', { required: true });
      const b = q('long_text', 'O que podemos melhorar?');
      const c = q('long_text', 'Que bom! O que você mais gosta?');
      a.logic = [
        { op: 'lte', value: '6', to: b.id },
        { op: 'gte', value: '7', to: c.id },
      ];
      b.logic = [{ op: 'always', value: '', to: 'end' }];
      return [a, b, c];
    },
  },
  {
    name: 'Quiz com pontuação',
    desc: 'Cada resposta vale pontos e o resultado aparece no final.',
    make: () => [
      q('multiple_choice', 'Quanto é 7 × 8?', { options: [{ id: uid('o_'), label: '54', score: 0 }, { id: uid('o_'), label: '56', score: 1 }, { id: uid('o_'), label: '58', score: 0 }] }),
      q('multiple_choice', 'Qual é a capital do Brasil?', { options: [{ id: uid('o_'), label: 'Brasília', score: 1 }, { id: uid('o_'), label: 'Rio de Janeiro', score: 0 }, { id: uid('o_'), label: 'São Paulo', score: 0 }] }),
    ],
    ending: { title: 'Você fez {{score}} ponto(s)!', description: 'Obrigado por participar.' },
  },
  {
    name: 'Inscrição em evento',
    desc: 'Dados do participante, data e envio de comprovante.',
    make: () => [
      q('short_text', 'Nome do participante', { required: true }),
      q('email', 'E-mail', { required: true }),
      q('dropdown', 'Qual sessão você vai assistir?', { options: opts('Manhã', 'Tarde', 'Noite') }),
      q('date', 'Data de nascimento'),
      q('file_upload', 'Envie o comprovante de pagamento'),
    ],
  },
  {
    name: 'Avaliação de atendimento',
    desc: 'Estrelas, escala e comentário.',
    make: () => [
      q('rating', 'Como você avalia nosso atendimento?', { required: true }),
      q('opinion_scale', 'O problema foi resolvido?', { settings: { from: 1, to: 5, left: 'Nada', right: 'Totalmente' } }),
      q('yes_no', 'Podemos entrar em contato?'),
      q('long_text', 'Deixe um comentário'),
    ],
  },
];

// Builds a first draft from a description, using keyword rules (works offline).
export function draftFromPrompt(text) {
  const t = text.toLowerCase();
  const out = [q('short_text', 'Qual é o seu nome?', { required: true, ref: 'nome' })];
  if (/mail|contato|lead|cadastro|inscri/.test(t)) out.push(q('email', 'Qual é o seu e-mail?', { required: true }));
  if (/whats|telefone|celular|lead|contato/.test(t)) out.push(q('phone', 'Qual é o seu WhatsApp?', { required: true }));
  if (/cpf|cadastro|cliente/.test(t)) out.push(q('cpf', 'Informe seu CPF'));
  if (/cnpj|empresa|b2b/.test(t)) out.push(q('cnpj', 'CNPJ da sua empresa'));
  if (/endere|entrega|cep/.test(t)) out.push(q('cep', 'Qual é o seu endereço?'));
  if (/nps|recomend|satisfa/.test(t)) out.push(q('nps', 'Quanto você nos recomendaria?', { required: true }));
  if (/avalia|feedback|opini|atendimento/.test(t)) out.push(q('rating', 'Como foi sua experiência?'));
  if (/evento|agend|reuni/.test(t)) out.push(q('date', 'Qual data é melhor para você?'));
  if (/curr[ií]culo|vaga|arquivo|document/.test(t)) out.push(q('file_upload', 'Envie seu arquivo'));
  if (/quiz|teste|pergunta/.test(t)) out.push(q('multiple_choice', 'Escolha a resposta certa', { options: opts('Alternativa A', 'Alternativa B', 'Alternativa C') }));
  out.push(q('long_text', 'Quer acrescentar algo?'));
  return out;
}

export function NewFormModal({ workspaceId, projectId = null, onClose }) {
  const [tab, setTab] = useState('scratch');
  const [prompt, setPrompt] = useState('');
  const create = (title, questions, ending) => {
    const f = newForm(workspaceId, title, questions);
    f.projectId = projectId;
    f.audience = '';
    if (ending) f.ending = { ...f.ending, ...ending };
    save((d) => d.forms.unshift(f));
    go(`/builder/?id=${f.id}`);
  };
  return (
    <Modal title="Criar um novo formulário" onClose={onClose} wide>
      <div className="seg">
        {[
          ['scratch', 'Começar do zero'],
          ['ai', 'Criar com IA'],
          ['tpl', 'Usar um modelo'],
          ['import', 'Importar perguntas'],
        ].map(([k, l]) => (
          <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'scratch' && (
        <div className="nf-pane">
          <p>Um formulário em branco, com todos os recursos liberados.</p>
          <button type="button" className="btn-dark" onClick={() => create('Meu formulário', [])}>
            Criar formulário em branco
          </button>
        </div>
      )}
      {tab === 'ai' && (
        <div className="nf-pane">
          <label className="fld">
            <span>Descreva o formulário que você quer</span>
            <textarea rows={4} value={prompt} placeholder="Ex.: formulário de cadastro de clientes com CPF, endereço e WhatsApp" onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <button type="button" className="btn-dark" disabled={!prompt.trim()} onClick={() => create(prompt.slice(0, 60), draftFromPrompt(prompt))}>
            Gerar rascunho
          </button>
          <p className="muted small">O rascunho é montado aqui mesmo a partir das palavras que você escreveu; depois é só ajustar.</p>
        </div>
      )}
      {tab === 'tpl' && (
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button type="button" key={t.name} className="tpl" onClick={() => create(t.name, t.make(), t.ending)}>
              <b>{t.name}</b>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'import' && <ImportPane create={create} />}
    </Modal>
  );
}

function ImportPane({ create }) {
  const [txt, setTxt] = useState('');
  const run = () => {
    const qs = txt
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const m = l.match(/^(.*?)\s*\[(.+)\]$/);
        if (m) return q('multiple_choice', m[1], { options: opts(...m[2].split('|').map((s) => s.trim())) });
        if (/e-?mail/i.test(l)) return q('email', l);
        if (/telefone|whats|celular/i.test(l)) return q('phone', l);
        if (/\bcpf\b/i.test(l)) return q('cpf', l);
        if (/\bcnpj\b/i.test(l)) return q('cnpj', l);
        if (/\bcep\b|endere/i.test(l)) return q('cep', l);
        return q('short_text', l);
      });
    create('Formulário importado', qs);
  };
  return (
    <div className="nf-pane">
      <label className="fld">
        <span>Cole uma pergunta por linha. Para opções use colchetes: Cor favorita [Azul | Verde | Rosa]</span>
        <textarea rows={7} value={txt} onChange={(e) => setTxt(e.target.value)} />
      </label>
      <button type="button" className="btn-dark" disabled={!txt.trim()} onClick={run}>
        Importar
      </button>
    </div>
  );
}

export function TopBar({ children }) {
  const s = db().session;
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const f = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
  return (
    <header className="app-top">
      <Link to={wsPath(db().workspaces[0]?.id || '2TWMSF')} aria-label="Início">
        <Logo />
      </Link>
      <div className="app-top-mid">{children}</div>
      <span className="plan-badge" title="Todos os recursos pagos estão liberados">
        ✦ Tudo liberado
      </span>
      <div className="acct" ref={ref}>
        <button type="button" className="avatar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          {(s?.name || 'V')[0].toUpperCase()}
        </button>
        {open && (
          <div className="menu" role="menu">
            <div className="menu-head">
              <b>{s?.name}</b>
              <span>{s?.email}</span>
            </div>
            <Link to="/account" role="menuitem">
              Conta, equipe e domínio
            </Link>
            <Link to="/to/dwk6gt/" role="menuitem">
              Termos e privacidade
            </Link>
            <Link to="/login/logout" role="menuitem">
              Sair
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

function FormCard({ f, view, workspaces }) {
  const [menu, setMenu] = useState(false);
  const [move, setMove] = useState(false);
  const resps = formResponses(f.id);
  const done = resps.filter((r) => r.completed).length;
  const ref = useRef();
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const dup = () =>
    save((d) => {
      const c = JSON.parse(JSON.stringify(f));
      c.id = uid('').slice(0, 8);
      c.title = f.title + ' (cópia)';
      c.createdAt = c.updatedAt = Date.now();
      d.forms.unshift(c);
    });
  const del = () => {
    if (!confirm(`Excluir "${f.title}" e todas as respostas?`)) return;
    save((d) => {
      d.forms = d.forms.filter((x) => x.id !== f.id);
      d.responses = d.responses.filter((r) => r.formId !== f.id);
    });
  };
  const rename = () => {
    const t = prompt('Novo nome', f.title);
    if (t) save(() => (f.title = t));
  };
  return (
    <div className={'fcard ' + view}>
      <button type="button" className="fcard-main" onClick={() => go(`/builder/?id=${f.id}`)} style={{ '--fc': f.theme.bg, '--ft': f.theme.question }}>
        <span className="fcard-thumb">
          <span>{f.title.slice(0, 1).toUpperCase()}</span>
        </span>
        <span className="fcard-title">{f.title}</span>
        <span className="fcard-meta">
          {done} {done === 1 ? 'resposta' : 'respostas'} · {f.published ? 'Publicado' : 'Rascunho'}
        </span>
      </button>
      <div className="fcard-menu" ref={ref}>
        <button type="button" className="icon-btn" aria-label="Mais opções" onClick={() => setMenu(!menu)}>
          ⋯
        </button>
        {menu && (
          <div className="menu right" role="menu">
            <button type="button" onClick={() => go(`/builder/?id=${f.id}`)}>Abrir</button>
            <button type="button" onClick={() => go(`/builder/?id=${f.id}&tab=results`)}>Ver respostas</button>
            <button type="button" onClick={() => go(`/builder/?id=${f.id}&tab=share`)}>Compartilhar</button>
            <button type="button" onClick={() => window.open(`/f/?id=${f.id}`, '_blank')}>Visualizar</button>
            <button type="button" onClick={rename}>Renomear</button>
            <button type="button" onClick={dup}>Duplicar</button>
            <button type="button" onClick={() => setMove(true)}>Mover para…</button>
            <button type="button" className="danger" onClick={del}>Excluir</button>
          </div>
        )}
      </div>
      {move && (
        <Modal title="Mover para outro espaço" onClose={() => setMove(false)}>
          {workspaces.map((w) => (
            <button
              type="button"
              key={w.id}
              className="list-btn"
              onClick={() => {
                save(() => (f.workspaceId = w.id));
                setMove(false);
              }}
            >
              {w.name} {w.id === f.workspaceId && '✓'}
            </button>
          ))}
        </Modal>
      )}
    </div>
  );
}

export function Dashboard({ workspaceId }) {
  const d = db();
  const ws = d.workspaces.find((w) => w.id === workspaceId) || d.workspaces[0];
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [view, setView] = useState(() => localStorage.getItem('formaria.view') || 'grid');
  const [side, setSide] = useState(false);
  useEffect(() => {
    document.title = `${ws?.name || 'Espaço'} · Formaria`;
  }, [ws]);
  if (!ws) return null;
  let forms = d.forms.filter((f) => f.workspaceId === ws.id && f.title.toLowerCase().includes(query.toLowerCase()));
  forms = forms.sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
  const addWs = () => {
    const n = prompt('Nome do novo espaço de trabalho');
    if (!n) return;
    const w = { id: uid('').slice(0, 6).toUpperCase(), name: n };
    save((x) => x.workspaces.push(w));
    go(wsPath(w.id));
  };
  const renameWs = () => {
    const n = prompt('Renomear espaço', ws.name);
    if (n) save(() => (ws.name = n));
  };
  const delWs = () => {
    if (d.workspaces.length < 2) return alert('Você precisa de pelo menos um espaço de trabalho.');
    if (!confirm(`Excluir o espaço "${ws.name}"? Os formulários vão para outro espaço.`)) return;
    save((x) => {
      x.workspaces = x.workspaces.filter((w) => w.id !== ws.id);
      x.forms.forEach((f) => f.workspaceId === ws.id && (f.workspaceId = x.workspaces[0].id));
    });
    go(wsPath(db().workspaces[0].id));
  };
  return (
    <div className="app">
      <TopBar>
        <button type="button" className="icon-btn side-toggle" aria-label="Espaços de trabalho" onClick={() => setSide(!side)}>
          ☰
        </button>
      </TopBar>
      <div className="dash">
        <aside className={'ws-side' + (side ? ' open' : '')}>
          <button type="button" className="btn-dark full" onClick={() => setCreating(true)}>
            + Criar novo formulário
          </button>
          <div className="ws-head">
            <span>Espaços de trabalho</span>
            <button type="button" className="icon-btn" aria-label="Novo espaço" onClick={addWs}>
              +
            </button>
          </div>
          <ul className="ws-list">
            {d.workspaces.map((w) => (
              <li key={w.id}>
                <Link to={wsPath(w.id)} className={w.id === ws.id ? 'on' : ''} onClick={() => setSide(false)}>
                  <span>{w.name}</span>
                  <em>{d.forms.filter((f) => f.workspaceId === w.id).length}</em>
                </Link>
              </li>
            ))}
          </ul>
          <div className="ws-head">
            <span>Projetos</span>
          </div>
          <ul className="ws-list">
            {projectsOf()
              .filter((p) => p.workspaceId === ws.id)
              .map((p) => (
                <li key={p.id}>
                  <Link to={`/project/?id=${p.id}`}>
                    <span>
                      <span className="dot" style={{ background: p.color }} /> {p.name}
                    </span>
                    <em>{d.forms.filter((f) => f.projectId === p.id).length}</em>
                  </Link>
                </li>
              ))}
          </ul>
          <div className="ws-promo">
            <b>Plano: tudo liberado</b>
            <span>Respostas ilimitadas, lógica, pixels, domínio próprio, equipe e todos os recursos sem custo.</span>
          </div>
        </aside>
        <main className="dash-main">
          <div className="dash-head">
            <h1>{ws.name}</h1>
            <div className="dash-ws-actions">
              <button type="button" className="btn-light" onClick={renameWs}>
                Renomear
              </button>
              <button type="button" className="btn-light" onClick={delWs}>
                Excluir espaço
              </button>
            </div>
          </div>
          <div className="dash-tools">
            <input className="search" type="search" placeholder="Buscar pesquisas" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar pesquisas" />
          </div>
          <Home ws={ws} query={query} onCreate={() => setCreating(true)} />
        </main>
      </div>
      {creating && <NewFormModal workspaceId={ws.id} onClose={() => setCreating(false)} />}
    </div>
  );
}

export function Account() {
  const d = db();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Editor');
  const acc = d.account;
  return (
    <div className="app">
      <TopBar />
      <main className="acc-main">
        <Link to={wsPath(d.workspaces[0].id)} className="back">
          ← Voltar aos formulários
        </Link>
        <h1>Conta</h1>
        <section className="panel">
          <h2>Plano</h2>
          <p>
            <b>Tudo liberado.</b> Respostas e formulários ilimitados, arquivos sem limite, sem a nossa marca, domínio próprio, times e permissões, pixels e todas as integrações.
          </p>
        </section>
        <section className="panel">
          <h2>Times e permissões</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/\S+@\S+/.test(email)) return;
              save(() => acc.members.push({ email, role, id: uid() }));
              setEmail('');
            }}
          >
            <input type="email" placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail do convidado" />
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Permissão">
              <option>Proprietário</option>
              <option>Editor</option>
              <option>Somente leitura</option>
            </select>
            <button className="btn-dark">Convidar</button>
          </form>
          <ul className="members">
            <li>
              <b>{d.session?.email}</b> <em>Proprietário</em>
            </li>
            {acc.members.map((m) => (
              <li key={m.id}>
                <b>{m.email}</b> <em>{m.role}</em>
                <button type="button" className="link" onClick={() => save(() => (acc.members = acc.members.filter((x) => x.id !== m.id)))}>
                  remover
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Domínio personalizado</h2>
          <p className="muted">Aponte um subdomínio seu (ex.: forms.suaempresa.com.br) com um registro CNAME para este site e informe-o aqui; os links de compartilhamento passam a usá-lo.</p>
          <input placeholder="forms.suaempresa.com.br" value={acc.customDomain} onChange={(e) => save(() => (acc.customDomain = e.target.value.trim()))} aria-label="Domínio personalizado" />
        </section>
        <section className="panel">
          <h2>Segurança e Autenticação Google</h2>
          <p className="muted">Gerencie a conexão OAuth com o Google e visualize o status da criptografia de ponta a ponta.</p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: '600', marginBottom: '4px' }}>
              <span>🛡️ Criptografia de Ponta a Ponta Ativa</span>
            </div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>
              Algoritmos: <b>AES-GCM 256-bit</b> (dados em repouso) & <b>PBKDF2 SHA-256</b> (100.000 iterações com salt individual).
            </div>
            {d.session?.role && (
              <div style={{ marginTop: '6px', color: '#334155', fontSize: '12px' }}>
                Perfil: <b>{d.session.name || d.session.email}</b> ({d.session.role})
              </div>
            )}
          </div>
          <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
            Google OAuth Client ID (Google Cloud)
          </label>
          <input
            placeholder="ex: 123456789-xyz.apps.googleusercontent.com"
            value={acc.googleClientId || ''}
            onChange={(e) => save(() => (acc.googleClientId = e.target.value.trim()))}
            aria-label="Google Client ID"
          />
          <span style={{ fontSize: '11px', color: 'var(--ink-2)' }}>
            Permite o botão oficial "Continuar com o Google" e login automático (One Tap) no seu domínio da Vercel.
          </span>
        </section>
        <section className="panel">
          <h2>Seus dados</h2>
          <p className="muted">Tudo fica guardado neste navegador. Baixe uma cópia ou apague tudo.</p>
          <div className="row">
            <button
              type="button"
              className="btn-light"
              onClick={() => {
                const blob = new Blob([JSON.stringify(db(), null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'formaria-backup.json';
                a.click();
              }}
            >
              Baixar backup
            </button>
            <label className="btn-light">
              Restaurar backup
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  try {
                    const j = JSON.parse(await file.text());
                    if (!j.forms) throw 0;
                    save((x) => Object.assign(x, j, { session: x.session }));
                    alert('Backup restaurado.');
                  } catch {
                    alert('Arquivo inválido.');
                  }
                }}
              />
            </label>
          </div>
        </section>
      </main>
    </div>
  );
}
