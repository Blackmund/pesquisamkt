// Brazilian data helpers: CPF, CNPJ, CEP, phone with area code (DDD).
export const digits = (s) => String(s || '').replace(/\D/g, '');

export function validCPF(v) {
  const c = digits(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== +c[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === +c[10];
}

export function validCNPJ(v) {
  const c = digits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < len; i++) s += +c[i] * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +c[12] && calc(13) === +c[13];
}

export const maskCPF = (v) =>
  digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
export const maskCNPJ = (v) =>
  digits(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
export const maskCEP = (v) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
export function maskPhone(v) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const DDDS = new Set(
  '11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' ')
);
export function phoneError(v) {
  const d = digits(v);
  if (d.length < 10) return 'Informe o telefone com DDD.';
  if (!DDDS.has(d.slice(0, 2))) return `O DDD ${d.slice(0, 2)} não existe.`;
  if (d.length === 11 && d[2] !== '9') return 'Celulares com 11 dígitos começam com 9 depois do DDD.';
  if (/^(\d)\1+$/.test(d.slice(2))) return 'Esse número parece incorreto.';
  return '';
}
export const whatsappLink = (phone, text = '') =>
  `https://wa.me/55${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const FREE_MAIL = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br', 'icloud.com', 'live.com', 'bol.com.br', 'uol.com.br', 'terra.com.br', 'msn.com', 'aol.com', 'protonmail.com', 'ig.com.br', 'gmx.com'];
export const isWorkEmail = (e) => !FREE_MAIL.includes(String(e).split('@')[1]?.toLowerCase());
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());

export async function lookupCEP(cep) {
  const r = await fetch(`https://viacep.com.br/ws/${digits(cep)}/json/`);
  const j = await r.json();
  if (j.erro) throw new Error('CEP não encontrado');
  return { street: j.logradouro, district: j.bairro, city: j.localidade, state: j.uf };
}
export async function lookupCNPJ(cnpj) {
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits(cnpj)}`);
  if (!r.ok) throw new Error('CNPJ não encontrado');
  const j = await r.json();
  return {
    name: j.razao_social,
    tradeName: j.nome_fantasia,
    city: j.municipio,
    state: j.uf,
    status: j.descricao_situacao_cadastral,
  };
}
