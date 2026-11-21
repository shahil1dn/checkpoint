// Screen code only. Limits and reply checks live in /src/rules.js.
import { checkQuestion } from '/src/rules.js';
import { getTraveller } from '/src/travellers.js';
import { endClip, micReady, prepareMic, recording, startClip } from '/mic.js';

const $ = (id) => document.getElementById(id);
const traveller = getTraveller('max');
const history = [];
let waiting = false;

const HINTS = {
  empty: 'Ask something first.',
  tooLong: 'Keep it under 300 characters.',
  noKey: 'No Mistral key on the server.',
  unclear: 'He mumbles something unclear.',
  tap: 'Hold Space while you talk, then let go.',
  notHeard: "Didn't catch that. Try again.",
  noMic: 'No microphone. Type your question instead.',
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

const hint = (text) => { $('hint').textContent = text; };

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { res, body: await res.json() };
}

async function askServer(question) {
  try {
    const { res, body } = await postJson('/api/ask', { travellerId: traveller.id, question, history });
    if (res.status === 503) return { error: 'noKey' };
    return res.ok ? { reply: body } : { error: 'unclear' };
  } catch {
    return { error: 'unclear' };
  }
}

async function hearServer(clip) {
  try {
    const res = await fetch('/api/hear', { method: 'POST', headers: { 'content-type': clip.type }, body: clip });
    const body = await res.json();
    if (res.status === 503) return { error: 'noKey' };
    return res.ok && body.text ? { text: body.text } : { error: 'notHeard' };
  } catch {
    return { error: 'notHeard' };
  }
}

function setWaiting(on, message = '') {
  waiting = on;
  $('ask').disabled = on;
  $('talk').disabled = on;
  hint(message);
}

// Typed and spoken questions both end up here.
async function askQuestion(text) {
  const checked = checkQuestion(text);
  if (!checked.ok) return hint(HINTS[checked.reason]);
  setWaiting(true, `${traveller.name} is thinking…`);
  addLine('You', checked.question);
  const { reply, error } = await askServer(checked.question);
  if (reply) {
    history.push({ question: checked.question, reply: reply.reply, mood: reply.mood });
    addLine(traveller.name, `${reply.reply} [${reply.mood}]`);
    if (reply.audio) playVoice(reply.audio);
  }
  setWaiting(false, error ? HINTS[error] : '');
}

let voice = null;

function playVoice(base64Mp3) {
  stopVoice();
  voice = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
  voice.play().catch(() => hint('Click the page once so the browser lets him speak.'));
}

function stopVoice() {
  voice?.pause();
  voice = null;
}

function onTypedAsk(event) {
  event.preventDefault();
  if (waiting) return;
  const text = $('question').value;
  $('question').value = '';
  askQuestion(text);
}

function beginTalking() {
  if (waiting) return;
  stopVoice();
  if (!startClip()) return;
  $('talk').textContent = 'Listening… let go to ask';
  hint('');
}

async function finishTalking() {
  if (!recording()) return;
  $('talk').textContent = 'Hold to talk (or hold Space)';
  const clip = await endClip();
  if (!clip) return hint(HINTS.tap);
  setWaiting(true, 'Listening back…');
  const { text, error } = await hearServer(clip);
  setWaiting(false, error ? HINTS[error] : '');
  if (text) await askQuestion(text);
}

async function turnOnMic() {
  try {
    await prepareMic();
    $('mic-on').hidden = true;
    $('talk').hidden = false;
    hint('Microphone on. Hold Space or the button and ask your question.');
  } catch {
    hint(HINTS.noMic);
  }
}

const typingInBox = (event) => event.target instanceof HTMLInputElement;

document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat || typingInBox(event) || !micReady()) return;
  event.preventDefault();
  beginTalking();
});
document.addEventListener('keyup', (event) => {
  if (event.code !== 'Space' || typingInBox(event) || !micReady()) return;
  event.preventDefault();
  finishTalking();
});
$('talk').addEventListener('pointerdown', beginTalking);
$('talk').addEventListener('pointerup', finishTalking);
$('talk').addEventListener('pointerleave', finishTalking);
$('mic-on').addEventListener('click', turnOnMic);
$('ask-form').addEventListener('submit', onTypedAsk);

async function showStatus() {
  try {
    const { live } = await (await fetch('/api/health')).json();
    $('status').textContent = live ? 'Live: Mistral connected.' : 'Offline: no Mistral key on the server.';
  } catch {
    $('status').textContent = 'Server not reachable.';
  }
}

renderPapers();
showStatus();
