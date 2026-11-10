import React, { useState } from 'react';
import { db, save, formResponses, typeInfo, CHOICE_TYPES } from './store.js';
import { answerText } from './fill.jsx';
import { whatsappLink } from './br.js';

const fmtDate = (t) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

function fillMsg(tpl, f, r) {
  return String(tpl || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    const q = f.questions.find((x) => x.ref === k || x.id === k);
    return q ? answerText(q, r.answers[q.id]) : r.hidden?.[k] || '';
  });
}

function exportCSV(f, rows) {
  const head = ['id', 'status', 'início', 'envio', 'pontos', ...f.questions.map((q) => q.title || typeInfo(q.type).label), ...f.settings.hiddenFields];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(';')];
  rows.forEach((r) =>
    lines.push(
      [r.id, r.completed ? 'concluída' : 'parcial', fmtDate(r.startedAt), fmtDate(r.submittedAt), r.score ?? 0, ...f.questions.map((q) => answerText(q, r.answers[q.id])), ...f.settings.hiddenFields.map((h) => r.hidden?.[h] || '')]
        .map(esc)
        .join(';')
    )
  );
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${f.title.replace(/[^\w-]+/g, '_')}-respostas.csv`;
  a.click();
}

function Summary({ f, rows }) {
  return (
    <div>
      {f.questions
        .filter((q) => q.type !== 'statement')
        .map((q, i) => {
          const vals = rows.map((r) => r.answers[q.id]).filter((v) => v !== undefined && v !== '');
          let body;
          if (CHOICE_TYPES.includes(q.type) || ['yes_no', 'legal'].includes(q.type)) {
            const counts = {};
            vals.forEach((v) => (Array.isArray(v) ? v : [v]).forEach((x) => (counts[x] = (counts[x] || 0) + 1)));
            const labels = q.type === 'yes_no' || q.type === 'legal' ? Object.keys(counts) : [...new Set([...q.options.map((o) => o.label), ...Object.keys(counts)])];
            body = labels.map((l) => {
              const c = counts[l] || 0;
              const pct = vals.length ? Math.round((c / vals.length) * 100) : 0;
              return (
                <div className="bar" key={l}>
                  <span className="bar-l">{l === 'yes' ? 'Aceito' : l === 'no' ? 'Não aceito' : l}</span>
                  <span className="bar-t">
                    <i style={{ width: pct + '%' }} />
                  </span>
                  <span className="bar-n">
                    {pct}% · {c}
                  </span>
                </div>
              );
            });
          } else if (['rating', 'opinion_scale', 'nps', 'number'].includes(q.type)) {
            const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
            const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—';
            let extra = null;
            if (q.type === 'nps' && nums.length) {
              const pro = nums.filter((n) => n >= 9).length;
              const det = nums.filter((n) => n <= 6).length;
              const nps = Math.round(((pro - det) / nums.length) * 100);
              extra = (
                <p>
                  <b className="big-num">{nps}</b> NPS · {pro} promotores · {nums.length - pro - det} neutros · {det} detratores
                </p>
              );
            }
            body = (
              <>
                <p>
                  Média: <b className="big-num">{avg}</b>
                </p>
                {extra}
              </>
            );
          } else {
            body = (
              <ul className="ans-list">
                {vals.slice(-6).reverse().map((v, k) => (
                  <li key={k}>{answerText(q, v)}</li>
                ))}
                {vals.length > 6 && <li className="muted">… e mais {vals.length - 6}</li>}
              </ul>
            );
          }
          return (
            <div className="panel" key={q.id}>
              <h3>
                {i + 1}. {q.title || typeInfo(q.type).label}
              </h3>
              <p className="muted small">
                {vals.length} de {rows.length} responderam
              </p>
              {body}
            </div>
          );
        })}
    </div>
  );
}

export function Results({ f }) {
  const all = formResponses(f.id);
  const stats = db().stats[f.id] || { views: 0 };
  const [tab, setTab] = useState('summary');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const done = all.filter((r) => r.completed);
  const partial = all.filter((r) => !r.completed);
  let rows = filter === 'done' ? done : filter === 'partial' ? partial : all;
  if (q) rows = rows.filter((r) => JSON.stringify(r.answers).toLowerCase().includes(q.toLowerCase()));
  rows = [...rows].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const times = done.filter((r) => r.submittedAt && r.startedAt).map((r) => (r.submittedAt - r.startedAt) / 1000);
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const phoneQ = f.questions.find((x) => x.type === 'phone');
  const del = (id) => confirm('Excluir esta resposta?') && save((d) => (d.responses = d.responses.filter((r) => r.id !== id)));
  const notify = (r) => {
    const to = f.settings.notifyEmail;
    const body = f.questions.map((x) => `${x.title}: ${answerText(x, r.answers[x.id])}`).join('\n');
    location.href = `mailto:${to}?subject=${encodeURIComponent('Nova resposta: ' + f.title)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <div className="b-page wide">
      <div className="stats">
        <div>
          <b>{stats.views || 0}</b>
          <span>Visitas</span>
        </div>
        <div>
          <b>{all.length}</b>
          <span>Começaram</span>
        </div>
        <div>
          <b>{done.length}</b>
          <span>Concluídas</span>
        </div>
        <div>
          <b>{partial.length}</b>
          <span>Recuperadas (parciais)</span>
        </div>
        <div>
          <b>{all.length ? Math.round((done.length / all.length) * 100) : 0}%</b>
          <span>Taxa de conclusão</span>
        </div>
        <div>
          <b>{avgTime ? `${Math.floor(avgTime / 60)}:${String(avgTime % 60).padStart(2, '0')}` : '—'}</b>
          <span>Tempo médio</span>
        </div>
      </div>
      <div className="res-tools">
        <div className="seg">
          <button type="button" className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}>
            Resumo
          </button>
          <button type="button" className={tab === 'responses' ? 'on' : ''} onClick={() => setTab('responses')}>
            Respostas
          </button>
          <button type="button" className={tab === 'drop' ? 'on' : ''} onClick={() => setTab('drop')}>
            Abandono por pergunta
          </button>
        </div>
        <div className="row">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar">
            <option value="all">Todas ({all.length})</option>
            <option value="done">Concluídas ({done.length})</option>
            <option value="partial">Parciais ({partial.length})</option>
          </select>
          <input type="search" placeholder="Buscar nas respostas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <button type="button" className="btn-dark" disabled={!rows.length} onClick={() => exportCSV(f, rows)}>
            Baixar planilha (CSV)
          </button>
        </div>
      </div>
      {all.length === 0 && (
        <div className="empty">
          <h2>Ainda não há respostas</h2>
          <p>Compartilhe o link do formulário. Cada resposta aparece aqui — inclusive as de quem parou no meio.</p>
        </div>
      )}
      {all.length > 0 && tab === 'summary' && <Summary f={f} rows={rows} />}
      {all.length > 0 && tab === 'drop' && (
        <div className="panel">
          <h3>Onde as pessoas param</h3>
          {f.questions.map((x, i) => {
            const n = all.filter((r) => r.answers[x.id] !== undefined).length;
            const pct = all.length ? Math.round((n / all.length) * 100) : 0;
            return (
              <div className="bar" key={x.id}>
                <span className="bar-l">
                  {i + 1}. {x.title || typeInfo(x.type).label}
                </span>
                <span className="bar-t">
                  <i style={{ width: pct + '%' }} />
                </span>
                <span className="bar-n">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
      {all.length > 0 && tab === 'responses' && (
        <div className="table-wrap">
          <table className="rtable">
            <thead>
              <tr>
                <th>Data</th>
                <th>Status</th>
                {f.questions.slice(0, 6).map((x) => (
                  <th key={x.id}>{x.title || typeInfo(x.type).label}</th>
                ))}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.submittedAt || r.updatedAt)}</td>
                  <td>
                    <span className={'pill ' + (r.completed ? 'ok' : 'partial')}>{r.completed ? 'Concluída' : 'Parcial'}</span>
                  </td>
                  {f.questions.slice(0, 6).map((x) => (
                    <td key={x.id}>{answerText(x, r.answers[x.id])}</td>
                  ))}
                  <td className="nowrap">
                    <button type="button" className="link" onClick={() => setOpen(r)}>
                      ver
                    </button>
                    {phoneQ && r.answers[phoneQ.id] && f.integrations.whatsapp.enabled && (
                      <a className="wa" href={whatsappLink(r.answers[phoneQ.id], fillMsg(f.integrations.whatsapp.message, f, r))} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    )}
                    {f.settings.notifyEmail && (
                      <button type="button" className="link" onClick={() => notify(r)}>
                        avisar
                      </button>
                    )}
                    <button type="button" className="link danger" onClick={() => del(r.id)}>
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="m-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="m-box" role="dialog" aria-modal="true" aria-label="Resposta">
            <div className="m-head">
              <h2>Resposta {open.completed ? 'concluída' : 'parcial'}</h2>
              <button type="button" className="icon-btn" aria-label="Fechar" onClick={() => setOpen(null)}>
                ✕
              </button>
            </div>
            <div className="m-body">
              {f.questions.map((x) => (
                <div className="ans" key={x.id}>
                  <span>{x.title || typeInfo(x.type).label}</span>
                  {x.type === 'file_upload' && open.answers[x.id]?.data ? (
                    <a href={open.answers[x.id].data} download={open.answers[x.id].name}>
                      {open.answers[x.id].name}
                    </a>
                  ) : (
                    <b>{answerText(x, open.answers[x.id]) || '—'}</b>
                  )}
                </div>
              ))}
              {Object.entries(open.hidden || {}).map(([k, v]) => (
                <div className="ans" key={k}>
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
              <div className="ans">
                <span>Pontos</span>
                <b>{open.score ?? 0}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
