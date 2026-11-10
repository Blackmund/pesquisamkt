import React, { useEffect, useRef, useState } from 'react';
import { db, save, uid, typeInfo, formResponses } from './store.js';
import { go, Link, Modal } from './shared.jsx';
import {
  DAYS, projectsOf, getProject, projectForms, newProject, formStats, globalStats, isActive, projectStats, numericQuestions, crossPairs, diagnose, flowOrder,
} from './analytics.js';
import { answerText } from './fill.jsx';
import { pasaLogin, pasaSurveys, pasaDetails, convertSurvey, storeImported } from './pasa.js';

const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');
const pct = (v) => (v === null || v === undefined ? '—' : v + '%');
const nps = (v) => (v === null || v === undefined ? '—' : v);

export const AUDIENCES = [
  ['', 'Sem público'],
  ['interno', 'VI · Interno'],
  ['externo', 'VE · Externo'],
];
const audTag = (a) => (a === 'interno' ? 'VI' : a === 'externo' ? 'VE' : null);

function Heat({ heat }) {
  const max = Math.max(1, ...heat);
  return (
    <div className="heat" aria-label="Respostas por dia nos últimos 7 dias">
      {heat.map((v, i) => (
        <span key={i} title={`${DAYS[i]}: ${v}`}>
          <i style={{ background: v ? `rgba(46,72,170,${0.25 + (0.75 * v) / max})` : undefined }} />
          <em>{DAYS[i]}</em>
        </span>
      ))}
    </div>
  );
}

export function Kpis({ items }) {
  return (
    <div className="kpis">
      {items.map(([label, value, icon]) => (
        <div className="kpi" key={label}>
          <span className="kpi-l">{label}</span>
          <span className="kpi-i" aria-hidden="true">{icon}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  );
}

function copyLink(f) {
  const dom = db().account.customDomain;
  const url = `${dom ? 'https://' + dom : location.origin}/f/?id=${f.id}`;
  navigator.clipboard?.writeText(url);
  return url;
}

export function SurveyCard({ f, onMove }) {
  const s = formStats(f);
  const [msg, setMsg] = useState('');
  const tag = audTag(f.audience);
  const p = f.projectId && getProject(f.projectId);
  const active = isActive(f);
  return (
    <div className={'scard' + (active ? ' active' : '')}>
      <div className="scard-top">
        <h3>
          {tag && <span className={'aud ' + f.audience}>{tag}</span>} {f.title}
        </h3>
        <button type="button" className="icon-btn" title="Mover para projeto" aria-label="Mover para projeto" onClick={() => onMove(f)}>
          ⇄
        </button>
      </div>
      {f.welcome.description && <p className="scard-desc">{f.welcome.description}</p>}
      <div className="chips">
        <span className={'chip status ' + (active ? 'on' : f.published ? 'paused' : 'draft')}>{active ? 'Ativa' : f.published ? 'Pausada' : 'Rascunho'}</span>
        {p && (
          <span className="chip proj" style={{ '--pc': p.color }}>
            ▣ {p.name}
          </span>
        )}
      </div>
      <div className="chips">
        <span className="chip">👥 {s.done} respostas</span>
        <span className="chip">NPS {nps(s.nps)}</span>
        <span className="chip">Última: {fmtDate(s.last)}</span>
      </div>
      <div className="scard-mid">
        <span className="spark" style={{ '--w': (s.completion ?? 0) + '%' }} title={`Conclusão ${pct(s.completion)}`} />
        <Heat heat={s.heat} />
      </div>
      <div className="scard-actions">
        <button type="button" onClick={() => go(`/builder/?id=${f.id}`)}>✎ Abrir</button>
        <button type="button" onClick={() => go(`/builder/?id=${f.id}&tab=results`)}>▥ Dashboard</button>
        <button
          type="button"
          onClick={() =>
            save(() => {
              if (!f.published) f.published = true;
              else f.settings.closed = !f.settings.closed;
            })
          }
        >
          {active ? '❚❚ Pausar' : '▶ Ativar'}
        </button>
        <button
          type="button"
          className="copy"
          title="Copiar link"
          aria-label="Copiar link"
          onClick={() => {
            copyLink(f);
            setMsg('Copiado!');
            setTimeout(() => setMsg(''), 1200);
          }}
        >
          {msg || '⧉'}
        </button>
      </div>
    </div>
  );
}

export function MoveModal({ f, onClose }) {
  const ps = projectsOf().filter((p) => p.workspaceId === f.workspaceId);
  const set = (pid) => {
    save(() => (f.projectId = pid));
    onClose();
  };
  return (
    <Modal title={`Mover “${f.title}”`} onClose={onClose}>
      <button type="button" className="list-btn" onClick={() => set(null)}>
        🏛 Lobby (formulário avulso) {!f.projectId && '✓'}
      </button>
      {ps.map((p) => (
        <button type="button" key={p.id} className="list-btn" onClick={() => set(p.id)}>
          <span className="dot" style={{ background: p.color }} /> {p.name} {f.projectId === p.id && '✓'}
        </button>
      ))}
      <label className="fld" style={{ marginTop: 12 }}>
        <span>Público</span>
        <select value={f.audience || ''} onChange={(e) => save(() => (f.audience = e.target.value))}>
          {AUDIENCES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}

function ProjectCard({ p }) {
  const st = projectStats(p);
  return (
    <button type="button" className="pcard" style={{ '--pc': p.color }} onClick={() => go(`/project/?id=${p.id}`)}>
      <span className="pcard-head">
        <span className="pcard-ico">▣</span>
        <b>{p.name}</b>
      </span>
      {p.description && <span className="pcard-desc">{p.description}</span>}
      <span className="chips">
        <span className="chip">{st.forms.length} formulários</span>
        <span className="chip">{p.flows.length} conexões</span>
        <span className="chip">👥 {st.g.total} respostas</span>
      </span>
      <span className="pcard-bar">
        <i style={{ width: (st.health ?? 0) + '%' }} />
      </span>
      <span className="pcard-foot">
        <span>Saúde do projeto: <b>{st.health ?? '—'}</b>/100</span>
        <span>NPS {nps(st.g.nps)}</span>
      </span>
    </button>
  );
}

// ---------- Home: lobby + projects ----------
export function Home({ ws, query, onCreate }) {
  const d = db();
  const [view, setView] = useState(() => localStorage.getItem('formaria.home') || 'lobby');
  const [moving, setMoving] = useState(null);
  const [aud, setAud] = useState('');
  const forms = d.forms.filter((f) => f.workspaceId === ws.id);
  const projects = projectsOf().filter((p) => p.workspaceId === ws.id);
  const g = globalStats(forms);
  const q = query.toLowerCase();
  const setV = (v) => {
    setView(v);
    localStorage.setItem('formaria.home', v);
  };
  const list = forms
    .filter((f) => (view === 'lobby' ? !f.projectId : true))
    .filter((f) => !aud || f.audience === aud)
    .filter((f) => f.title.toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const [naming, setNaming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pname, setPname] = useState('');
  const addProject = () => setNaming(true);
  const createProject = (n) => {
    if (!n.trim()) return;
    const p = newProject(ws.id, n.trim());
    save((x) => projectsOf(x).push(p));
    go(`/project/?id=${p.id}`);
  };
  return (
    <>
      <div className="hello">
        <h1>Olá, {d.session?.name?.split(' ')[0] || 'bem-vindo'} 👋</h1>
        <p className="muted">Visão geral das suas pesquisas e métricas · {ws.name}</p>
      </div>
      <div className="tiles">
        {[
          ['▤', 'Pesquisas', () => setV('all'), '#2f6fd1'],
          ['▣', 'Projetos', () => setV('projects'), '#6a3fd1'],
          ['✉', 'Respostas', () => go(`/project/?id=all:${ws.id}&tab=responses`), '#1f8a5b'],
          ['◔', 'Relatórios', () => go(`/project/?id=all:${ws.id}&tab=dash`), '#9b3fd1'],
          ['✦', 'Insights', () => go(`/project/?id=all:${ws.id}&tab=insights`), '#e09b12'],
          ['⚙', 'Configurações', () => go('/account'), '#55505a'],
        ].map(([i, l, fn, c]) => (
          <button type="button" key={l} className="tile" onClick={fn}>
            <span style={{ color: c }}>{i}</span>
            {l}
          </button>
        ))}
      </div>
      <div className="notice import-pasa">
        {d.account.pasaImported ? 'Atualize ou traga mais pesquisas do painel PASA, com perguntas e lógicas.' : 'Traga suas pesquisas do painel PASA (pesquisamkt.online) com perguntas, opções e lógicas.'}{' '}
        <button type="button" className="btn-dark" onClick={() => setImporting(true)}>
          ⇣ Importar do PASA
        </button>
      </div>
      <Kpis
        items={[
          ['PESQUISAS ATIVAS', g.active, '▤'],
          ['TOTAL DE RESPOSTAS', g.total, '👥'],
          ['NPS MÉDIO', nps(g.nps), '↗'],
          ['TAXA DE CONCLUSÃO', pct(g.completion), '▥'],
        ]}
      />
      <div className="home-tabs">
        <div className="seg">
          <button type="button" className={view === 'lobby' ? 'on' : ''} onClick={() => setV('lobby')}>
            🏛 Lobby
          </button>
          <button type="button" className={view === 'projects' ? 'on' : ''} onClick={() => setV('projects')}>
            ▣ Projetos ({projects.length})
          </button>
          <button type="button" className={view === 'all' ? 'on' : ''} onClick={() => setV('all')}>
            Todas as pesquisas
          </button>
        </div>
        {view !== 'projects' && (
          <select value={aud} onChange={(e) => setAud(e.target.value)} aria-label="Público">
            <option value="">Todos os públicos</option>
            <option value="interno">VI · Interno</option>
            <option value="externo">VE · Externo</option>
          </select>
        )}
        <div className="row" style={{ marginLeft: 'auto' }}>
          {view === 'projects' ? (
            <button type="button" className="btn-dark" onClick={addProject}>
              + Novo projeto
            </button>
          ) : (
            <button type="button" className="btn-dark" onClick={() => onCreate(null)}>
              + Criar pesquisa
            </button>
          )}
        </div>
      </div>
      {view === 'projects' ? (
        projects.length ? (
          <div className="pgrid">
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>Organize pesquisas em projetos</h2>
            <p>Um projeto junta vários formulários, liga um ao outro (funil, triagem ou acompanhamento depois de alguns dias) e mostra um painel consolidado.</p>
            <button type="button" className="btn-dark" onClick={addProject}>
              + Criar primeiro projeto
            </button>
          </div>
        )
      ) : list.length ? (
        <div className="sgrid">
          {list.map((f) => (
            <SurveyCard key={f.id} f={f} onMove={setMoving} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>{view === 'lobby' ? 'Nenhum formulário avulso' : 'Nenhuma pesquisa encontrada'}</h2>
          <p>O lobby guarda pesquisas rápidas. Quando quiser, mova uma delas para um projeto.</p>
          <button type="button" className="btn-dark" onClick={() => onCreate(null)}>
            + Criar pesquisa
          </button>
        </div>
      )}
      {moving && <MoveModal f={moving} onClose={() => setMoving(null)} />}
      {importing && <PasaImport wsId={ws.id} onClose={() => setImporting(false)} />}
      {naming && (
        <Modal title="Novo projeto" onClose={() => setNaming(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createProject(pname);
            }}
          >
            <label className="fld">
              <span>Nome do projeto</span>
              <input id="pname" autoFocus value={pname} placeholder="Ex.: Lançamento de Produto, Clima & Cultura 2026" onChange={(e) => setPname(e.target.value)} />
            </label>
            <button className="btn-dark" disabled={!pname.trim()}>
              Criar projeto
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

// ---------- Project page ----------
const PTABS = [
  ['dash', 'Dashboard'],
  ['flow', 'Fluxo'],
  ['forms', 'Formulários'],
  ['responses', 'Respostas'],
  ['followups', 'Agendamentos'],
  ['insights', 'Diagnóstico'],
];

export function ProjectPage({ TopBar, NewFormModal }) {
  const params = new URLSearchParams(location.search);
  const p = getProject(params.get('id'));
  const [tab, setTabS] = useState(params.get('tab') || 'dash');
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (p) document.title = `${p.name} · Projeto`;
  }, [p?.name]);
  if (!p)
    return (
      <div className="app">
        <TopBar />
        <div className="empty">
          <h2>Projeto não encontrado</h2>
          <Link className="btn-dark" to="/workspace">
            Voltar
          </Link>
        </div>
      </div>
    );
  const setTab = (t) => {
    setTabS(t);
    const u = new URL(location.href);
    u.searchParams.set('tab', t);
    history.replaceState({}, '', u);
  };
  const ws = db().workspaces.find((w) => w.id === p.workspaceId);
  const del = () => {
    if (!confirm(`Excluir o projeto "${p.name}"? Os formulários voltam para o lobby.`)) return;
    save((d) => {
      d.projects = projectsOf(d).filter((x) => x.id !== p.id);
      d.forms.forEach((f) => f.projectId === p.id && (f.projectId = null));
    });
    go('/workspace');
  };
  return (
    <div className="app project">
      <TopBar>
        <div className="b-crumb">
          <Link to={`/accounts/${db().account.id}/workspaces/${p.workspaceId}`}>{ws?.name || 'Início'}</Link>
          <span>/</span>
          <span className="dot" style={{ background: p.color }} />
          {p.virtual ? <b className="b-title-static">{p.name}</b> : <input className="b-title" value={p.name} aria-label="Nome do projeto" onChange={(e) => save(() => (p.name = e.target.value))} />}
        </div>
      </TopBar>
      <nav className="b-tabs" role="tablist">
        {PTABS.filter(([k]) => !p.virtual || ['dash', 'responses', 'insights'].includes(k)).map(([k, l]) => (
          <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
            {k === 'followups' && p.followups.filter((x) => !x.done && x.due <= Date.now()).length > 0 && <span className="badge">{p.followups.filter((x) => !x.done && x.due <= Date.now()).length}</span>}
          </button>
        ))}
        <div className="b-tabs-r">
          <button type="button" className="btn-light" onClick={() => window.print()}>
            Relatório PDF
          </button>
          {!p.virtual && (
            <button type="button" className="btn-dark" onClick={() => setCreating(true)}>
              + Formulário no projeto
            </button>
          )}
        </div>
      </nav>
      <div className="b-page wide">
        {tab === 'dash' && <ProjectDash p={p} />}
        {tab === 'flow' && <FlowCanvas p={p} />}
        {tab === 'forms' && <ProjectFormsTab p={p} onDelete={del} />}
        {tab === 'responses' && <UnifiedResponses p={p} />}
        {tab === 'followups' && <Followups p={p} />}
        {tab === 'insights' && <Insights p={p} />}
      </div>
      {creating && <NewFormModal workspaceId={p.workspaceId} projectId={p.id} onClose={() => setCreating(false)} />}
    </div>
  );
}

function Bar({ label, value, max, note }) {
  const w = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar">
      <span className="bar-l">{label}</span>
      <span className="bar-t">
        <i style={{ width: w + '%' }} />
      </span>
      <span className="bar-n">{note ?? value}</span>
    </div>
  );
}

function ProjectDash({ p }) {
  const st = projectStats(p);
  const maxF = Math.max(1, ...st.funnel.map((x) => Math.max(x.views, x.starts)));
  const nq = numericQuestions(st.forms);
  const [a, setA] = useState(nq[0]?.key || '');
  const [b, setB] = useState(nq[1]?.key || '');
  const qa = nq.find((x) => x.key === a);
  const qb = nq.find((x) => x.key === b);
  const cross = qa && qb ? crossPairs(st.journeys, qa, qb) : null;
  if (!st.forms.length)
    return (
      <div className="empty">
        <h2>Este projeto ainda não tem formulários</h2>
        <p>Crie um aqui ou mova formulários do lobby para cá. Depois ligue um ao outro na aba Fluxo.</p>
      </div>
    );
  return (
    <div className="pdash">
      <Kpis
        items={[
          ['SAÚDE DO PROJETO', st.health === null ? '—' : `${st.health}/100`, '♥'],
          ['RESPOSTAS', st.g.total, '👥'],
          ['NPS CONSOLIDADO', nps(st.g.nps), '↗'],
          ['CONCLUSÃO', pct(st.g.completion), '▥'],
          ['JORNADAS COMPLETAS', `${st.fullCycle}/${st.journeys.length}`, '⇢'],
        ]}
      />
      <div className="pdash-grid">
        <section className="panel">
          <h3>Funil da jornada</h3>
          <p className="muted small">Visitas, começos e conclusões em cada formulário, na ordem do fluxo.</p>
          {st.funnel.map((x, i) => (
            <div key={x.form.id} className="funnel-step">
              <b>
                {i + 1}. {x.form.title}
              </b>
              <Bar label="Abriram" value={x.views} max={maxF} />
              <Bar label="Começaram" value={x.starts} max={maxF} />
              <Bar label="Concluíram" value={x.done} max={maxF} note={`${x.done}${x.starts ? ` (${Math.round((x.done / x.starts) * 100)}%)` : ''}`} />
            </div>
          ))}
          <p className="small muted">
            {st.multi} pessoa(s) passaram por mais de um formulário; {st.fullCycle} completaram o ciclo todo.
          </p>
        </section>
        <section className="panel">
          <h3>Saúde do projeto</h3>
          <div className="gauge" style={{ '--v': (st.health ?? 0) * 3.6 + 'deg' }}>
            <span>{st.health ?? '—'}</span>
          </div>
          <p className="small muted">Nota de 0 a 100: NPS (40%), taxa de conclusão (35%) e avanço nas jornadas (25%).</p>
          <h3 style={{ marginTop: 18 }}>Respostas na semana</h3>
          <Heat heat={st.heat} />
        </section>
        <section className="panel">
          <h3>Interno × Externo</h3>
          <table className="rtable small-t">
            <thead>
              <tr>
                <th>Público</th>
                <th>Forms</th>
                <th>Respostas</th>
                <th>Conclusão</th>
                <th>NPS</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(st.byAudience).map(([k, v]) => (
                <tr key={k}>
                  <td>{k === 'interno' ? 'VI · Interno' : k === 'externo' ? 'VE · Externo' : 'Geral'}</td>
                  <td>{v.forms}</td>
                  <td>{v.done}</td>
                  <td>{v.starts ? Math.round((v.done / v.starts) * 100) + '%' : '—'}</td>
                  <td>{nps(v.nps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">Defina o público de cada formulário em “Mover / público”.</p>
        </section>
        <section className="panel">
          <h3>Cruzamento entre formulários</h3>
          {nq.length < 2 ? (
            <p className="muted">Inclua perguntas de nota (NPS, estrelas, escala ou número) em dois formulários ligados para comparar a mesma pessoa.</p>
          ) : (
            <>
              <div className="row">
                <select value={a} onChange={(e) => setA(e.target.value)} aria-label="Primeira pergunta">
                  {nq.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
                <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Segunda pergunta">
                  {nq.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
              {cross && (
                <>
                  <div className="scatter" aria-label="Gráfico de dispersão">
                    {cross.pairs.map(([x, y], i) => {
                      const mx = Math.max(10, ...cross.pairs.map((p2) => p2[0]));
                      const my = Math.max(10, ...cross.pairs.map((p2) => p2[1]));
                      return <i key={i} style={{ left: (x / mx) * 100 + '%', bottom: (y / my) * 100 + '%' }} />;
                    })}
                  </div>
                  <p className="small">
                    {cross.pairs.length} pessoa(s) responderam às duas.{' '}
                    {cross.r === null
                      ? 'São precisas pelo menos 3 para medir a relação.'
                      : `Correlação ${cross.r.toFixed(2)}: ${Math.abs(cross.r) > 0.6 ? 'forte' : Math.abs(cross.r) > 0.3 ? 'moderada' : 'fraca'}${cross.r > 0 ? ' e positiva — quem dá nota alta em uma tende a dar na outra.' : ' e negativa.'}`}
                  </p>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- visual flow builder ----------
const OPS = [
  ['always', 'sempre'],
  ['eq', 'resposta é igual a'],
  ['neq', 'resposta é diferente de'],
  ['contains', 'resposta contém'],
  ['gte', 'nota maior ou igual a'],
  ['lte', 'nota menor ou igual a'],
  ['answered', 'foi respondida'],
];

function FlowCanvas({ p }) {
  const forms = projectForms(p);
  const ordered = flowOrder(p, forms);
  const [drag, setDrag] = useState(null);
  const [linkFrom, setLinkFrom] = useState(null);
  const [edit, setEdit] = useState(null);
  const box = useRef();
  const pos = (f, i) => p.layout[f.id] || { x: 40 + (i % 3) * 260, y: 40 + Math.floor(i / 3) * 170 + (i % 2) * 30 };
  const W = 200;
  const H = 64;
  useEffect(() => {
    if (!drag) return;
    const mv = (e) => {
      const r = box.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - r.left - drag.dx + box.current.scrollLeft);
      const y = Math.max(0, e.clientY - r.top - drag.dy + box.current.scrollTop);
      p.layout[drag.id] = { x, y };
      save();
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
  }, [drag]);
  const place = Object.fromEntries(ordered.map((f, i) => [f.id, pos(f, i)]));
  const connect = (to) => {
    if (!linkFrom || linkFrom === to) return setLinkFrom(null);
    const fl = { id: uid('fl_'), from: linkFrom, to, cond: { qid: '', op: 'always', value: '' }, pass: [], delayDays: 0 };
    save(() => p.flows.push(fl));
    setLinkFrom(null);
    setEdit(fl.id);
  };
  const maxX = Math.max(800, ...Object.values(place).map((v) => v.x + W + 40));
  const maxY = Math.max(420, ...Object.values(place).map((v) => v.y + H + 60));
  const editing = p.flows.find((x) => x.id === edit);
  return (
    <div>
      <div className="flow-help">
        <p>
          Arraste os cartões para organizar. Para ligar dois formulários, clique em <b>Ligar →</b> no primeiro e depois no segundo. Clique numa seta para definir a regra: funil (sempre), triagem por resposta, ou envio depois de alguns dias.
        </p>
        {linkFrom && (
          <p className="notice">
            Escolha o formulário de destino…{' '}
            <button type="button" className="link" onClick={() => setLinkFrom(null)}>
              cancelar
            </button>
          </p>
        )}
      </div>
      {!forms.length && <p className="muted">Adicione formulários ao projeto para montar o fluxo.</p>}
      <div className="canvas" ref={box}>
        <svg width={maxX} height={maxY} className="canvas-svg">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#6a3fd1" />
            </marker>
          </defs>
          {p.flows.map((fl) => {
            const a = place[fl.from];
            const b = place[fl.to];
            if (!a || !b) return null;
            const x1 = a.x + W / 2;
            const y1 = a.y + H;
            const x2 = b.x + W / 2;
            const y2 = b.y;
            const down = y2 > y1 + 10;
            const d = down ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2 - 2}` : `M${a.x + W},${a.y + H / 2} C${a.x + W + 60},${a.y + H / 2} ${b.x - 60},${b.y + H / 2} ${b.x - 2},${b.y + H / 2}`;
            const mx = down ? (x1 + x2) / 2 : (a.x + W + b.x) / 2;
            const my = down ? (y1 + y2) / 2 : (a.y + b.y + H) / 2;
            const label = +fl.delayDays ? `+${fl.delayDays} dias` : fl.cond?.op && fl.cond.op !== 'always' ? 'condição' : 'funil';
            return (
              <g key={fl.id} className={'edge' + (edit === fl.id ? ' on' : '')} onClick={() => setEdit(fl.id)}>
                <path d={d} className="edge-hit" />
                <path d={d} className={'edge-line' + (+fl.delayDays ? ' dashed' : '')} markerEnd="url(#arr)" />
                <rect x={mx - 36} y={my - 11} width="72" height="22" rx="11" className="edge-pill" />
                <text x={mx} y={my + 4} textAnchor="middle" className="edge-txt">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
        {ordered.map((f) => {
          const pt = place[f.id];
          const s = formStats(f);
          return (
            <div
              key={f.id}
              className={'node' + (linkFrom === f.id ? ' linking' : '') + (linkFrom && linkFrom !== f.id ? ' target' : '')}
              style={{ left: pt.x, top: pt.y, width: W, minHeight: H }}
              onPointerDown={(e) => {
                if (e.target.closest('button')) return;
                if (linkFrom) return connect(f.id);
                const r = e.currentTarget.getBoundingClientRect();
                setDrag({ id: f.id, dx: e.clientX - r.left, dy: e.clientY - r.top });
              }}
            >
              <b>
                {audTag(f.audience) && <span className={'aud ' + f.audience}>{audTag(f.audience)}</span>} {f.title}
              </b>
              <span className="small muted">
                {s.done} respostas · {isActive(f) ? 'ativa' : 'pausada'}
              </span>
              <span className="node-ops">
                <button type="button" onClick={() => setLinkFrom(f.id)}>
                  Ligar →
                </button>
                <button type="button" onClick={() => go(`/builder/?id=${f.id}`)}>
                  Abrir
                </button>
              </span>
            </div>
          );
        })}
        <div className="node dash-node" style={{ left: 40, top: maxY - 30 }}>
          ▥ Dashboard consolidado ({forms.length} formulários)
        </div>
      </div>
      {editing && <FlowEditor p={p} fl={editing} onClose={() => setEdit(null)} />}
    </div>
  );
}

function FlowEditor({ p, fl, onClose }) {
  const from = db().forms.find((f) => f.id === fl.from);
  const to = db().forms.find((f) => f.id === fl.to);
  if (!from || !to) return null;
  const set = (fn) => save(() => fn(fl));
  const refs = from.questions.filter((q) => q.ref);
  const cq = from.questions.find((q) => q.id === fl.cond?.qid);
  const missing = refs.filter((r) => !to.questions.some((q) => q.ref === r.ref) && !(to.settings.hiddenFields || []).includes(r.ref));
  return (
    <Modal title={`${from.title} → ${to.title}`} onClose={onClose}>
      <div className="seg">
        {[
          ['funnel', 'Funil'],
          ['router', 'Triagem'],
          ['timed', 'Depois de X dias'],
        ].map(([k, l]) => {
          const cur = +fl.delayDays ? 'timed' : fl.cond?.op && fl.cond.op !== 'always' ? 'router' : 'funnel';
          return (
            <button
              type="button"
              key={k}
              className={cur === k ? 'on' : ''}
              onClick={() =>
                set((x) => {
                  if (k === 'funnel') {
                    x.cond = { qid: '', op: 'always', value: '' };
                    x.delayDays = 0;
                  }
                  if (k === 'router') {
                    x.delayDays = 0;
                    x.cond = { qid: from.questions[0]?.id || '', op: 'eq', value: '' };
                  }
                  if (k === 'timed') x.delayDays = x.delayDays || 15;
                })
              }
            >
              {l}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <label className="fld">
          <span>Quando</span>
          <select value={fl.cond?.op || 'always'} onChange={(e) => set((x) => (x.cond = { ...x.cond, op: e.target.value }))}>
            {OPS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {fl.cond?.op && fl.cond.op !== 'always' && (
          <>
            <label className="fld">
              <span>Pergunta de “{from.title}”</span>
              <select value={fl.cond.qid} onChange={(e) => set((x) => (x.cond.qid = e.target.value))}>
                {from.questions.map((q, i) => (
                  <option key={q.id} value={q.id}>
                    {i + 1}. {(q.title || typeInfo(q.type).label).slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
            {fl.cond.op !== 'answered' && (
              <label className="fld">
                <span>Valor</span>
                {cq?.options?.length ? (
                  <select value={fl.cond.value} onChange={(e) => set((x) => (x.cond.value = e.target.value))}>
                    <option value="">—</option>
                    {cq.options.map((o) => (
                      <option key={o.id}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input value={fl.cond.value} onChange={(e) => set((x) => (x.cond.value = e.target.value))} />
                )}
              </label>
            )}
          </>
        )}
        <label className="fld">
          <span>Enviar depois de (dias)</span>
          <input type="number" min="0" value={fl.delayDays} onChange={(e) => set((x) => (x.delayDays = Math.max(0, +e.target.value)))} />
          <small>0 = a pessoa segue direto para o próximo formulário. Mais que 0 = o envio entra na aba Agendamentos com o contato e o link prontos.</small>
        </label>
        <div className="fld">
          <span>Dados passados para o próximo formulário (sem recadastro)</span>
          {refs.length ? (
            refs.map((q) => (
              <label className="chk" key={q.id}>
                <input
                  type="checkbox"
                  checked={!fl.pass?.length || fl.pass.includes(q.ref)}
                  onChange={(e) =>
                    set((x) => {
                      const all = refs.map((r) => r.ref);
                      const cur = x.pass?.length ? x.pass : all;
                      x.pass = e.target.checked ? [...new Set([...cur, q.ref])] : cur.filter((r) => r !== q.ref);
                      if (x.pass.length === all.length) x.pass = [];
                    })
                  }
                />
                {q.ref} <span className="muted small">({q.title})</span>
              </label>
            ))
          ) : (
            <small className="muted">Dê um “apelido” às perguntas de {from.title} (ex.: nome, email) para enviá-las adiante.</small>
          )}
          {missing.length > 0 && (
            <small className="muted">
              Em “{to.title}”, use os mesmos apelidos ({missing.map((m) => m.ref).join(', ')}) numa pergunta ou campo oculto: ela vem preenchida e é pulada.
            </small>
          )}
        </div>
        <div className="row">
          <button type="button" className="btn-dark" onClick={onClose}>
            Pronto
          </button>
          <button
            type="button"
            className="btn-light danger"
            onClick={() => {
              save(() => (p.flows = p.flows.filter((x) => x.id !== fl.id)));
              onClose();
            }}
          >
            Remover ligação
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectFormsTab({ p, onDelete }) {
  const forms = projectForms(p);
  const lobby = db().forms.filter((f) => f.workspaceId === p.workspaceId && !f.projectId);
  const [moving, setMoving] = useState(null);
  return (
    <div>
      <section className="panel">
        <h3>Sobre o projeto</h3>
        <label className="fld">
          <span>Descrição</span>
          <input value={p.description} onChange={(e) => save(() => (p.description = e.target.value))} />
        </label>
        <label className="color">
          <input type="color" value={p.color} onChange={(e) => save(() => (p.color = e.target.value))} /> Cor do projeto
        </label>
      </section>
      <div className="sgrid">
        {forms.map((f) => (
          <SurveyCard key={f.id} f={f} onMove={setMoving} />
        ))}
      </div>
      {lobby.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h3>Trazer do lobby</h3>
          <div className="row">
            {lobby.map((f) => (
              <button type="button" key={f.id} className="btn-light" onClick={() => save(() => (f.projectId = p.id))}>
                + {f.title}
              </button>
            ))}
          </div>
        </section>
      )}
      <button type="button" className="btn-light danger" style={{ marginTop: 16 }} onClick={onDelete}>
        Excluir projeto
      </button>
      {moving && <MoveModal f={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}

function UnifiedResponses({ p }) {
  const st = projectStats(p);
  const [q, setQ] = useState('');
  const rows = st.journeys
    .filter((j) => !q || JSON.stringify(j.rs.map((r) => r.answers)).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.last - a.last);
  const exportCSV = () => {
    const cols = st.ordered.flatMap((f) => f.questions.map((qq) => ({ f, q: qq })));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['jornada', 'última atividade', 'formulários concluídos', ...cols.map((c) => `${c.f.title} · ${c.q.title}`)];
    const lines = [head.map(esc).join(';')];
    rows.forEach((j) => {
      const cells = cols.map((c) => {
        const r = j.rs.find((x) => x.form.id === c.f.id);
        return r ? answerText(c.q, r.answers[c.q.id]) : '';
      });
      lines.push([j.id, new Date(j.last).toLocaleString('pt-BR'), j.forms.size, ...cells].map(esc).join(';'));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${p.name.replace(/[^\w-]+/g, '_')}-respostas.csv`;
    a.click();
  };
  return (
    <div>
      <div className="res-tools">
        <input type="search" placeholder="Buscar em todas as respostas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <button type="button" className="btn-dark" disabled={!rows.length} onClick={exportCSV}>
          Baixar planilha unificada
        </button>
      </div>
      {!rows.length ? (
        <div className="empty">
          <h2>Ainda não há respostas neste projeto</h2>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="rtable">
            <thead>
              <tr>
                <th>Pessoa / jornada</th>
                <th>Última atividade</th>
                {st.ordered.map((f) => (
                  <th key={f.id}>{f.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => {
                const any = j.rs[0];
                const nameQ = any.form.questions.find((x) => x.ref === 'nome' || x.type === 'email');
                return (
                  <tr key={j.id}>
                    <td>{nameQ ? answerText(nameQ, any.answers[nameQ.id]) || j.id.slice(0, 8) : j.id.slice(0, 8)}</td>
                    <td>{new Date(j.last).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    {st.ordered.map((f) => {
                      const r = j.rs.find((x) => x.form.id === f.id);
                      return <td key={f.id}>{r ? <span className={'pill ' + (r.completed ? 'ok' : 'partial')}>{r.completed ? 'Concluiu' : 'Parcial'}</span> : <span className="muted">—</span>}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Followups({ p }) {
  const list = [...p.followups].sort((a, b) => a.due - b.due);
  const formName = (id) => db().forms.find((f) => f.id === id)?.title || 'formulário';
  return (
    <div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Envios programados pelas ligações “depois de X dias”. Quando chegar a data, mande o link pelo WhatsApp ou e-mail com um clique.
      </p>
      {!list.length && (
        <div className="empty">
          <h2>Nada agendado</h2>
          <p>Na aba Fluxo, abra uma ligação e escolha “Depois de X dias”.</p>
        </div>
      )}
      {list.map((x) => {
        const url = location.origin + x.link;
        const due = x.due <= Date.now();
        const msg = `Olá${x.contact.name ? ' ' + x.contact.name : ''}! Pode responder mais uma rápida pesquisa? ${url}`;
        return (
          <div className={'panel fu' + (x.done ? ' done' : due ? ' due' : '')} key={x.id}>
            <div>
              <b>{formName(x.to)}</b>
              <span className="muted small">
                {' '}
                · {x.done ? 'enviado' : due ? 'pronto para enviar' : 'em ' + new Date(x.due).toLocaleDateString('pt-BR')}
              </span>
              <p className="small">
                {x.contact.name || 'Pessoa sem nome'} {x.contact.email && `· ${x.contact.email}`} {x.contact.phone && `· ${x.contact.phone}`}
              </p>
            </div>
            <div className="row">
              {x.contact.phone && (
                <a className="wa" href={`https://wa.me/55${x.contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
              {x.contact.email && (
                <a className="btn-light" href={`mailto:${x.contact.email}?subject=${encodeURIComponent('Sua opinião importa')}&body=${encodeURIComponent(msg)}`}>
                  E-mail
                </a>
              )}
              <button type="button" className="btn-light" onClick={() => navigator.clipboard?.writeText(url)}>
                Copiar link
              </button>
              <button type="button" className="btn-light" onClick={() => save(() => (x.done = !x.done))}>
                {x.done ? 'Desmarcar' : 'Marcar enviado'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Insights({ p }) {
  const [run, setRun] = useState(false);
  const forms = projectForms(p);
  const d = run ? diagnose(forms) : null;
  const st = projectStats(p);
  const maxT = d?.terms[0]?.[1] || 1;
  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <button type="button" className="btn-dark" onClick={() => setRun(true)}>
          ✦ Diagnóstico do projeto
        </button>
        <span className="muted small">Lê as respostas abertas de todos os formulários do projeto, aqui no seu navegador.</span>
      </div>
      {d && (
        <div className="pdash-grid">
          <section className="panel">
            <h3>Resumo</h3>
            <p>
              {d.count} resposta(s) abertas analisadas em {forms.length} formulário(s). Tom geral:{' '}
              <b>{d.pos > d.neg ? 'positivo' : d.neg > d.pos ? 'negativo' : 'neutro'}</b> ({d.pos} sinais positivos, {d.neg} negativos). NPS consolidado {nps(st.g.nps)}, conclusão {pct(st.g.completion)}.
            </p>
            {st.g.completion !== null && st.g.completion < 60 && <p className="notice">Alerta: menos de 60% concluem. Encurte os formulários ou ligue a recuperação de abandonos.</p>}
            {st.g.nps !== null && st.g.nps < 0 && <p className="notice">Alerta: NPS negativo — há mais detratores que promotores.</p>}
          </section>
          <section className="panel">
            <h3>Termos mais citados</h3>
            <div className="cloud">
              {d.terms.length ? (
                d.terms.map(([w, n]) => (
                  <span key={w} style={{ fontSize: 12 + (n / maxT) * 20, opacity: 0.5 + (n / maxT) * 0.5 }}>
                    {w}
                  </span>
                ))
              ) : (
                <span className="muted">Sem respostas abertas ainda.</span>
              )}
            </div>
          </section>
          <section className="panel">
            <h3>Principais elogios</h3>
            <ul className="ans-list">{d.praise.length ? d.praise.map((t, i) => <li key={i}>{t}</li>) : <li className="muted">Nenhum identificado.</li>}</ul>
          </section>
          <section className="panel">
            <h3>Principais reclamações</h3>
            <ul className="ans-list">{d.complaints.length ? d.complaints.map((t, i) => <li key={i}>{t}</li>) : <li className="muted">Nenhuma identificada.</li>}</ul>
          </section>
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <h3>Recomendações</h3>
            <ul className="ans-list">{d.recs.length ? d.recs.map((t, i) => <li key={i}>{t}</li>) : <li className="muted">Colete mais respostas abertas para gerar recomendações.</li>}</ul>
          </section>
        </div>
      )}
    </div>
  );
}

export { formResponses };

function PasaImport({ wsId, onClose }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [token, setToken] = useState(null);
  const [list, setList] = useState([]);
  const [sel, setSel] = useState({});
  const [done, setDone] = useState(null);
  const connect = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy('Entrando…');
    try {
      const t = await pasaLogin(email.trim(), pw);
      setPw('');
      setBusy('Buscando pesquisas…');
      const surveys = await pasaSurveys(t);
      setToken(t);
      setList(surveys);
      setSel(Object.fromEntries(surveys.map((s) => [s.id, true])));
      if (!surveys.length) setErr('Nenhuma pesquisa encontrada nessa conta.');
    } catch (x) {
      setErr(x.message || 'Não foi possível conectar.');
    }
    setBusy('');
  };
  const run = async () => {
    const ids = list.filter((s) => sel[s.id]).map((s) => s.id);
    if (!ids.length) return;
    setErr('');
    setBusy('Importando perguntas e lógicas…');
    try {
      const { fields, sections } = await pasaDetails(token, ids);
      const conv = list.filter((s) => sel[s.id]).map((s) => convertSurvey(s, fields, sections));
      storeImported(wsId, conv);
      setDone(conv);
    } catch (x) {
      setErr(x.message || 'Falha ao importar.');
    }
    setBusy('');
  };
  return (
    <Modal title="Importar do painel PASA" onClose={onClose} wide>
      {done ? (
        <div>
          <p>
            <b>{done.length} pesquisa(s) importada(s).</b> As que já existiam aqui foram atualizadas e continuam no mesmo projeto; as novas estão no Lobby.
          </p>
          <ul className="ans-list">
            {done.map(({ form, count, notes }) => (
              <li key={form.source.id}>
                {form.title} — {count} pergunta(s), {form.questions.reduce((n, q) => n + (q.logic?.length || 0), 0)} regra(s) de pulo
                {form.questions.some((q) => q.visibility) ? ', com perguntas condicionais' : ''}
                {notes.length > 0 && <div className="small muted">{notes.join(' ')}</div>}
              </li>
            ))}
          </ul>
          <p className="small muted">As respostas já coletadas no PASA não foram trazidas; só a estrutura das pesquisas.</p>
          <button type="button" className="btn-dark" onClick={onClose}>
            Concluir
          </button>
        </div>
      ) : !token ? (
        <form onSubmit={connect}>
          <p className="muted" style={{ marginBottom: 14 }}>
            Entre com a mesma conta que você usa no pesquisamkt.online. O login é feito direto com o painel PASA, a partir deste navegador; a senha não é guardada.
          </p>
          <label className="fld">
            <span>E-mail</span>
            <input id="pasa-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="fld">
            <span>Senha</span>
            <input id="pasa-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          {err && <p className="l-err">{err}</p>}
          <button className="btn-dark" disabled={!!busy || !email || !pw}>
            {busy || 'Conectar e listar pesquisas'}
          </button>
        </form>
      ) : (
        <div>
          <p className="muted" style={{ marginBottom: 10 }}>
            Escolha o que importar. Pesquisas com o mesmo nome que já existem aqui são atualizadas, sem mudar de projeto.
          </p>
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="link" onClick={() => setSel(Object.fromEntries(list.map((s) => [s.id, true])))}>
              marcar todas
            </button>
            <button type="button" className="link" onClick={() => setSel({})}>
              desmarcar
            </button>
          </div>
          <div className="pasa-list">
            {list.map((s) => (
              <label key={s.id} className="chk">
                <input type="checkbox" checked={!!sel[s.id]} onChange={(e) => setSel({ ...sel, [s.id]: e.target.checked })} />
                <span>
                  {s.title} <span className="muted small">· {s.status === 'active' ? 'Ativa' : s.status || '—'}</span>
                </span>
              </label>
            ))}
          </div>
          {err && <p className="l-err">{err}</p>}
          <button type="button" className="btn-dark" disabled={!!busy || !Object.values(sel).some(Boolean)} onClick={run}>
            {busy || `Importar ${Object.values(sel).filter(Boolean).length} pesquisa(s)`}
          </button>
        </div>
      )}
    </Modal>
  );
}
