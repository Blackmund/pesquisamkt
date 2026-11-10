import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getForm, save, uid, bumpStat, formResponses, typeInfo, CHOICE_TYPES } from './store.js';
import { Mark } from './shared.jsx';
import { nextInJourney } from './analytics.js';
import {
  validCPF, validCNPJ, maskCPF, maskCNPJ, maskCEP, maskPhone, phoneError, isWorkEmail, validEmail, lookupCEP, lookupCNPJ, digits,
} from './br.js';

const UI = {
  pt: { ok: 'OK', next: 'Próxima', submit: 'Enviar', req: 'Esta pergunta é obrigatória.', enter: 'aperte Enter ↵', type: 'Digite sua resposta aqui…', choose: 'Escolha uma opção', yes: 'Sim', no: 'Não', other: 'Outro', closed: 'Formulário fechado', dup: 'Você já respondeu este formulário. Obrigado!', min: 'min', takes: 'Leva', accept: 'Aceito', decline: 'Não aceito', made: 'Feito com Formaria', many: 'Escolha quantas quiser', email: 'Informe um e-mail válido.', work: 'Use um e-mail de trabalho (não Gmail, Hotmail etc.).', cpf: 'CPF inválido.', cnpj: 'CNPJ inválido.', cep: 'CEP não encontrado.', num: 'Informe um número', url: 'Informe um endereço válido (https://…)', summary: 'Suas respostas', upload: 'Escolher arquivo', number: 'Número', compl: 'Complemento', back: 'Voltar' },
  en: { ok: 'OK', next: 'Next', submit: 'Submit', req: 'Please fill this in.', enter: 'press Enter ↵', type: 'Type your answer here…', choose: 'Choose an option', yes: 'Yes', no: 'No', other: 'Other', closed: 'This form is closed', dup: 'You have already answered this form. Thanks!', min: 'min', takes: 'Takes', accept: 'I accept', decline: "I don't accept", made: 'Made with Formaria', many: 'Choose as many as you like', email: 'Enter a valid email.', work: 'Please use a work email.', cpf: 'Invalid CPF.', cnpj: 'Invalid CNPJ.', cep: 'Postcode not found.', num: 'Enter a number', url: 'Enter a valid web address', summary: 'Your answers', upload: 'Choose file', number: 'Number', compl: 'Complement', back: 'Back' },
  es: { ok: 'OK', next: 'Siguiente', submit: 'Enviar', req: 'Esta pregunta es obligatoria.', enter: 'pulsa Enter ↵', type: 'Escribe tu respuesta aquí…', choose: 'Elige una opción', yes: 'Sí', no: 'No', other: 'Otro', closed: 'Formulario cerrado', dup: 'Ya respondiste este formulario. ¡Gracias!', min: 'min', takes: 'Toma', accept: 'Acepto', decline: 'No acepto', made: 'Hecho con Formaria', many: 'Elige las que quieras', email: 'Correo no válido.', work: 'Usa un correo de trabajo.', cpf: 'CPF no válido.', cnpj: 'CNPJ no válido.', cep: 'Código postal no encontrado.', num: 'Escribe un número', url: 'Dirección no válida', summary: 'Tus respuestas', upload: 'Elegir archivo', number: 'Número', compl: 'Complemento', back: 'Volver' },
};

export function answerText(q, v) {
  if (v === undefined || v === null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') {
    if (q?.type === 'cep') return [v.street, v.number, v.complement, v.district, v.city && `${v.city}/${v.state}`, v.cep].filter(Boolean).join(', ');
    if (q?.type === 'cnpj') return [v.cnpj, v.company].filter(Boolean).join(' — ');
    if (q?.type === 'file_upload') return v.name;
    return JSON.stringify(v);
  }
  return String(v);
}

function fill(text, answers, f, hidden, score) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    if (k === 'score') return String(score);
    if (hidden && k in hidden) return hidden[k];
    const q = f.questions.find((x) => x.ref === k || x.id === k);
    return q ? answerText(q, answers[q.id]) : '';
  });
}

export function computeScore(f, answers) {
  let s = 0;
  for (const q of f.questions) {
    const v = answers[q.id];
    if (!CHOICE_TYPES.includes(q.type) || v == null) continue;
    const arr = Array.isArray(v) ? v : [v];
    q.options.forEach((o) => arr.includes(o.label) && (s += +o.score || 0));
  }
  return s;
}

function matches(rule, v) {
  const a = Array.isArray(v) ? v : [v];
  const txt = a.map((x) => (typeof x === 'object' ? answerText(null, x) : String(x ?? ''))).join(', ').toLowerCase();
  const val = String(rule.value ?? '').toLowerCase();
  const n = parseFloat(txt);
  const m = parseFloat(val);
  switch (rule.op) {
    case 'always': return true;
    case 'answered': return txt !== '';
    case 'eq': return a.some((x) => String(x).toLowerCase() === val);
    case 'neq': return !a.some((x) => String(x).toLowerCase() === val);
    case 'contains': return txt.includes(val);
    case 'gt': return n > m;
    case 'lt': return n < m;
    case 'gte': return n >= m;
    case 'lte': return n <= m;
    case 'not_contains': return !txt.includes(val);
    case 'starts_with': return txt.startsWith(val);
    case 'ends_with': return txt.endsWith(val);
    case 'empty': return txt === '';
    default: return false;
  }
}

// a list of conditions on any answers (imported rules), joined with and/or in order
function condsMatch(conds, answers) {
  let r = null;
  for (const c of conds || []) {
    const ok = matches({ op: c.op, value: c.value }, answers[c.qid]);
    r = r === null ? ok : c.join === 'or' ? r || ok : r && ok;
  }
  return r ?? false;
}
function ruleMatches(rule, v, answers) {
  return rule.op === 'multi' ? condsMatch(rule.conds, answers) : matches(rule, v);
}
export function isVisible(q, answers) {
  const vis = q.visibility;
  if (!vis || !vis.conds?.length) return true;
  const res = vis.all ? vis.conds.every((c) => matches({ op: c.op, value: c.value }, answers[c.qid])) : vis.conds.some((c) => matches({ op: c.op, value: c.value }, answers[c.qid]));
  return vis.action === 'hide' ? !res : res;
}

function validate(q, v, f, L) {
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  if (empty) return q.required ? L.req : '';
  switch (q.type) {
    case 'email':
      if (!validEmail(v)) return L.email;
      if ((q.settings.work || f.settings.requireWorkEmail) && !isWorkEmail(v)) return L.work;
      return '';
    case 'phone': return phoneError(v);
    case 'cpf': return validCPF(v) ? '' : L.cpf;
    case 'cnpj': return validCNPJ(v?.cnpj ?? v) ? '' : L.cnpj;
    case 'cep': return digits(v?.cep).length === 8 && v.city ? '' : L.cep;
    case 'number': {
      const n = Number(v);
      if (Number.isNaN(n)) return L.num;
      if (q.settings.min !== '' && q.settings.min != null && n < +q.settings.min) return `≥ ${q.settings.min}`;
      if (q.settings.max !== '' && q.settings.max != null && n > +q.settings.max) return `≤ ${q.settings.max}`;
      return '';
    }
    case 'website': return /^https?:\/\/\S+\.\S+/.test(v) || /^\S+\.\S{2,}$/.test(v) ? '' : L.url;
    case 'legal': return q.required && v !== 'yes' ? L.req : '';
    default: return '';
  }
}

function Media({ url }) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
  if (yt) return <iframe className="r-media" src={`https://www.youtube.com/embed/${yt[1]}`} title="Vídeo" allowFullScreen />;
  return <img className="r-media" src={url} alt="" />;
}

function Field({ q, value, onChange, onSubmit, L, theme }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (el && window.matchMedia('(pointer:fine)').matches) el.focus({ preventScroll: true });
  }, [q.id]);
  const key = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && q.type !== 'long_text') {
      e.preventDefault();
      onSubmit();
    }
  };
  const opts = useMemo(() => {
    const o = [...(q.options || [])];
    if (q.settings?.shuffle) o.sort(() => Math.random() - 0.5);
    return o;
  }, [q.id]);
  switch (q.type) {
    case 'long_text':
      return <textarea ref={ref} className="r-input" rows={3} maxLength={q.settings.max || undefined} placeholder={L.type} value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit()} />;
    case 'short_text':
    case 'email':
    case 'website':
    case 'number':
      return <input ref={ref} className="r-input" type={q.type === 'number' ? 'number' : q.type === 'email' ? 'email' : 'text'} inputMode={q.type === 'number' ? 'decimal' : undefined} maxLength={q.settings.max || undefined} placeholder={q.type === 'email' ? 'nome@exemplo.com' : q.type === 'website' ? 'https://' : L.type} value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={key} />;
    case 'phone':
      return <input ref={ref} className="r-input" type="tel" inputMode="tel" placeholder="(11) 91234-5678" value={value || ''} onChange={(e) => onChange(maskPhone(e.target.value))} onKeyDown={key} />;
    case 'cpf':
      return <input ref={ref} className="r-input" inputMode="numeric" placeholder="000.000.000-00" value={value || ''} onChange={(e) => onChange(maskCPF(e.target.value))} onKeyDown={key} />;
    case 'cnpj': {
      const v = value || {};
      const change = async (raw) => {
        const c = maskCNPJ(raw);
        onChange({ cnpj: c });
        setInfo('');
        if (digits(c).length === 14 && validCNPJ(c) && q.settings.lookup !== false) {
          setBusy(true);
          try {
            const d = await lookupCNPJ(c);
            onChange({ cnpj: c, company: d.name, tradeName: d.tradeName, city: d.city, state: d.state, status: d.status });
          } catch {
            setInfo('Não encontramos os dados dessa empresa, mas você pode continuar.');
          }
          setBusy(false);
        }
      };
      return (
        <div>
          <input ref={ref} className="r-input" inputMode="numeric" placeholder="00.000.000/0000-00" value={v.cnpj || ''} onChange={(e) => change(e.target.value)} onKeyDown={key} />
          {busy && <p className="r-hint">Buscando empresa…</p>}
          {v.company && (
            <div className="r-card">
              <b>{v.company}</b>
              {v.tradeName && <span>{v.tradeName}</span>}
              <span>
                {v.city}/{v.state} · {v.status}
              </span>
            </div>
          )}
          {info && <p className="r-hint">{info}</p>}
        </div>
      );
    }
    case 'cep': {
      const v = value || {};
      const change = async (raw) => {
        const c = maskCEP(raw);
        const next = { ...v, cep: c };
        onChange(next);
        if (digits(c).length === 8) {
          setBusy(true);
          try {
            const d = await lookupCEP(c);
            onChange({ ...next, ...d });
            setInfo('');
          } catch {
            setInfo(L.cep);
            onChange({ cep: c });
          }
          setBusy(false);
        }
      };
      const up = (k, x) => onChange({ ...v, [k]: x });
      return (
        <div className="r-addr">
          <input ref={ref} className="r-input" inputMode="numeric" placeholder="00000-000" value={v.cep || ''} onChange={(e) => change(e.target.value)} onKeyDown={key} />
          {busy && <p className="r-hint">Buscando endereço…</p>}
          {info && <p className="r-hint">{info}</p>}
          {v.city && (
            <>
              <input className="r-input" value={v.street || ''} placeholder="Rua" onChange={(e) => up('street', e.target.value)} />
              <div className="r-addr-row">
                <input className="r-input" value={v.number || ''} placeholder={L.number} onChange={(e) => up('number', e.target.value)} onKeyDown={key} />
                <input className="r-input" value={v.complement || ''} placeholder={L.compl} onChange={(e) => up('complement', e.target.value)} onKeyDown={key} />
              </div>
              <input className="r-input" value={v.district || ''} placeholder="Bairro" onChange={(e) => up('district', e.target.value)} />
              <p className="r-hint">
                {v.city}/{v.state}
              </p>
            </>
          )}
        </div>
      );
    }
    case 'date':
      return <input ref={ref} className="r-input" type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={key} />;
    case 'multiple_choice':
    case 'picture_choice': {
      const multi = q.settings?.multiple;
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      const pick = (label) => {
        if (multi) onChange(arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label]);
        else {
          onChange(label);
          setTimeout(() => onSubmit(label), 250);
        }
      };
      const list = [...opts.map((o) => o.label)];
      return (
        <div className={'r-choices' + (q.type === 'picture_choice' ? ' pics' : '')} role={multi ? 'group' : 'radiogroup'}>
          {multi && <p className="r-hint">{L.many}</p>}
          {opts.map((o, i) => (
            <button type="button" key={o.id} role={multi ? 'checkbox' : 'radio'} aria-checked={arr.includes(o.label)} className={'r-choice' + (arr.includes(o.label) ? ' on' : '')} onClick={() => pick(o.label)}>
              {q.type === 'picture_choice' && (o.image ? <img src={o.image} alt="" /> : <span className="pic-ph" />)}
              <kbd>{String.fromCharCode(65 + i)}</kbd>
              <span>{o.label}</span>
            </button>
          ))}
          {q.settings?.other && (
            <input
              className="r-input small"
              placeholder={L.other}
              value={arr.find((x) => !list.includes(x)) || ''}
              onChange={(e) => {
                const rest = arr.filter((x) => list.includes(x));
                onChange(multi ? [...rest, e.target.value].filter(Boolean) : e.target.value);
              }}
              onKeyDown={key}
            />
          )}
        </div>
      );
    }
    case 'dropdown':
      return (
        <select ref={ref} className="r-input" value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={key}>
          <option value="">{L.choose}</option>
          {opts.map((o) => (
            <option key={o.id}>{o.label}</option>
          ))}
        </select>
      );
    case 'ranking': {
      const arr = Array.isArray(value) && value.length ? value : opts.map((o) => o.label);
      const mv = (i, d) => {
        const a = [...arr];
        const j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        onChange(a);
      };
      return (
        <ol className="r-rank">
          {arr.map((l, i) => (
            <li key={l} className="r-choice">
              <kbd>{i + 1}</kbd>
              <span>{l}</span>
              <button type="button" aria-label="Subir" onClick={() => mv(i, -1)}>
                ↑
              </button>
              <button type="button" aria-label="Descer" onClick={() => mv(i, 1)}>
                ↓
              </button>
            </li>
          ))}
        </ol>
      );
    }
    case 'yes_no':
    case 'legal': {
      const a = q.type === 'legal' ? [['yes', L.accept], ['no', L.decline]] : [[L.yes, L.yes], [L.no, L.no]];
      return (
        <div className="r-choices" role="radiogroup">
          {a.map(([k, l], i) => (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={value === k}
              className={'r-choice' + (value === k ? ' on' : '')}
              onClick={() => {
                onChange(k);
                setTimeout(() => onSubmit(k), 250);
              }}
            >
              <kbd>{i ? 'N' : q.type === 'legal' ? 'A' : 'S'}</kbd>
              <span>{l}</span>
            </button>
          ))}
        </div>
      );
    }
    case 'rating': {
      const n = q.settings.steps || 5;
      return (
        <div className="r-stars" role="radiogroup">
          {Array.from({ length: n }, (_, i) => (
            <button type="button" key={i} role="radio" aria-checked={value === i + 1} aria-label={`${i + 1}`} className={value >= i + 1 ? 'on' : ''} style={{ color: value >= i + 1 ? theme.answer : undefined }} onClick={() => onChange(i + 1)}>
              ★
            </button>
          ))}
        </div>
      );
    }
    case 'opinion_scale':
    case 'nps': {
      const from = q.type === 'nps' ? 0 : q.settings.from ?? 1;
      const to = q.type === 'nps' ? 10 : q.settings.to ?? 5;
      const left = q.type === 'nps' ? 'Nada provável' : q.settings.left;
      const right = q.type === 'nps' ? 'Muito provável' : q.settings.right;
      const nums = [];
      for (let i = from; i <= to; i++) nums.push(i);
      return (
        <div>
          <div className="r-scale" role="radiogroup">
            {nums.map((i) => (
              <button
                type="button"
                key={i}
                role="radio"
                aria-checked={value === i}
                className={value === i ? 'on' : ''}
                onClick={() => {
                  onChange(i);
                  setTimeout(() => onSubmit(i), 250);
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="r-scale-l">
            <span>{left}</span>
            <span>{right}</span>
          </div>
        </div>
      );
    }
    case 'file_upload':
      return (
        <label className="r-upload">
          {value?.name ? `📎 ${value.name}` : L.upload}
          <input
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2e6) {
                onChange({ name: file.name, size: file.size });
                return;
              }
              const r = new FileReader();
              r.onload = () => onChange({ name: file.name, size: file.size, data: r.result });
              r.readAsDataURL(file);
            }}
          />
        </label>
      );
    case 'calendly':
      return q.settings.url ? <iframe className="r-cal" src={q.settings.url} title="Agendamento" /> : <p className="r-hint">Informe o link do Calendly no editor.</p>;
    default:
      return null;
  }
}

function loadTracking(tr) {
  if (window.__fmTrack) return;
  window.__fmTrack = true;
  const add = (src, inline) => {
    const s = document.createElement('script');
    if (src) {
      s.async = true;
      s.src = src;
    } else s.text = inline;
    document.head.appendChild(s);
  };
  window.dataLayer = window.dataLayer || [];
  if (tr.ga4) {
    add(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tr.ga4)}`);
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', tr.ga4);
  }
  if (tr.gtm) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    add(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(tr.gtm)}`);
  }
  if (tr.metaPixel) {
    add(null, `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(tr.metaPixel)});fbq('track','PageView');`);
  }
  if (tr.tiktok) {
    add(null, `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var s=d.createElement("script");s.async=!0;s.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid="+e+"&lib="+t;d.head.appendChild(s)};ttq.load(${JSON.stringify(tr.tiktok)});ttq.page()}(window,document,"ttq");`);
  }
}
function fireConversion(tr, formId) {
  try {
    window.gtag && tr.ga4 && window.gtag('event', 'generate_lead', { form_id: formId });
    window.fbq && tr.metaPixel && window.fbq('track', 'Lead');
    window.ttq && tr.tiktok && window.ttq.track('SubmitForm');
    window.dataLayer && window.dataLayer.push({ event: 'formaria_conversion', form_id: formId, openai_pixel: tr.openai || undefined });
  } catch {}
}

function sendIntegrations(f, resp) {
  const payload = {
    event: resp.completed ? 'form_response' : 'partial_response',
    form_id: f.id,
    form_title: f.title,
    response_id: resp.id,
    submitted_at: new Date().toISOString(),
    hidden: resp.hidden,
    score: resp.score,
    answers: f.questions.filter((q) => resp.answers[q.id] !== undefined).map((q) => ({ question: q.title, ref: q.ref || q.id, type: q.type, value: answerText(q, resp.answers[q.id]) })),
  };
  const body = JSON.stringify(payload);
  const ig = f.integrations;
  const urls = [
    ...ig.webhooks.filter((w) => w.on).map((w) => w.url),
    ig.kommo.enabled && ig.kommo.url,
    ig.activecampaign.enabled && ig.activecampaign.url,
    ig.sheets.enabled && ig.sheets.url,
  ].filter(Boolean);
  urls.forEach((u) => fetch(u, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body }).catch(() => {}));
  if (ig.slack.enabled && ig.slack.url) {
    fetch(ig.slack.url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ text: `Nova resposta em ${f.title}:\n` + payload.answers.map((a) => `• ${a.question}: ${a.value}`).join('\n') }) }).catch(() => {});
  }
  if (ig.rdstation.enabled && ig.rdstation.token) {
    const email = f.questions.find((q) => q.type === 'email');
    const name = f.questions.find((q) => q.type === 'short_text');
    const phone = f.questions.find((q) => q.type === 'phone');
    fetch(`https://api.rd.services/platform/conversions?api_key=${encodeURIComponent(ig.rdstation.token)}`, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'CONVERSION',
        event_family: 'CDP',
        payload: { conversion_identifier: f.title, email: email && resp.answers[email.id], name: name && resp.answers[name.id], mobile_phone: phone && resp.answers[phone.id] },
      }),
    }).catch(() => {});
  }
}

export function FormRunner({ f, preview, focus }) {
  const L = UI[f.settings.language] || UI.pt;
  const qs = f.questions;
  const startIdx = focus === 'ending' ? 'end' : focus === 'welcome' || !focus ? (f.welcome.enabled ? 'welcome' : qs[0]?.id || 'end') : focus;
  const [pos, setPos] = useState(startIdx);
  const [history, setHistory] = useState([]);
  const urlParams = useMemo(() => new URLSearchParams(location.search), [f.id]);
  const prefilled = useMemo(() => {
    const a = {};
    if (preview) return a;
    qs.forEach((x) => x.ref && urlParams.has(x.ref) && urlParams.get(x.ref) !== '' && (a[x.id] = urlParams.get(x.ref)));
    return a;
  }, [f.id]);
  const journey = useRef(urlParams.get('_j') || uid('j_'));
  const [answers, setAnswers] = useState(prefilled);
  const [err, setErr] = useState('');
  const [dir, setDir] = useState(1);
  const respId = useRef(null);
  const started = useRef(Date.now());
  const hidden = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const h = {};
    f.settings.hiddenFields.forEach((k) => p.has(k) && (h[k] = p.get(k)));
    return h;
  }, [f.id]);
  const theme = f.theme;
  const score = computeScore(f, answers);

  const persist = (ans, completed) => {
    if (preview) return null;
    if (!completed && !f.settings.partialResponses) return null;
    let r;
    save((d) => {
      if (!respId.current) {
        respId.current = uid('r_');
        d.responses.push({ id: respId.current, formId: f.id, journeyId: journey.current, fromForm: urlParams.get('_from') || null, answers: {}, hidden, startedAt: started.current, completed: false, ua: navigator.userAgent.slice(0, 120) });
      }
      r = d.responses.find((x) => x.id === respId.current);
      r.answers = { ...ans };
      r.score = computeScore(f, ans);
      r.updatedAt = Date.now();
      if (completed) {
        r.completed = true;
        r.submittedAt = Date.now();
      }
    });
    return r;
  };

  useEffect(() => {
    if (prefilled[pos] !== undefined) goTo(pos);
  }, []);
  const idx = qs.findIndex((q) => q.id === pos);
  const q = qs[idx];
  const goTo = (to0, ansNow = answers) => {
    let to = to0;
    // questions already answered by a previous form of the journey are skipped
    while (to !== 'end' && to !== 'welcome' && (prefilled[to] !== undefined || !isVisible(qs.find((x) => x.id === to) || {}, ansNow))) {
      const i = qs.findIndex((x) => x.id === to);
      to = qs[i + 1]?.id || 'end';
    }
    if (to === 'end' && to0 !== 'end' && pos !== 'end') return finish(ansNow);
    setErr('');
    setDir(1);
    setHistory((h) => [...h, pos]);
    setPos(to);
  };
  const finish = (ans) => {
    const r = persist(ans, true);
    if (!preview) {
      if (f.tracking.fireOn === 'submit' || f.tracking.fireOn === 'logic') fireConversion(f.tracking, f.id);
      if (r) sendIntegrations(f, r);
      if (f.settings.preventDuplicates) localStorage.setItem('formaria.done.' + f.id, '1');
      const nxt = nextInJourney(f, ans, journey.current, hidden);
      if (nxt) {
        setTimeout(() => (window.location.href = nxt), 1200);
      } else if (f.settings.redirectUrl) {
        const url = fill(f.settings.redirectUrl, ans, f, hidden, computeScore(f, ans));
        setTimeout(() => (window.location.href = /^https?:/.test(url) ? url : 'https://' + url), 900);
      }
    }
    setErr('');
    setDir(1);
    setHistory((h) => [...h, pos]);
    setPos('end');
  };
  const next = (override) => {
    if (!q) return;
    const v = override !== undefined ? override : answers[q.id];
    const ans = override !== undefined ? { ...answers, [q.id]: override } : answers;
    if (q.type !== 'statement') {
      const e = validate(q, v, f, L);
      if (e) return setErr(e);
    }
    if (!preview && Object.keys(answers).length === 0 && !respId.current && f.tracking.fireOn === 'start') fireConversion(f.tracking, f.id);
    persist(ans, false);
    let to = null;
    for (const rule of q.logic || []) {
      if (ruleMatches(rule, v, ans)) {
        to = rule.to;
        break;
      }
    }
    if (!to) to = qs[idx + 1]?.id || 'end';
    if (to === 'end') return finish(ans);
    goTo(to, ans);
  };
  const back = () => {
    if (!history.length) return;
    setDir(-1);
    setErr('');
    setPos(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const answered = qs.filter((x) => answers[x.id] !== undefined && answers[x.id] !== '').length;
  const progress = pos === 'end' ? 100 : qs.length ? Math.round((answered / qs.length) * 100) : 0;
  const style = {
    '--r-bg': theme.bg,
    '--r-q': theme.question,
    '--r-a': theme.answer,
    '--r-btn': theme.button,
    '--r-btnt': theme.buttonText,
    fontFamily: theme.font,
    textAlign: theme.align,
    backgroundImage: theme.bgImage ? `url(${theme.bgImage})` : undefined,
  };
  const minutes = Math.max(1, Math.round(qs.length * 0.25));
  return (
    <div className={'runner' + (preview ? ' preview' : '') + (theme.align === 'center' ? ' center' : '')} style={style}>
      {f.settings.progressBar && pos !== 'welcome' && (
        <div className="r-progress" aria-hidden="true">
          <i style={{ width: progress + '%' }} />
        </div>
      )}
      {theme.logo && <img className="r-logo" src={theme.logo} alt="" />}
      <div className={'r-stage ' + (dir > 0 ? 'fwd' : 'bwd')} key={pos}>
        {pos === 'welcome' && (
          <div className="r-q">
            <h1 className="r-title big">{fill(f.welcome.title, answers, f, hidden, score) || f.title}</h1>
            {f.welcome.description && <p className="r-desc">{fill(f.welcome.description, answers, f, hidden, score)}</p>}
            <div className="r-actions">
              <button type="button" className="r-btn" onClick={() => (qs.length ? goTo(qs[0].id) : finish(answers))}>
                {f.welcome.button || L.next}
              </button>
              {f.settings.showTimeToComplete && <span className="r-enter">⏱ {L.takes} {minutes} {L.min}</span>}
            </div>
          </div>
        )}
        {q && (
          <form
            className="r-q"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            <h2 className="r-title">
              {f.settings.questionNumbers && q.type !== 'statement' && <span className="r-num">{idx + 1}→</span>}
              {fill(q.title, answers, f, hidden, score) || <em>{typeInfo(q.type).label}</em>}
              {q.required && ' *'}
            </h2>
            {q.description && <p className="r-desc">{fill(q.description, answers, f, hidden, score)}</p>}
            <Media url={q.settings?.media} />
            <Field q={q} value={answers[q.id]} L={L} theme={theme} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} onSubmit={(v) => next(v)} />
            {err && (
              <p className="r-err" role="alert">
                ⚠ {err}
              </p>
            )}
            <div className="r-actions">
              <button type="submit" className="r-btn">
                {qs[idx + 1] || (q.logic || []).length ? (q.type === 'statement' ? L.next : L.ok) : L.submit} ✓
              </button>
              <span className="r-enter">{L.enter}</span>
            </div>
          </form>
        )}
        {pos === 'end' && (
          <div className="r-q">
            <h1 className="r-title big">{fill(f.ending.title, answers, f, hidden, score)}</h1>
            {f.ending.description && <p className="r-desc">{fill(f.ending.description, answers, f, hidden, score)}</p>}
            {f.ending.button && (
              <a className="r-btn" href={f.ending.buttonUrl || '#'} target="_blank" rel="noreferrer">
                {f.ending.button}
              </a>
            )}
            {f.settings.respondentEmailCopy && (
              <div className="r-summary">
                <b>{L.summary}</b>
                {qs
                  .filter((x) => answers[x.id] !== undefined)
                  .map((x) => (
                    <p key={x.id}>
                      <span>{fill(x.title, answers, f, hidden, score)}</span> {answerText(x, answers[x.id])}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="r-nav">
        <button type="button" aria-label={L.back} disabled={!history.length} onClick={back}>
          ⌃
        </button>
        <button type="button" aria-label={L.next} disabled={!q} onClick={() => next()}>
          ⌄
        </button>
      </div>
      {!f.settings.removeBranding && (
        <a className="r-brand" href="/signup">
          <Mark size={12} /> {L.made}
        </a>
      )}
    </div>
  );
}

export function Fill() {
  const p = new URLSearchParams(location.search);
  const f = getForm(p.get('id'));
  const preview = p.get('preview') === '1';
  useEffect(() => {
    if (!f) return;
    document.title = f.title;
    document.documentElement.lang = f.settings.language === 'en' ? 'en' : f.settings.language === 'es' ? 'es' : 'pt-BR';
    if (!preview) {
      bumpStat(f.id, 'views');
      loadTracking(f.tracking);
    }
  }, [f?.id]);
  if (!f)
    return (
      <div className="runner closed">
        <div className="r-q">
          <h1 className="r-title">Formulário não encontrado</h1>
          <p className="r-desc">Os formulários e as respostas ficam guardados no navegador onde foram criados. Abra este link no mesmo navegador.</p>
        </div>
      </div>
    );
  const L = UI[f.settings.language] || UI.pt;
  const s = f.settings;
  const done = formResponses(f.id).filter((r) => r.completed).length;
  const isClosed = !preview && (s.closed || (s.closeAt && new Date(s.closeAt) < new Date()) || (s.responseLimit && done >= +s.responseLimit) || (!f.published && false));
  if (isClosed)
    return (
      <div className="runner closed" style={{ '--r-bg': f.theme.bg, '--r-q': f.theme.question }}>
        <div className="r-q">
          <h1 className="r-title">{L.closed}</h1>
          <p className="r-desc">{s.closedMessage}</p>
        </div>
      </div>
    );
  if (!preview && s.preventDuplicates && localStorage.getItem('formaria.done.' + f.id))
    return (
      <div className="runner closed" style={{ '--r-bg': f.theme.bg, '--r-q': f.theme.question }}>
        <div className="r-q">
          <h1 className="r-title">{L.dup}</h1>
        </div>
      </div>
    );
  return (
    <div className="fill-page">
      {preview && <div className="preview-bar">Pré-visualização — as respostas não são salvas</div>}
      <FormRunner f={f} preview={preview} />
    </div>
  );
}
