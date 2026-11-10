// Numbers for cards and dashboards, project flows (linked forms) and the local "diagnosis".
import { db, save, uid, formResponses } from './store.js';

export const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function projectsOf(d = db()) {
  if (!d.projects) d.projects = [];
  return d.projects;
}
// "all:<workspace>" is a view over every survey of a workspace (Respostas, Relatórios, Insights)
export const getProject = (id) => {
  if (id && id.startsWith('all:')) {
    const ws = id.slice(4);
    return { id, name: 'Todas as pesquisas', workspaceId: ws, flows: [], followups: [], layout: {}, color: '#2f6fd1', description: '', virtual: true };
  }
  return projectsOf().find((p) => p.id === id);
};
export const projectForms = (p) => db().forms.filter((f) => (p.virtual ? f.workspaceId === p.workspaceId : f.projectId === p.id));

export function newProject(workspaceId, name) {
  return {
    id: uid('p_'),
    name,
    description: '',
    color: ['#6a3fd1', '#1f8a5b', '#d1603f', '#2f6fd1', '#b4542b'][Math.floor(Math.random() * 5)],
    workspaceId,
    createdAt: Date.now(),
    flows: [],
    layout: {},
    followups: [],
  };
}

function plainValue(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return v.cnpj || v.cep || v.name || '';
  return String(v);
}

export function npsOf(values) {
  const n = values.map(Number).filter((x) => !Number.isNaN(x));
  if (!n.length) return null;
  const pro = n.filter((x) => x >= 9).length;
  const det = n.filter((x) => x <= 6).length;
  return Math.round(((pro - det) / n.length) * 100);
}

export function formStats(f) {
  const rs = formResponses(f.id);
  const done = rs.filter((r) => r.completed);
  const npsQs = f.questions.filter((q) => q.type === 'nps');
  const npsVals = [];
  npsQs.forEach((q) => rs.forEach((r) => r.answers[q.id] !== undefined && npsVals.push(r.answers[q.id])));
  const heat = [0, 0, 0, 0, 0, 0, 0];
  const since = Date.now() - 7 * 864e5;
  rs.forEach((r) => {
    const t = r.submittedAt || r.updatedAt || r.startedAt;
    if (t >= since) heat[(new Date(t).getDay() + 6) % 7]++;
  });
  const last = rs.reduce((m, r) => Math.max(m, r.submittedAt || r.updatedAt || 0), 0);
  const views = db().stats[f.id]?.views || 0;
  return {
    starts: rs.length,
    done: done.length,
    partial: rs.length - done.length,
    nps: npsOf(npsVals),
    npsCount: npsVals.length,
    heat,
    last,
    views,
    completion: rs.length ? Math.round((done.length / rs.length) * 100) : null,
  };
}

export const isActive = (f) => f.published && !f.settings.closed && !(f.settings.closeAt && new Date(f.settings.closeAt) < new Date());

export function globalStats(forms) {
  let starts = 0;
  let done = 0;
  const npsVals = [];
  forms.forEach((f) => {
    const s = formStats(f);
    starts += s.starts;
    done += s.done;
    f.questions
      .filter((q) => q.type === 'nps')
      .forEach((q) => formResponses(f.id).forEach((r) => r.answers[q.id] !== undefined && npsVals.push(r.answers[q.id])));
  });
  return {
    active: forms.filter(isActive).length,
    total: done,
    starts,
    nps: npsOf(npsVals),
    completion: starts ? Math.round((done / starts) * 100) : null,
  };
}

// ---------- flows ----------
function matches(cond, ans, f) {
  if (!cond || !cond.qid) return true;
  const q = f.questions.find((x) => x.id === cond.qid);
  const v = plainValue(ans[cond.qid]).toLowerCase();
  const val = String(cond.value ?? '').toLowerCase();
  const n = parseFloat(v);
  const m = parseFloat(val);
  switch (cond.op) {
    case 'eq': return v.split(', ').includes(val) || v === val;
    case 'neq': return !(v.split(', ').includes(val) || v === val);
    case 'contains': return v.includes(val);
    case 'gte': return n >= m;
    case 'lte': return n <= m;
    case 'answered': return v !== '';
    default: return !!q;
  }
}

function contactOf(f, ans) {
  const email = f.questions.find((q) => q.type === 'email');
  const phone = f.questions.find((q) => q.type === 'phone');
  const name = f.questions.find((q) => q.ref === 'nome' || /nome/i.test(q.title));
  return {
    email: email ? plainValue(ans[email.id]) : '',
    phone: phone ? plainValue(ans[phone.id]) : '',
    name: name ? plainValue(ans[name.id]) : '',
  };
}

export function flowLink(flow, from, ans, journeyId, hidden = {}) {
  const p = new URLSearchParams();
  p.set('id', flow.to);
  p.set('_j', journeyId);
  p.set('_from', from.id);
  const refs = flow.pass?.length ? flow.pass : from.questions.map((q) => q.ref).filter(Boolean);
  refs.forEach((ref) => {
    const q = from.questions.find((x) => x.ref === ref);
    const v = q ? plainValue(ans[q.id]) : hidden[ref];
    if (v) p.set(ref, v);
  });
  return `/f/?${p.toString()}`;
}

// Called when a form is submitted: returns the next form's address (or null),
// and schedules follow-ups for flows with a delay.
export function nextInJourney(f, ans, journeyId, hidden) {
  if (!f.projectId) return null;
  const p = getProject(f.projectId);
  if (!p) return null;
  const out = p.flows.filter((fl) => fl.from === f.id && db().forms.some((x) => x.id === fl.to) && matches(fl.cond, ans, f));
  const later = out.filter((fl) => +fl.delayDays > 0);
  if (later.length)
    save(() => {
      later.forEach((fl) =>
        p.followups.push({
          id: uid('fu_'),
          flowId: fl.id,
          to: fl.to,
          journeyId,
          due: Date.now() + fl.delayDays * 864e5,
          link: flowLink(fl, f, ans, journeyId, hidden),
          contact: contactOf(f, ans),
          done: false,
        })
      );
    });
  const now = out.find((fl) => !+fl.delayDays);
  return now ? flowLink(now, f, ans, journeyId, hidden) : null;
}

// order forms along the flows (roots first)
export function flowOrder(p, forms) {
  const ids = forms.map((f) => f.id);
  const incoming = Object.fromEntries(ids.map((i) => [i, 0]));
  p.flows.forEach((fl) => incoming[fl.to] !== undefined && incoming[fl.from] !== undefined && incoming[fl.to]++);
  const order = [];
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    p.flows.filter((fl) => fl.from === id).forEach((fl) => ids.includes(fl.to) && visit(fl.to));
  };
  ids.filter((i) => !incoming[i]).forEach(visit);
  ids.forEach(visit);
  return order.map((i) => forms.find((f) => f.id === i));
}

export function projectStats(p) {
  const forms = projectForms(p);
  const g = globalStats(forms);
  const ordered = flowOrder(p, forms);
  const funnel = ordered.map((f) => {
    const s = formStats(f);
    return { form: f, views: s.views, starts: s.starts, done: s.done };
  });
  const all = forms.flatMap((f) => formResponses(f.id).map((r) => ({ ...r, form: f })));
  const journeys = {};
  all.forEach((r) => {
    const j = r.journeyId || r.id;
    (journeys[j] = journeys[j] || []).push(r);
  });
  const jList = Object.entries(journeys).map(([id, rs]) => ({
    id,
    rs,
    forms: new Set(rs.filter((r) => r.completed).map((r) => r.form.id)),
    last: Math.max(...rs.map((r) => r.submittedAt || r.updatedAt || 0)),
  }));
  const fullCycle = jList.filter((j) => j.forms.size >= Math.max(1, ordered.length)).length;
  const multi = jList.filter((j) => j.forms.size > 1).length;
  const heat = [0, 0, 0, 0, 0, 0, 0];
  forms.forEach((f) => formStats(f).heat.forEach((v, i) => (heat[i] += v)));
  // Health score 0-100: NPS (40%), completion (35%), journey progress (25%)
  const npsPart = g.nps === null ? null : (g.nps + 100) / 2;
  const compPart = g.completion;
  const progPart = jList.length ? (jList.reduce((s, j) => s + j.forms.size, 0) / (jList.length * Math.max(1, ordered.length))) * 100 : null;
  const parts = [
    [npsPart, 0.4],
    [compPart, 0.35],
    [progPart, 0.25],
  ].filter(([v]) => v !== null && !Number.isNaN(v));
  const wsum = parts.reduce((s, [, w]) => s + w, 0);
  const health = parts.length ? Math.round(parts.reduce((s, [v, w]) => s + v * w, 0) / wsum) : null;
  const byAudience = {};
  forms.forEach((f) => {
    const k = f.audience || 'geral';
    const s = formStats(f);
    const a = (byAudience[k] = byAudience[k] || { forms: 0, done: 0, starts: 0, npsVals: [] });
    a.forms++;
    a.done += s.done;
    a.starts += s.starts;
    f.questions.filter((q) => q.type === 'nps').forEach((q) => formResponses(f.id).forEach((r) => r.answers[q.id] !== undefined && a.npsVals.push(r.answers[q.id])));
  });
  Object.values(byAudience).forEach((a) => (a.nps = npsOf(a.npsVals)));
  return { forms, ordered, g, funnel, journeys: jList, fullCycle, multi, heat, health, byAudience, all };
}

// numeric questions across a project's forms, for cross-form comparisons
export function numericQuestions(forms) {
  const out = [];
  forms.forEach((f) =>
    f.questions
      .filter((q) => ['nps', 'rating', 'opinion_scale', 'number'].includes(q.type))
      .forEach((q) => out.push({ key: f.id + ':' + q.id, label: `${f.title} → ${q.title || q.type}`, f, q }))
  );
  return out;
}

export function crossPairs(journeys, a, b) {
  const pairs = [];
  journeys.forEach((j) => {
    const ra = j.rs.find((r) => r.form.id === a.f.id && r.answers[a.q.id] !== undefined);
    const rb = j.rs.find((r) => r.form.id === b.f.id && r.answers[b.q.id] !== undefined);
    if (ra && rb) pairs.push([+ra.answers[a.q.id], +rb.answers[b.q.id]]);
  });
  let r = null;
  if (pairs.length >= 3) {
    const n = pairs.length;
    const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
    const my = pairs.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0, sx = 0, sy = 0;
    pairs.forEach(([x, y]) => {
      sxy += (x - mx) * (y - my);
      sx += (x - mx) ** 2;
      sy += (y - my) ** 2;
    });
    r = sx && sy ? sxy / Math.sqrt(sx * sy) : null;
  }
  return { pairs, r };
}

// ---------- local diagnosis of open answers ----------
const STOP = new Set('a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se não mais muito muita mas como ao aos à às eu você vocês ele ela eles elas nós me te lhe isso isto esse essa este esta aquele aquela foi ser ter tem tinha está estão estava pra pro já também só bem ou quando onde qual quais sobre até seu sua seus suas meu minha nosso nossa the and to of is it in for on with was are this that be at'.split(' '));
const POS = ['bom', 'boa', 'ótimo', 'ótima', 'otimo', 'excelente', 'gostei', 'adoro', 'amei', 'rápido', 'rapido', 'fácil', 'facil', 'satisfeito', 'perfeito', 'parabéns', 'recomendo', 'eficiente', 'atencioso', 'qualidade', 'top'];
const NEG = ['ruim', 'péssimo', 'pessimo', 'demora', 'demorado', 'lento', 'difícil', 'dificil', 'problema', 'erro', 'caro', 'reclamação', 'insatisfeito', 'falta', 'nunca', 'pior', 'confuso', 'bug', 'atraso', 'cancelar'];
const THEMES = {
  Preço: ['caro', 'preço', 'preco', 'valor', 'custo', 'barato', 'desconto'],
  Atendimento: ['atendimento', 'suporte', 'equipe', 'atencioso', 'resposta', 'contato'],
  Prazo: ['demora', 'atraso', 'prazo', 'rápido', 'rapido', 'lento', 'entrega'],
  Produto: ['produto', 'qualidade', 'funciona', 'recurso', 'bug', 'erro'],
  Comunicação: ['comunicação', 'informação', 'clareza', 'confuso', 'explicação'],
};

export function diagnose(forms) {
  const texts = [];
  forms.forEach((f) =>
    f.questions
      .filter((q) => ['short_text', 'long_text'].includes(q.type) && !/nome|e-?mail/i.test(q.title) && q.ref !== 'nome')
      .forEach((q) => formResponses(f.id).forEach((r) => r.answers[q.id] && texts.push({ t: String(r.answers[q.id]), form: f.title })))
  );
  const freq = {};
  let pos = 0;
  let neg = 0;
  const praise = [];
  const complaints = [];
  const themes = Object.fromEntries(Object.keys(THEMES).map((k) => [k, { pos: 0, neg: 0, n: 0 }]));
  texts.forEach(({ t }) => {
    const words = t.toLowerCase().normalize('NFC').match(/[\p{L}]+/gu) || [];
    let p = 0;
    let n = 0;
    words.forEach((w) => {
      if (w.length > 2 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
      if (POS.includes(w)) p++;
      if (NEG.includes(w)) n++;
    });
    pos += p;
    neg += n;
    if (p > n) praise.push(t);
    if (n > p) complaints.push(t);
    Object.entries(THEMES).forEach(([k, list]) => {
      if (words.some((w) => list.includes(w))) {
        themes[k].n++;
        if (p > n) themes[k].pos++;
        if (n > p) themes[k].neg++;
      }
    });
  });
  const terms = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
  const recs = [];
  Object.entries(themes)
    .filter(([, v]) => v.neg > 0)
    .sort((a, b) => b[1].neg - a[1].neg)
    .forEach(([k, v]) => recs.push(`${k}: ${v.neg} comentário(s) negativo(s). Priorize um plano de ação para ${k.toLowerCase()} e acompanhe na próxima rodada.`));
  Object.entries(themes)
    .filter(([, v]) => v.pos > v.neg && v.pos > 0)
    .forEach(([k, v]) => recs.push(`${k} é ponto forte (${v.pos} elogio(s)). Use isso na comunicação e nas páginas de captura.`));
  return { count: texts.length, terms, pos, neg, praise: praise.slice(0, 5), complaints: complaints.slice(0, 5), themes, recs };
}
