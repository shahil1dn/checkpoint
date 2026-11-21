// Screen code only. Limits and reply checks live in /src/rules.js.
import { checkQuestion } from '/src/rules.js';
import { getTraveller } from '/src/travellers.js';

const $ = (id) => document.getElementById(id);
const traveller = getTraveller('max');
const history = [];
let waiting = false;

const HINTS = {
  empty: 'Ask something first.',
  tooLong: 'Keep it under 300 characters.',
  noKey: 'No Mistral key on the server.',
  unclear: 'He mumbles something unclear.',
};

function renderPapers() {
  $('traveller-name').textContent = traveller.name;
  $('papers').replaceChildren(...Object.entries(traveller.papers).flatMap(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }));
}

function addLine(speaker, text) {
  const li = document.createElement('li');
  li.textContent = `${speaker}: ${text}`;
  $('conversation').append(li);
}

async function askServer(question) {
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ travellerId: traveller.id, question, history }),
    });
    const body = await res.json();
    if (res.status === 503) return { error: 'noKey' };
    if (!res.ok) return { error: 'unclear' };
    return { reply: body };
  } catch {
    return { error: 'unclear' };
  }
}

async function onAsk(event) {
  event.preventDefault();
  if (waiting) return;
  const checked = checkQuestion($('question').value);
  if (!checked.ok) {
    $('hint').textContent = HINTS[checked.reason];
    return;
  }
  waiting = true;
  $('ask').disabled = true;
  $('hint').textContent = `${traveller.name} is thinking…`;
  addLine('You', checked.question);
  $('question').value = '';

  const { reply, error } = await askServer(checked.question);
  if (reply) {
    history.push({ question: checked.question, reply: reply.reply, mood: reply.mood });
    addLine(traveller.name, `${reply.reply} [${reply.mood}]`);
    $('hint').textContent = '';
  } else {
    $('hint').textContent = HINTS[error];
  }
  waiting = false;
  $('ask').disabled = false;
}

async function showStatus() {
  try {
    const { live } = await (await fetch('/api/health')).json();
    $('status').textContent = live ? 'Live: Mistral connected.' : 'Offline: no Mistral key on the server.';
  } catch {
    $('status').textContent = 'Server not reachable.';
  }
}

renderPapers();
$('ask-form').addEventListener('submit', onAsk);
showStatus();
