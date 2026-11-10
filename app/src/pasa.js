// Direct import from the person's own PASA survey panel (pesquisamkt.online).
// The person signs in with their own PASA account here, in their browser; the password is only
// sent to the panel's own sign-in service and is never stored.
import { db, save, uid, newForm, newQuestion } from './store.js';

const API = 'https://rqsspjkaahkisjnvpdcb.supabase.co';
// public browser key the panel itself ships to every visitor (it only works together with a sign-in)
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxc3NwamthYWhraXNqbnZwZGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDg5MDMsImV4cCI6MjA4ODEyNDkwM30.SFz0miq_GsFEW30ERBObLFNQ5P3PyjLKEAbUtC30RGA';

export async function pasaLogin(email, password) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(/invalid login/i.test(j.error_description || j.msg || '') || r.status === 400 ? 'E-mail ou senha incorretos no painel PASA.' : j.error_description || j.msg || 'Não foi possível entrar no painel PASA.');
  return j.access_token;
}

async function get(token, path) {
  const r = await fetch(`${API}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Não foi possível ler ${path.split('?')[0]} (${r.status}).`);
  return r.json();
}

export const pasaSurveys = (token) => get(token, 'surveys?select=*&order=updated_at.desc');

export async function pasaDetails(token, ids) {
  const list = `in.(${ids.join(',')})`;
  const [fields, sections] = await Promise.all([
    get(token, `survey_fields?select=*&survey_id=${list}&order=sort_order.asc`),
    get(token, `survey_sections?select=*&survey_id=${list}&order=sort_order.asc`).catch(() => []),
  ]);
  return { fields, sections };
}

// ---------- mapping ----------
const OPS = {
  equals: 'eq',
  not_equals: 'neq',
  contains: 'contains',
  not_contains: 'not_contains',
  greater_than: 'gt',
  less_than: 'lt',
  greater_equal: 'gte',
  less_equal: 'lte',
  starts_with: 'starts_with',
  ends_with: 'ends_with',
  is_empty: 'empty',
  is_not_empty: 'answered',
};

const optLabel = (o) => (o && typeof o === 'object' ? String(o.label ?? o.text ?? o.value ?? o.name ?? '') : String(o ?? ''));
const toOptions = (opts) =>
  (Array.isArray(opts) ? opts : [])
    .map((o) => ({ id: uid('o_'), label: optLabel(o), score: +(o?.score ?? o?.points ?? 0) || 0, image: (o && (o.image || o.imageUrl || o.image_url)) || '' }))
    .filter((o) => o.label);

function convertField(f, notes) {
  const s = f.settings || {};
  const v = f.validation || {};
  const base = (type, extra = {}) => {
    const q = newQuestion(type);
    return { ...q, id: f.id, title: f.label || '', description: f.description || '', required: !!f.required, source: { pasaType: f.type }, ...extra, settings: { ...q.settings, ...(extra.settings || {}) } };
  };
  switch (f.type) {
    case 'short_text':
    case 'text':
    case 'geolocation':
    case 'state_city':
      return [base('short_text', { settings: { max: v.maxLength || '' } })];
    case 'long_text':
    case 'textarea':
    case 'paragraph':
      return [base('long_text', { settings: { max: v.maxLength || '' } })];
    case 'signature':
      notes.add('Assinatura virou um campo de texto (nome completo).');
      return [base('short_text')];
    case 'email':
      return [base('email')];
    case 'phone':
      return [base('phone')];
    case 'cpf':
      return [base('cpf')];
    case 'cnpj':
      return [base('cnpj')];
    case 'cep':
      return [base('cep')];
    case 'url':
    case 'website':
      return [base('website')];
    case 'number':
    case 'currency':
      return [base('number', { settings: { min: v.min ?? s.min ?? '', max: v.max ?? s.max ?? '' } })];
    case 'date':
    case 'datetime':
    case 'time':
      return [base('date')];
    case 'single_select':
    case 'select':
    case 'radio':
      return [base('multiple_choice', { options: toOptions(f.options), settings: { multiple: false, other: !!s.allowOther, shuffle: !!s.randomize } })];
    case 'list_select':
    case 'dropdown':
      return [base('dropdown', { options: toOptions(f.options) })];
    case 'multi_select':
    case 'checkbox':
    case 'tags':
      return [base('multiple_choice', { options: toOptions(f.options), settings: { multiple: true, other: !!s.allowOther, shuffle: !!s.randomize } })];
    case 'image_select':
      return [base('picture_choice', { options: toOptions(f.options) })];
    case 'ranking':
      return [base('ranking', { options: toOptions(f.options) })];
    case 'nps':
      return [base('nps')];
    case 'stars':
    case 'rating':
      return [base('rating', { settings: { steps: s.max || s.steps || 5 } })];
    case 'slider':
    case 'likert': {
      const choices = Array.isArray(s.choices) && s.choices.length ? s.choices : null;
      if (choices) return [base('multiple_choice', { options: toOptions(choices) })];
      return [base('opinion_scale', { settings: { from: s.min ?? 1, to: s.max ?? 5, left: s.minLabel || s.leftLabel || '', right: s.maxLabel || s.rightLabel || '' } })];
    }
    case 'likert_matrix':
    case 'matrix': {
      const rows = Array.isArray(s.rows) && s.rows.length ? s.rows : ['Item'];
      const choices = Array.isArray(s.choices) && s.choices.length ? s.choices : ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'];
      notes.add('Perguntas em grade (matriz) viraram uma pergunta por linha.');
      return rows.map((row, i) => ({
        ...base('multiple_choice', { options: toOptions(choices) }),
        id: i === 0 ? f.id : `${f.id}__r${i}`,
        title: `${f.label || ''} — ${optLabel(row)}`,
        description: i === 0 ? f.description || '' : '',
      }));
    }
    case 'boolean':
    case 'yes_no':
      return [base('yes_no')];
    case 'lgpd_consent':
      return [base('legal', { title: f.label || s.consentText || 'Você concorda com o uso dos seus dados conforme a LGPD?' })];
    case 'file_upload':
      return [base('file_upload')];
    case 'section_break':
    case 'section_internal':
      return f.label ? [base('statement')] : [];
    case 'hidden':
    case 'lead_capture':
      return [];
    default:
      notes.add(`Tipo "${f.type}" importado como texto curto.`);
      return [base('short_text')];
  }
}

function condsOf(conds = []) {
  return conds.map((c, i) => ({ qid: c.fieldId, op: OPS[c.operator] || 'eq', value: c.value ?? '', join: i === 0 ? 'and' : c.logic === 'or' ? 'or' : 'and' }));
}

export function convertSurvey(s, fields, sections) {
  const notes = new Set();
  const settings = s.settings || {};
  const myFields = fields.filter((f) => f.survey_id === s.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const questions = [];
  const hidden = [];
  let lastSection = null;
  myFields.forEach((f) => {
    if ((f.settings || {}).disabled) return;
    if (f.type === 'hidden') {
      hidden.push((f.label || f.id).replace(/\s+/g, '_'));
      return;
    }
    if (f.type === 'lead_capture') notes.add('O bloco de captura de lead virou campos de contato separados.');
    const sec = sections.find((x) => x.id === f.section_id);
    if (sec && sec.id !== lastSection && sec.title) {
      questions.push({ ...newQuestion('statement'), id: `sec_${sec.id}`, title: sec.title, description: sec.description || '' });
      lastSection = sec.id;
    }
    if (f.type === 'lead_capture') {
      const opts = (f.settings || {}).leadOptions || ['name', 'email', 'phone'];
      opts.forEach((o) => {
        const k = String(o.key || o.value || o).toLowerCase();
        const t = /mail/.test(k) ? 'email' : /phone|tel|whats/.test(k) ? 'phone' : 'short_text';
        questions.push({ ...newQuestion(t), id: `${f.id}__${k}`, ref: /mail/.test(k) ? 'email' : /phone|tel|whats/.test(k) ? 'whatsapp' : 'nome', title: t === 'email' ? 'Seu e-mail' : t === 'phone' ? 'WhatsApp com DDD' : 'Seu nome', required: !!f.required });
      });
      return;
    }
    const qs = convertField(f, notes);
    // show / hide conditions
    const cl = f.conditional_logic;
    if (cl && cl.enabled && Array.isArray(cl.conditions) && cl.conditions.length)
      qs.forEach((q) => (q.visibility = { action: cl.action === 'hide' ? 'hide' : 'show', all: cl.operator === 'and', conds: condsOf(cl.conditions) }));
    questions.push(...qs);
  });
  // jump rules ("workflow")
  const wf = settings.workflow && typeof settings.workflow === 'object' ? settings.workflow : {};
  const target = (t) => (t === '__thank_you__' || t === '__end__' ? 'end' : questions.some((q) => q.id === t) ? t : null);
  // a grid question became several questions: its jumps leave from the last row
  const host = (id) => [...questions].reverse().find((x) => x.id === id || x.id.startsWith(id + '__r'));
  (Array.isArray(wf.rules) ? wf.rules : []).forEach((r) => {
    if (r.action && r.action !== 'jump_to') return;
    const q = host(r.sourceFieldId);
    const to = target(r.targetFieldId);
    if (!q || !to) return;
    const conds = condsOf(r.conditions);
    const simple = conds.length === 1 && conds[0].qid === r.sourceFieldId && q.id === r.sourceFieldId;
    q.logic.push(simple ? { op: conds[0].op, value: String(conds[0].value), to } : { op: 'multi', conds, value: '', to });
  });
  Object.entries(wf.fallbacks || {}).forEach(([fid, t]) => {
    const q = host(fid);
    const to = target(t);
    if (q && to) q.logic.push({ op: 'always', value: '', to });
  });
  const f = newForm(null, s.title || 'Pesquisa importada', questions);
  const welcome = s.welcome_message || '';
  f.welcome = { enabled: !!(welcome || s.description), title: s.title || '', description: welcome || s.description || '', button: 'Começar' };
  if (s.thank_you_message) f.ending = { ...f.ending, title: s.thank_you_message };
  f.settings.hiddenFields = hidden;
  f.published = s.status === 'active';
  f.audience = /^\s*VI\b/i.test(s.title || '') ? 'interno' : /^\s*VE\b/i.test(s.title || '') ? 'externo' : '';
  f.source = { kind: 'pasa', id: s.id, slug: s.slug || '', importedAt: Date.now() };
  return { form: f, notes: [...notes], count: questions.length };
}

// Adds or refreshes imported surveys. A survey imported before (same PASA id), or an earlier
// placeholder with the same title, is updated in place so its project stays the same.
export function storeImported(wsId, converted) {
  save((d) => {
    converted.forEach(({ form }) => {
      form.workspaceId = wsId;
      const prev = d.forms.find((x) => x.source?.kind === 'pasa' && x.source.id === form.source.id) || d.forms.find((x) => !x.source && x.title === form.title && x.workspaceId === wsId);
      if (prev) {
        Object.assign(prev, {
          questions: form.questions,
          welcome: form.welcome,
          ending: form.ending,
          published: form.published,
          audience: prev.audience || form.audience,
          source: form.source,
          updatedAt: Date.now(),
        });
        prev.settings.hiddenFields = form.settings.hiddenFields;
      } else {
        form.projectId = null;
        d.forms.unshift(form);
      }
    });
    d.account.pasaImported = true;
  });
}

export const pasaDone = () => !!db().account.pasaImported;
