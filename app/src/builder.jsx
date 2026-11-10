import React, { useEffect, useState } from 'react';
import { db, save, getForm, newQuestion, QUESTION_TYPES, typeInfo, CHOICE_TYPES, uid } from './store.js';
import { go, Link, Modal } from './shared.jsx';
import { TopBar, wsPath } from './dashboard.jsx';
import { FormRunner } from './fill.jsx';
import { Results } from './results.jsx';

const TABS = [
  ['create', 'Criar'],
  ['logic', 'Lógica'],
  ['design', 'Design'],
  ['settings', 'Configurações'],
  ['connect', 'Conectar'],
  ['share', 'Compartilhar'],
  ['results', 'Resultados'],
];

const touch = (f, fn) =>
  save(() => {
    fn(f);
    f.updatedAt = Date.now();
  });

export function Builder() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const f = getForm(id);
  const [tab, setTabState] = useState(params.get('tab') || 'create');
  const [sel, setSel] = useState(null);
  useEffect(() => {
    if (f) document.title = `${f.title} · Formaria`;
  }, [f?.title]);
  if (!f)
    return (
      <div className="app">
        <TopBar />
        <div className="empty">
          <h2>Formulário não encontrado</h2>
          <Link to={wsPath(db().workspaces[0].id)} className="btn-dark">
            Voltar
          </Link>
        </div>
      </div>
    );
  const setTab = (t) => {
    setTabState(t);
    const u = new URL(location.href);
    u.searchParams.set('tab', t);
    history.replaceState({}, '', u);
  };
  return (
    <div className="app builder">
      <TopBar>
        <div className="b-crumb">
          <Link to={wsPath(f.workspaceId)}>{db().workspaces.find((w) => w.id === f.workspaceId)?.name || 'Espaço'}</Link>
          <span>/</span>
          <input className="b-title" value={f.title} aria-label="Nome do formulário" onChange={(e) => touch(f, (x) => (x.title = e.target.value))} />
        </div>
      </TopBar>
      <nav className="b-tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
        <div className="b-tabs-r">
          <button type="button" className="btn-light" onClick={() => window.open(`/f/?id=${f.id}&preview=1`, '_blank')}>
            Visualizar
          </button>
          <button
            type="button"
            className="btn-dark"
            onClick={() => {
              touch(f, (x) => (x.published = true));
              setTab('share');
            }}
          >
            {f.published ? 'Publicado ✓' : 'Publicar'}
          </button>
        </div>
      </nav>
      {tab === 'create' && <CreateTab f={f} sel={sel} setSel={setSel} />}
      {tab === 'logic' && <LogicTab f={f} />}
      {tab === 'design' && <DesignTab f={f} />}
      {tab === 'settings' && <SettingsTab f={f} />}
      {tab === 'connect' && <ConnectTab f={f} />}
      {tab === 'share' && <ShareTab f={f} />}
      {tab === 'results' && <Results f={f} />}
    </div>
  );
}

// ---------------- Create ----------------
function AddMenu({ onPick, onClose }) {
  const groups = [...new Set(QUESTION_TYPES.map((t) => t.group))];
  return (
    <Modal title="Adicionar pergunta" onClose={onClose} wide>
      <div className="add-grid">
        {groups.map((g) => (
          <div key={g}>
            <h4>{g}</h4>
            {QUESTION_TYPES.filter((t) => t.group === g).map((t) => (
              <button type="button" key={t.type} className="add-item" onClick={() => onPick(t.type)}>
                <span className={'qicon g-' + g.toLowerCase()}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function CreateTab({ f, sel, setSel }) {
  const [adding, setAdding] = useState(false);
  const current = sel === 'welcome' || sel === 'ending' ? sel : f.questions.find((q) => q.id === sel) || null;
  const add = (type) => {
    const q = newQuestion(type);
    touch(f, (x) => x.questions.push(q));
    setSel(q.id);
    setAdding(false);
  };
  const move = (i, d) =>
    touch(f, (x) => {
      const j = i + d;
      if (j < 0 || j >= x.questions.length) return;
      [x.questions[i], x.questions[j]] = [x.questions[j], x.questions[i]];
    });
  const [drag, setDrag] = useState(null);
  return (
    <div className="b-create">
      <aside className="b-list">
        <button type="button" className="btn-dark full" onClick={() => setAdding(true)}>
          + Adicionar pergunta
        </button>
        <button type="button" className={'b-item screen' + (sel === 'welcome' ? ' on' : '')} onClick={() => setSel('welcome')}>
          <span className="qicon">▶</span>
          <span className="b-item-t">Tela de boas-vindas {f.welcome.enabled ? '' : '(desligada)'}</span>
        </button>
        <ol className="b-qs">
          {f.questions.map((q, i) => (
            <li
              key={q.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag === null || drag === i) return;
                touch(f, (x) => {
                  const [m] = x.questions.splice(drag, 1);
                  x.questions.splice(i, 0, m);
                });
                setDrag(null);
              }}
            >
              <button type="button" className={'b-item' + (sel === q.id ? ' on' : '')} onClick={() => setSel(q.id)}>
                <span className={'qicon g-' + typeInfo(q.type).group.toLowerCase()}>{i + 1}</span>
                <span className="b-item-t">{q.title || <em>{typeInfo(q.type).label}</em>}</span>
                {q.logic?.length > 0 && <span className="b-tag">lógica</span>}
              </button>
              <span className="b-item-ops">
                <button type="button" aria-label="Subir" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label="Descer" onClick={() => move(i, 1)}>
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className={'b-item screen' + (sel === 'ending' ? ' on' : '')} onClick={() => setSel('ending')}>
          <span className="qicon">■</span>
          <span className="b-item-t">Tela final</span>
        </button>
      </aside>
      <section className="b-preview">
        <div className="b-preview-frame">
          <FormRunner f={f} preview focus={current ? (typeof current === 'string' ? current : current.id) : 'welcome'} key={sel || 'w'} />
        </div>
      </section>
      <aside className="b-props">
        {!current && <p className="muted">Escolha uma pergunta à esquerda ou adicione uma nova.</p>}
        {current === 'welcome' && <WelcomeProps f={f} />}
        {current === 'ending' && <EndingProps f={f} />}
        {current && typeof current === 'object' && <QuestionProps f={f} q={current} onDelete={() => setSel(null)} />}
      </aside>
      {adding && <AddMenu onPick={add} onClose={() => setAdding(false)} />}
    </div>
  );
}

function Fld({ label, children, hint }) {
  return (
    <label className="fld">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <label className="chk">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function WelcomeProps({ f }) {
  const w = f.welcome;
  return (
    <div>
      <h3>Tela de boas-vindas</h3>
      <Check label="Mostrar tela de boas-vindas" checked={w.enabled} onChange={(v) => touch(f, () => (w.enabled = v))} />
      <Fld label="Título">
        <input value={w.title} onChange={(e) => touch(f, () => (w.title = e.target.value))} />
      </Fld>
      <Fld label="Descrição">
        <textarea rows={3} value={w.description} onChange={(e) => touch(f, () => (w.description = e.target.value))} />
      </Fld>
      <Fld label="Texto do botão">
        <input value={w.button} onChange={(e) => touch(f, () => (w.button = e.target.value))} />
      </Fld>
    </div>
  );
}
function EndingProps({ f }) {
  const e0 = f.ending;
  return (
    <div>
      <h3>Tela final</h3>
      <Fld label="Título" hint="Use {{score}} para mostrar a pontuação e {{ref}} para citar respostas.">
        <input value={e0.title} onChange={(e) => touch(f, () => (e0.title = e.target.value))} />
      </Fld>
      <Fld label="Descrição">
        <textarea rows={3} value={e0.description} onChange={(e) => touch(f, () => (e0.description = e.target.value))} />
      </Fld>
      <Fld label="Botão (opcional)">
        <input value={e0.button} onChange={(e) => touch(f, () => (e0.button = e.target.value))} />
      </Fld>
      <Fld label="Link do botão">
        <input value={e0.buttonUrl} placeholder="https://" onChange={(e) => touch(f, () => (e0.buttonUrl = e.target.value))} />
      </Fld>
      <p className="muted small">Para levar a pessoa direto para outra página ao terminar, use “Redirecionar ao final” em Configurações.</p>
    </div>
  );
}

function QuestionProps({ f, q, onDelete }) {
  const set = (fn) => touch(f, () => fn(q));
  const info = typeInfo(q.type);
  return (
    <div>
      <h3>
        <span className={'qicon g-' + info.group.toLowerCase()}>{info.icon}</span> {info.label}
      </h3>
      <Fld label="Tipo">
        <select
          value={q.type}
          onChange={(e) =>
            set((x) => {
              const n = newQuestion(e.target.value);
              x.type = n.type;
              x.settings = n.settings;
              if (CHOICE_TYPES.includes(n.type) && !x.options.length) x.options = n.options;
            })
          }
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
      </Fld>
      <Fld label="Pergunta" hint="Cite respostas anteriores com {{apelido}}, ex.: Prazer, {{nome}}!">
        <textarea rows={2} value={q.title} onChange={(e) => set((x) => (x.title = e.target.value))} />
      </Fld>
      <Fld label="Descrição">
        <input value={q.description} onChange={(e) => set((x) => (x.description = e.target.value))} />
      </Fld>
      <Fld label="Apelido da resposta" hint="Usado para citar a resposta em outras perguntas e nas integrações.">
        <input value={q.ref} placeholder="ex.: nome" onChange={(e) => set((x) => (x.ref = e.target.value.replace(/\s+/g, '_')))} />
      </Fld>
      {q.type !== 'statement' && <Check label="Obrigatória" checked={q.required} onChange={(v) => set((x) => (x.required = v))} />}
      {CHOICE_TYPES.includes(q.type) && (
        <div className="opts">
          <span className="fld-l">Opções e pontos</span>
          {q.options.map((o, i) => (
            <div className="opt-row" key={o.id}>
              <input value={o.label} aria-label={`Opção ${i + 1}`} onChange={(e) => set(() => (o.label = e.target.value))} />
              <input type="number" className="pts" value={o.score || 0} aria-label="Pontos" title="Pontos" onChange={(e) => set(() => (o.score = +e.target.value))} />
              <button type="button" className="icon-btn" aria-label="Remover opção" onClick={() => set((x) => (x.options = x.options.filter((y) => y.id !== o.id)))}>
                ✕
              </button>
              {q.type === 'picture_choice' && (
                <label className="img-pick">
                  {o.image ? <img src={o.image} alt="" /> : 'imagem'}
                  <input type="file" accept="image/*" hidden onChange={(e) => readImage(e, (url) => set(() => (o.image = url)))} />
                </label>
              )}
            </div>
          ))}
          <button type="button" className="link" onClick={() => set((x) => x.options.push({ id: uid('o_'), label: `Opção ${x.options.length + 1}`, score: 0, image: '' }))}>
            + Adicionar opção
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              const t = prompt('Cole as opções, uma por linha');
              if (t) set((x) => (x.options = t.split('\n').filter(Boolean).map((l) => ({ id: uid('o_'), label: l.trim(), score: 0, image: '' }))));
            }}
          >
            Colar várias
          </button>
        </div>
      )}
      {q.type === 'multiple_choice' && (
        <>
          <Check label="Permitir várias respostas" checked={q.settings.multiple} onChange={(v) => set((x) => (x.settings.multiple = v))} />
          <Check label='Incluir opção "Outro"' checked={q.settings.other} onChange={(v) => set((x) => (x.settings.other = v))} />
          <Check label="Embaralhar opções" checked={q.settings.shuffle} onChange={(v) => set((x) => (x.settings.shuffle = v))} />
        </>
      )}
      {q.type === 'rating' && (
        <Fld label="Quantidade de estrelas">
          <input type="number" min="3" max="10" value={q.settings.steps} onChange={(e) => set((x) => (x.settings.steps = +e.target.value))} />
        </Fld>
      )}
      {q.type === 'opinion_scale' && (
        <div className="row2">
          <Fld label="De">
            <input type="number" value={q.settings.from} onChange={(e) => set((x) => (x.settings.from = +e.target.value))} />
          </Fld>
          <Fld label="Até">
            <input type="number" value={q.settings.to} onChange={(e) => set((x) => (x.settings.to = +e.target.value))} />
          </Fld>
          <Fld label="Rótulo esquerdo">
            <input value={q.settings.left} onChange={(e) => set((x) => (x.settings.left = e.target.value))} />
          </Fld>
          <Fld label="Rótulo direito">
            <input value={q.settings.right} onChange={(e) => set((x) => (x.settings.right = e.target.value))} />
          </Fld>
        </div>
      )}
      {(q.type === 'short_text' || q.type === 'long_text') && (
        <Fld label="Limite de caracteres">
          <input type="number" value={q.settings.max || ''} onChange={(e) => set((x) => (x.settings.max = e.target.value))} />
        </Fld>
      )}
      {q.type === 'number' && (
        <div className="row2">
          <Fld label="Mínimo">
            <input type="number" value={q.settings.min ?? ''} onChange={(e) => set((x) => (x.settings.min = e.target.value))} />
          </Fld>
          <Fld label="Máximo">
            <input type="number" value={q.settings.max ?? ''} onChange={(e) => set((x) => (x.settings.max = e.target.value))} />
          </Fld>
        </div>
      )}
      {q.type === 'email' && <Check label="Exigir e-mail de trabalho (recusa Gmail, Hotmail…)" checked={q.settings.work} onChange={(v) => set((x) => (x.settings.work = v))} />}
      {q.type === 'phone' && <Check label="Mostrar botão de WhatsApp nas respostas" checked={q.settings.whatsapp !== false} onChange={(v) => set((x) => (x.settings.whatsapp = v))} />}
      {q.type === 'cnpj' && <Check label="Buscar dados da empresa pelo CNPJ" checked={q.settings.lookup !== false} onChange={(v) => set((x) => (x.settings.lookup = v))} />}
      {q.type === 'calendly' && (
        <Fld label="Link do Calendly" hint="Ex.: https://calendly.com/seu-nome/30min">
          <input value={q.settings.url} onChange={(e) => set((x) => (x.settings.url = e.target.value))} />
        </Fld>
      )}
      <Fld label="Imagem ou vídeo (opcional)" hint="Link de uma imagem ou de um vídeo do YouTube.">
        <input value={q.settings.media || ''} placeholder="https://" onChange={(e) => set((x) => (x.settings.media = e.target.value))} />
      </Fld>
      <div className="row">
        <button
          type="button"
          className="btn-light"
          onClick={() =>
            touch(f, (x) => {
              const i = x.questions.indexOf(q);
              const c = JSON.parse(JSON.stringify(q));
              c.id = uid('q_');
              x.questions.splice(i + 1, 0, c);
            })
          }
        >
          Duplicar
        </button>
        <button
          type="button"
          className="btn-light danger"
          onClick={() => {
            touch(f, (x) => {
              x.questions = x.questions.filter((y) => y.id !== q.id);
              x.questions.forEach((y) => (y.logic = (y.logic || []).filter((l) => l.to !== q.id)));
            });
            onDelete();
          }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

export function readImage(e, cb) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 1.5e6) return alert('Use uma imagem de até 1,5 MB.');
  const r = new FileReader();
  r.onload = () => cb(r.result);
  r.readAsDataURL(file);
}

// ---------------- Logic ----------------
const OPS = [
  ['eq', 'é igual a'],
  ['neq', 'é diferente de'],
  ['contains', 'contém'],
  ['gt', 'é maior que'],
  ['lt', 'é menor que'],
  ['gte', 'é maior ou igual a'],
  ['lte', 'é menor ou igual a'],
  ['answered', 'foi respondida'],
  ['empty', 'ficou em branco'],
  ['not_contains', 'não contém'],
  ['starts_with', 'começa com'],
  ['ends_with', 'termina com'],
  ['always', 'sempre (em qualquer caso)'],
  ['multi', 'várias condições (importada)'],
];
function LogicTab({ f }) {
  return (
    <div className="b-page">
      <h2>Lógica condicional</h2>
      <p className="muted">Mostre caminhos diferentes conforme as respostas. As regras de cada pergunta são lidas de cima para baixo; a primeira que bater decide o próximo passo.</p>
      {f.questions.length === 0 && <p>Adicione perguntas primeiro.</p>}
      {f.questions.map((q, i) => (
        <div className="panel" key={q.id}>
          <h3>
            {i + 1}. {q.title || typeInfo(q.type).label}
          </h3>
          {(q.logic || []).map((l, k) => (
            <div className="logic-row" key={k}>
              <span>Se a resposta</span>
              <select value={l.op} onChange={(e) => touch(f, () => (l.op = e.target.value))} aria-label="Condição">
                {OPS.map(([o, t]) => (
                  <option key={o} value={o}>
                    {t}
                  </option>
                ))}
              </select>
              {l.op === 'multi' && <span className="muted small">{(l.conds || []).length} condição(ões) em outras perguntas</span>}
              {!['always', 'answered', 'empty', 'multi'].includes(l.op) &&
                (CHOICE_TYPES.includes(q.type) || q.type === 'yes_no' ? (
                  <select value={l.value} onChange={(e) => touch(f, () => (l.value = e.target.value))} aria-label="Valor">
                    <option value="">—</option>
                    {(q.type === 'yes_no' ? [{ label: 'Sim' }, { label: 'Não' }] : q.options).map((o) => (
                      <option key={o.label}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input value={l.value} onChange={(e) => touch(f, () => (l.value = e.target.value))} aria-label="Valor" />
                ))}
              <span>ir para</span>
              <select value={l.to} onChange={(e) => touch(f, () => (l.to = e.target.value))} aria-label="Destino">
                {f.questions
                  .filter((x) => x.id !== q.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {f.questions.indexOf(x) + 1}. {(x.title || typeInfo(x.type).label).slice(0, 40)}
                    </option>
                  ))}
                <option value="end">Tela final</option>
              </select>
              <button type="button" className="icon-btn" aria-label="Remover regra" onClick={() => touch(f, () => q.logic.splice(k, 1))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="link" onClick={() => touch(f, () => (q.logic = [...(q.logic || []), { op: 'eq', value: '', to: f.questions[i + 1]?.id || 'end' }]))}>
            + Adicionar regra
          </button>
        </div>
      ))}
      <div className="panel">
        <h3>Campos ocultos</h3>
        <p className="muted">Valores que chegam pelo link (ex.: ?utm_source=instagram&vendedor=ana) e ficam salvos com cada resposta. Também podem ser citados com {'{{nome_do_campo}}'}.</p>
        <TagInput
          values={f.settings.hiddenFields}
          onChange={(v) => touch(f, () => (f.settings.hiddenFields = v))}
          placeholder="utm_source, utm_campaign, vendedor…"
        />
      </div>
    </div>
  );
}

function TagInput({ values, onChange, placeholder }) {
  const [t, setT] = useState('');
  return (
    <div className="tags">
      {values.map((v) => (
        <span className="tag" key={v}>
          {v}
          <button type="button" aria-label={`Remover ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            ✕
          </button>
        </span>
      ))}
      <input
        value={t}
        placeholder={placeholder}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && t.trim()) {
            e.preventDefault();
            const n = t.trim().replace(/\s+/g, '_');
            if (!values.includes(n)) onChange([...values, n]);
            setT('');
          }
        }}
      />
    </div>
  );
}

// ---------------- Design ----------------
const THEMES = [
  { name: 'Clássico', bg: '#ffffff', question: '#3c323e', answer: '#4e3f8a', button: '#3c323e', buttonText: '#ffffff' },
  { name: 'Noite', bg: '#1f1a24', question: '#ffffff', answer: '#c9b6ff', button: '#c9b6ff', buttonText: '#1f1a24' },
  { name: 'Floresta', bg: '#26422f', question: '#f2efe6', answer: '#d7f2a6', button: '#d7f2a6', buttonText: '#26422f' },
  { name: 'Lavanda', bg: '#efe7ff', question: '#2d2142', answer: '#6a3fd1', button: '#6a3fd1', buttonText: '#ffffff' },
  { name: 'Areia', bg: '#f6efe3', question: '#4a3628', answer: '#b4542b', button: '#b4542b', buttonText: '#ffffff' },
  { name: 'Oceano', bg: '#0f3b57', question: '#ffffff', answer: '#7fe0ff', button: '#ffffff', buttonText: '#0f3b57' },
];
const FONTS = ['system-ui', 'Georgia', 'Arial', 'Verdana', 'Trebuchet MS', 'Courier New', 'Times New Roman'];
function DesignTab({ f }) {
  const t = f.theme;
  const set = (k, v) => touch(f, () => (t[k] = v));
  return (
    <div className="b-split">
      <div className="b-page">
        <h2>Design</h2>
        <h3>Temas</h3>
        <div className="themes">
          {THEMES.map((th) => (
            <button type="button" key={th.name} className={'theme' + (t.name === th.name ? ' on' : '')} style={{ background: th.bg, color: th.question }} onClick={() => touch(f, () => Object.assign(t, th))}>
              <b>Aa</b>
              <i style={{ background: th.button }} />
              <span>{th.name}</span>
            </button>
          ))}
        </div>
        <h3>Personalizar</h3>
        <div className="colors">
          {[
            ['bg', 'Fundo'],
            ['question', 'Perguntas'],
            ['answer', 'Respostas'],
            ['button', 'Botões'],
            ['buttonText', 'Texto do botão'],
          ].map(([k, l]) => (
            <label key={k} className="color">
              <input type="color" value={t[k]} onChange={(e) => touch(f, () => ((t[k] = e.target.value), (t.name = 'Personalizado')))} />
              {l}
            </label>
          ))}
        </div>
        <Fld label="Fonte">
          <select value={t.font} onChange={(e) => set('font', e.target.value)}>
            {FONTS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Fld>
        <Fld label="Alinhamento">
          <select value={t.align} onChange={(e) => set('align', e.target.value)}>
            <option value="left">À esquerda</option>
            <option value="center">Centralizado</option>
          </select>
        </Fld>
        <div className="row">
          <label className="btn-light">
            {t.logo ? 'Trocar logotipo' : 'Enviar logotipo'}
            <input type="file" accept="image/*" hidden onChange={(e) => readImage(e, (u) => set('logo', u))} />
          </label>
          {t.logo && (
            <button type="button" className="link" onClick={() => set('logo', '')}>
              remover logotipo
            </button>
          )}
          <label className="btn-light">
            {t.bgImage ? 'Trocar imagem de fundo' : 'Imagem de fundo'}
            <input type="file" accept="image/*" hidden onChange={(e) => readImage(e, (u) => set('bgImage', u))} />
          </label>
          {t.bgImage && (
            <button type="button" className="link" onClick={() => set('bgImage', '')}>
              remover fundo
            </button>
          )}
        </div>
        <Check label="Remover a nossa marca do formulário" checked={f.settings.removeBranding} onChange={(v) => touch(f, () => (f.settings.removeBranding = v))} />
      </div>
      <div className="b-preview-frame side">
        <FormRunner f={f} preview focus={f.questions[0]?.id || 'welcome'} />
      </div>
    </div>
  );
}

// ---------------- Settings ----------------
function SettingsTab({ f }) {
  const s = f.settings;
  const set = (k, v) => touch(f, () => (s[k] = v));
  return (
    <div className="b-page">
      <h2>Configurações</h2>
      <div className="panel">
        <h3>Geral</h3>
        <Check label="Barra de progresso" checked={s.progressBar} onChange={(v) => set('progressBar', v)} />
        <Check label="Numerar perguntas" checked={s.questionNumbers} onChange={(v) => set('questionNumbers', v)} />
        <Check label="Mostrar tempo estimado na abertura" checked={s.showTimeToComplete} onChange={(v) => set('showTimeToComplete', v)} />
        <Fld label="Idioma dos botões e mensagens">
          <select value={s.language} onChange={(e) => set('language', e.target.value)}>
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </Fld>
      </div>
      <div className="panel">
        <h3>Respostas</h3>
        <Check label="Recuperação automática de abandonos (salva cada resposta assim que é dada)" checked={s.partialResponses} onChange={(v) => set('partialResponses', v)} />
        <Check label="Impedir respostas duplicadas (uma resposta por pessoa/aparelho)" checked={s.preventDuplicates} onChange={(v) => set('preventDuplicates', v)} />
        <Check label="Exigir e-mail de trabalho em todos os campos de e-mail" checked={s.requireWorkEmail} onChange={(v) => set('requireWorkEmail', v)} />
        <Fld label="Redirecionar ao final para" hint="Você pode usar {{apelido}} para enviar respostas no link.">
          <input value={s.redirectUrl} placeholder="https://seusite.com.br/obrigado" onChange={(e) => set('redirectUrl', e.target.value)} />
        </Fld>
      </div>
      <div className="panel">
        <h3>Fechamento</h3>
        <Check label="Fechar o formulário agora" checked={s.closed} onChange={(v) => set('closed', v)} />
        <Fld label="Fechar automaticamente em">
          <input type="datetime-local" value={s.closeAt} onChange={(e) => set('closeAt', e.target.value)} />
        </Fld>
        <Fld label="Fechar ao atingir este número de respostas">
          <input type="number" min="1" value={s.responseLimit} onChange={(e) => set('responseLimit', e.target.value)} />
        </Fld>
        <Fld label="Mensagem quando fechado">
          <input value={s.closedMessage} onChange={(e) => set('closedMessage', e.target.value)} />
        </Fld>
      </div>
      <div className="panel">
        <h3>Notificações</h3>
        <Fld label="Avisar este e-mail a cada resposta" hint="Abre seu programa de e-mail com o resumo pronto quando você clicar em “Avisar” nas respostas.">
          <input type="email" value={s.notifyEmail} onChange={(e) => set('notifyEmail', e.target.value)} />
        </Fld>
        <Check label="Mostrar à pessoa um resumo das próprias respostas no final" checked={s.respondentEmailCopy} onChange={(v) => set('respondentEmailCopy', v)} />
      </div>
    </div>
  );
}

// ---------------- Connect ----------------
function ConnectTab({ f }) {
  const tr = f.tracking;
  const ig = f.integrations;
  const setT = (k, v) => touch(f, () => (tr[k] = v));
  const [hook, setHook] = useState('');
  return (
    <div className="b-page">
      <h2>Conectar</h2>
      <div className="panel">
        <h3>Rastreamento de campanhas</h3>
        <p className="muted">Os códigos são carregados no formulário publicado e registram um evento de conversão.</p>
        <div className="row2">
          <Fld label="Google Analytics 4 (ID)">
            <input value={tr.ga4} placeholder="G-XXXXXXX" onChange={(e) => setT('ga4', e.target.value.trim())} />
          </Fld>
          <Fld label="Meta Pixel (ID)">
            <input value={tr.metaPixel} placeholder="123456789012345" onChange={(e) => setT('metaPixel', e.target.value.trim())} />
          </Fld>
          <Fld label="Google Tag Manager (ID)">
            <input value={tr.gtm} placeholder="GTM-XXXXXX" onChange={(e) => setT('gtm', e.target.value.trim())} />
          </Fld>
          <Fld label="Pixel do TikTok (ID)">
            <input value={tr.tiktok} placeholder="CXXXXXXXXXXXX" onChange={(e) => setT('tiktok', e.target.value.trim())} />
          </Fld>
          <Fld label="Pixel de anúncios do ChatGPT (ID)" hint="Recebe o mesmo evento de conversão pela camada de dados.">
            <input value={tr.openai} onChange={(e) => setT('openai', e.target.value.trim())} />
          </Fld>
          <Fld label="Disparar a conversão quando">
            <select value={tr.fireOn} onChange={(e) => setT('fireOn', e.target.value)}>
              <option value="submit">A pessoa envia o formulário</option>
              <option value="start">A pessoa começa a responder</option>
              <option value="logic">Uma regra de lógica leva à tela final</option>
            </select>
          </Fld>
        </div>
      </div>
      <div className="panel">
        <h3>Webhooks</h3>
        <p className="muted">Cada resposta é enviada em JSON (POST) para estes endereços — use com Zapier, Make, n8n ou seu sistema.</p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^https?:\/\//.test(hook)) return alert('Informe um endereço começando com https://');
            touch(f, () => ig.webhooks.push({ id: uid(), url: hook, on: true }));
            setHook('');
          }}
        >
          <input value={hook} placeholder="https://hooks.exemplo.com/..." onChange={(e) => setHook(e.target.value)} aria-label="Endereço do webhook" />
          <button className="btn-dark">Adicionar</button>
        </form>
        <ul className="members">
          {ig.webhooks.map((w) => (
            <li key={w.id}>
              <Check label={w.url} checked={w.on} onChange={(v) => touch(f, () => (w.on = v))} />
              <button type="button" className="link" onClick={() => touch(f, () => (ig.webhooks = ig.webhooks.filter((x) => x.id !== w.id)))}>
                remover
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="int-grid">
        <Integration f={f} k="rdstation" name="RD Station CRM" fields={[['token', 'Token da API']]} />
        <Integration f={f} k="kommo" name="Kommo" fields={[['url', 'Endereço do webhook da Kommo']]} />
        <Integration f={f} k="activecampaign" name="ActiveCampaign" fields={[['url', 'Endereço do webhook'], ['key', 'Lista ou tag']]} />
        <Integration f={f} k="sheets" name="Google Planilhas" fields={[['url', 'Endereço do Apps Script da planilha']]} />
        <Integration f={f} k="slack" name="Slack" fields={[['url', 'Endereço do webhook do canal']]} />
        <div className="panel int">
          <h3>WhatsApp</h3>
          <Check label="Botão para chamar no WhatsApp em cada resposta" checked={ig.whatsapp.enabled} onChange={(v) => touch(f, () => (ig.whatsapp.enabled = v))} />
          <Fld label="Mensagem inicial" hint="Use {{apelido}} para personalizar.">
            <input value={ig.whatsapp.message} onChange={(e) => touch(f, () => (ig.whatsapp.message = e.target.value))} />
          </Fld>
        </div>
      </div>
    </div>
  );
}
function Integration({ f, k, name, fields }) {
  const c = f.integrations[k];
  return (
    <div className="panel int">
      <h3>{name}</h3>
      <Check label="Enviar respostas" checked={c.enabled} onChange={(v) => touch(f, () => (c.enabled = v))} />
      {fields.map(([fk, l]) => (
        <Fld key={fk} label={l}>
          <input value={c[fk] || ''} onChange={(e) => touch(f, () => (c[fk] = e.target.value.trim()))} />
        </Fld>
      ))}
    </div>
  );
}

// ---------------- Share ----------------
function ShareTab({ f }) {
  const dom = db().account.customDomain;
  const base = dom ? `https://${dom}` : location.origin;
  const link = `${base}/f/?id=${f.id}`;
  const [mode, setMode] = useState('standard');
  const [copied, setCopied] = useState('');
  const copy = (t, k) => {
    navigator.clipboard?.writeText(t);
    setCopied(k);
    setTimeout(() => setCopied(''), 1500);
  };
  const codes = {
    standard: `<iframe src="${link}" style="width:100%;height:560px;border:0;border-radius:12px" allow="camera; microphone; autoplay; encrypted-media; clipboard-write"></iframe>`,
    fullpage: `<iframe src="${link}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`,
    popup: `<button onclick="var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center';o.onclick=function(e){if(e.target===o)o.remove()};o.innerHTML='<iframe src=&quot;${link}&quot; style=&quot;width:90%;max-width:720px;height:80%;border:0;border-radius:12px;background:#fff&quot;></iframe>';document.body.appendChild(o)">Responder</button>`,
    slider: `<iframe src="${link}" style="position:fixed;top:0;right:0;width:420px;max-width:100%;height:100%;border:0;box-shadow:-8px 0 30px rgba(0,0,0,.2);z-index:99999"></iframe>`,
  };
  return (
    <div className="b-page">
      <h2>Compartilhar</h2>
      {!f.published && (
        <div className="notice">
          Este formulário ainda é um rascunho.{' '}
          <button type="button" className="link" onClick={() => touch(f, () => (f.published = true))}>
            Publicar agora
          </button>
        </div>
      )}
      <div className="panel">
        <h3>Link</h3>
        <div className="row">
          <input readOnly value={link} aria-label="Link do formulário" onFocus={(e) => e.target.select()} />
          <button type="button" className="btn-dark" onClick={() => copy(link, 'l')}>
            {copied === 'l' ? 'Copiado!' : 'Copiar'}
          </button>
          <a className="btn-light" href={link} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
        <div className="row share-btns">
          <a className="btn-light" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(f.title + ' ' + link)}`}>
            WhatsApp
          </a>
          <a className="btn-light" target="_blank" rel="noreferrer" href={`mailto:?subject=${encodeURIComponent(f.title)}&body=${encodeURIComponent(link)}`}>
            E-mail
          </a>
          <a className="btn-light" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`}>
            LinkedIn
          </a>
          <a className="btn-light" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}>
            Facebook
          </a>
        </div>
        {f.settings.hiddenFields.length > 0 && (
          <p className="muted small">
            Com campos ocultos: {link}&{f.settings.hiddenFields.map((h) => `${h}=xxxxx`).join('&')}
          </p>
        )}
      </div>
      <div className="panel">
        <h3>Incorporar no seu site</h3>
        <div className="seg">
          {[
            ['standard', 'Na página'],
            ['fullpage', 'Página inteira'],
            ['popup', 'Pop-up'],
            ['slider', 'Painel lateral'],
          ].map(([k, l]) => (
            <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>
              {l}
            </button>
          ))}
        </div>
        <textarea className="code" readOnly rows={5} value={codes[mode]} aria-label="Código para incorporar" />
        <button type="button" className="btn-dark" onClick={() => copy(codes[mode], 'c')}>
          {copied === 'c' ? 'Copiado!' : 'Copiar código'}
        </button>
      </div>
      <div className="panel">
        <h3>Domínio personalizado</h3>
        <p className="muted">
          {dom ? `Seus links usam ${dom}.` : 'Use seu próprio domínio nos links.'}{' '}
          <Link to="/account">Configurar</Link>
        </p>
      </div>
    </div>
  );
}
