// Local data store: everything lives in this browser's localStorage.
const KEY = 'formaria.v1';

export const uid = (p = '') =>
  p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

function blank() {
  const ws = { id: '2TWMSF', name: 'Meu espaço de trabalho' };
  return {
    session: null,
    account: {
      id: '01M71R2K5KHS11H3M65ZEYW6ME',
      plan: 'Tudo liberado',
      members: [],
      customDomain: '',
      brandLogo: '',
      googleClientId: '',
    },
    workspaces: [ws],
    forms: [],
    responses: [],
    stats: {},
    users: [],
  };
}

let cache = null;
export function db() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || blank();
  } catch {
    cache = blank();
  }
  return cache;
}
const listeners = new Set();
export function save(mut) {
  const d = db();
  if (mut) mut(d);
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch (e) {
    alert('Não foi possível salvar: o armazenamento do navegador está cheio.');
  }
  listeners.forEach((l) => l());
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getForm = (id) => db().forms.find((f) => f.id === id);
export const formResponses = (id) => db().responses.filter((r) => r.formId === id);

export function bumpStat(formId, key) {
  save((d) => {
    d.stats[formId] = d.stats[formId] || { views: 0, starts: 0 };
    d.stats[formId][key] = (d.stats[formId][key] || 0) + 1;
  });
}

export const QUESTION_TYPES = [
  { type: 'short_text', label: 'Texto curto', icon: '≡', group: 'Texto' },
  { type: 'long_text', label: 'Texto longo', icon: '¶', group: 'Texto' },
  { type: 'email', label: 'E-mail', icon: '@', group: 'Contato' },
  { type: 'phone', label: 'Telefone com DDD', icon: '☎', group: 'Contato' },
  { type: 'website', label: 'Site', icon: '🔗', group: 'Contato' },
  { type: 'multiple_choice', label: 'Múltipla escolha', icon: '☑', group: 'Escolha' },
  { type: 'dropdown', label: 'Lista suspensa', icon: '▾', group: 'Escolha' },
  { type: 'picture_choice', label: 'Escolha com imagem', icon: '🖼', group: 'Escolha' },
  { type: 'yes_no', label: 'Sim / Não', icon: '◐', group: 'Escolha' },
  { type: 'legal', label: 'Termo de aceite', icon: '⚖', group: 'Escolha' },
  { type: 'ranking', label: 'Ordenação', icon: '⇅', group: 'Escolha' },
  { type: 'rating', label: 'Avaliação (estrelas)', icon: '★', group: 'Avaliação' },
  { type: 'opinion_scale', label: 'Escala de opinião', icon: '⋯', group: 'Avaliação' },
  { type: 'nps', label: 'Net Promoter Score®', icon: '⓪', group: 'Avaliação' },
  { type: 'number', label: 'Número', icon: '#', group: 'Outros' },
  { type: 'date', label: 'Data', icon: '📅', group: 'Outros' },
  { type: 'file_upload', label: 'Envio de arquivo', icon: '⬆', group: 'Outros' },
  { type: 'calendly', label: 'Agendamento (Calendly)', icon: '🗓', group: 'Outros' },
  { type: 'statement', label: 'Texto informativo', icon: '❝', group: 'Outros' },
  { type: 'cpf', label: 'CPF (com validação)', icon: 'BR', group: 'Brasil' },
  { type: 'cnpj', label: 'CNPJ (com dados da empresa)', icon: 'BR', group: 'Brasil' },
  { type: 'cep', label: 'Endereço por CEP', icon: 'BR', group: 'Brasil' },
];
export const typeInfo = (t) => QUESTION_TYPES.find((q) => q.type === t) || QUESTION_TYPES[0];
export const CHOICE_TYPES = ['multiple_choice', 'dropdown', 'picture_choice', 'ranking'];

export function newQuestion(type) {
  const q = {
    id: uid('q_'),
    ref: '',
    type,
    title: '',
    description: '',
    required: false,
    options: [],
    settings: {},
    logic: [],
  };
  if (CHOICE_TYPES.includes(type)) {
    q.options = [
      { id: uid('o_'), label: 'Opção 1', score: 0, image: '' },
      { id: uid('o_'), label: 'Opção 2', score: 0, image: '' },
    ];
  }
  if (type === 'rating') q.settings = { steps: 5 };
  if (type === 'opinion_scale') q.settings = { from: 1, to: 5, left: '', right: '' };
  if (type === 'multiple_choice') q.settings = { multiple: false, other: false };
  if (type === 'calendly') q.settings = { url: '' };
  return q;
}

export function defaultTheme() {
  return {
    name: 'Clássico',
    bg: '#ffffff',
    question: '#3c323e',
    answer: '#4e3f8a',
    button: '#3c323e',
    buttonText: '#ffffff',
    font: 'system-ui',
    logo: '',
    bgImage: '',
    align: 'left',
  };
}

export function newForm(workspaceId, title = 'Meu formulário', questions = []) {
  return {
    id: uid('').slice(0, 8),
    title,
    workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    published: false,
    questions,
    welcome: { enabled: true, title: title, description: '', button: 'Começar' },
    ending: { title: 'Obrigado por responder!', description: '', button: '', buttonUrl: '' },
    theme: defaultTheme(),
    settings: {
      progressBar: true,
      questionNumbers: true,
      removeBranding: true,
      redirectUrl: '',
      requireWorkEmail: false,
      preventDuplicates: false,
      closed: false,
      closeAt: '',
      responseLimit: '',
      closedMessage: 'Este formulário não está mais recebendo respostas.',
      partialResponses: true,
      hiddenFields: [],
      language: 'pt',
      showTimeToComplete: true,
      notifyEmail: '',
      respondentEmailCopy: false,
    },
    tracking: { ga4: '', metaPixel: '', gtm: '', tiktok: '', openai: '', fireOn: 'submit' },
    integrations: {
      webhooks: [],
      rdstation: { enabled: false, token: '' },
      kommo: { enabled: false, url: '' },
      activecampaign: { enabled: false, url: '', key: '' },
      sheets: { enabled: false, url: '' },
      slack: { enabled: false, url: '' },
      whatsapp: { enabled: true, message: 'Olá {{nome}}, recebemos sua resposta!' },
    },
  };
}

export function ensureSession() {
  return db().session;
}
