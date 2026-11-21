// Screen code only. Every rule (limits, clock, stamps, score) is decided by
// /src/rules.js; this file shows the shift and talks to our server.
import * as R from '/src/rules.js';
import { getTraveller } from '/src/travellers.js';
import { mockReply } from '/src/mockBrain.js';
import { endClip, micReady, prepareMic, recording, startClip } from '/mic.js';

const $ = (id) => document.getElementById(id);

let shift = R.newShift();
let started = false;
let live = false;
let lastStamp = null;
let voice = null;
let lastFrame = performance.now();

const HINTS = {
  empty: 'Ask something first.',
  tooLong: 'Keep it under 300 characters.',
  pending: 'Wait for the answer.',
  outOfQuestions: 'No questions left. Stamp them.',
  shiftOver: 'The shift is over.',
  unclear: 'They mumble something unclear. Ask again.',
  tap: 'Hold Space while you talk, then let go.',
  notHeard: "Didn't catch that. Try again.",
  noMic: 'No microphone, so type your questions.',
  blocked: 'Click the page once so the browser lets them speak.',
};
const STAMP_WORDS = { through: 'Through', away: 'Turned away' };
const END_REASONS = { queueEmpty: 'Queue cleared.', time: "Time's up. Anyone not stamped counts as wrong." };

const hint = (text) => { $('hint').textContent = text; };

// ---- Server calls. Each returns a value or an error name, never throws. ----

async function fetchReply(request) {
  if (!live) return { reply: R.parseReply(mockReply(request)) };
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ travellerId: request.travellerId, question: request.question, history: request.history }),
    });
    return res.ok ? { reply: await res.json() } : { error: 'unclear' };
  } catch {
    return { error: 'unclear' };
  }
}

async function fetchTranscript(clip) {
  try {
    const res = await fetch('/api/hear', { method: 'POST', headers: { 'content-type': clip.type }, body: clip });
    const body = await res.json();
    return res.ok && body.text ? { text: body.text } : { error: 'notHeard' };
  } catch {
    return { error: 'notHeard' };
  }
}

// ---- Voice out ----

function playVoice(base64Mp3) {
  stopVoice();
  voice = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
  voice.play().catch(() => hint(HINTS.blocked));
}

function stopVoice() {
  voice?.pause();
  voice = null;
}

// ---- Actions ----

// Typed and spoken questions both end up here.
async function askQuestion(text) {
  const asked = R.startQuestion(shift, text);
  if (asked.error) return hint(HINTS[asked.error]);
  shift = asked.shift;
  const traveller = getTraveller(asked.request.travellerId);
  hint(`${traveller.name} is thinking…`);
  render();

  const { reply, error } = await fetchReply(asked.request);
  const before = shift;
  shift = R.finishQuestion(shift, asked.request.id, reply ?? null);
  // Unchanged means the traveller was stamped while we waited: stay quiet.
  if (shift === before) return;
  hint(error ? HINTS[error] : '');
  if (reply?.audio) playVoice(reply.audio);
  render();
}

function onStamp(verdict) {
  const travellerId = R.currentTravellerId(shift);
  const result = R.stamp(shift, verdict);
  if (result.error) return hint(HINTS[result.error]);
  shift = result.shift;
  stopVoice();
  lastStamp = { name: getTraveller(travellerId).name, verdict };
  hint('');
  render();
}

let talkingTo = null;

function beginTalking() {
  if (!started || shift.phase !== 'playing' || shift.pending || shift.hearing) return;
  stopVoice();
  if (!startClip()) return;
  talkingTo = R.currentTravellerId(shift);
  $('talk').textContent = 'Listening… let go to ask';
  hint('');
}

async function finishTalking() {
  if (!recording()) return;
  $('talk').textContent = 'Hold to talk (or hold Space)';
  const clip = await endClip();
  if (!clip) return hint(HINTS.tap);
  shift = R.setHearing(shift, true);
  hint('Listening back…');
  render();
  const { text, error } = await fetchTranscript(clip);
  shift = R.setHearing(shift, false);
  render();
  if (error) return hint(HINTS[error]);
  // A question meant for someone already stamped is not passed to the next one.
  if (R.currentTravellerId(shift) !== talkingTo) return hint('');
  await askQuestion(text);
}

async function startShift() {
  started = true;
  $('start-screen').hidden = true;
  if (live) {
    try {
      await prepareMic();
      $('talk').hidden = false;
    } catch {
      hint(HINTS.noMic);
    }
  }
  lastFrame = performance.now();
  render();
}

function playAgain() {
  shift = R.restartShift(shift);
  lastStamp = null;
  stopVoice();
  lastFrame = performance.now();
  render();
}

// ---- Drawing ----

function renderPapers(traveller) {
  $('traveller-name').textContent = traveller.name;
  $('papers').replaceChildren(...Object.entries(traveller.papers).flatMap(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }));
}

function renderConversation(traveller) {
  const lines = [];
  for (const exchange of shift.cases[traveller.id].history) {
    lines.push(`You: ${exchange.question}`);
    // A traveller with mood voices shows his mood by voice alone: that's the tell.
    const mood = traveller.voices ? '' : ` (${exchange.mood})`;
    const cracked = exchange.cracked ? ' [He cracked!]' : '';
    lines.push(`${traveller.name}${mood}: ${exchange.reply}${cracked}`);
  }
  if (shift.pending) lines.push(`You: ${shift.pending.question}`, `${traveller.name}: …`);
  $('conversation').replaceChildren(...lines.map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}

function renderReport() {
  const report = R.shiftReport(shift);
  $('end-reason').textContent = END_REASONS[shift.endReason] ?? '';
  $('report-rows').replaceChildren(...report.rows.map((row) => {
    const tr = document.createElement('tr');
    const cells = [
      row.name,
      row.stamp ? STAMP_WORDS[row.stamp] : 'Not stamped',
      row.honest ? `Honest. ${row.secret}` : `Lying. ${row.secret}`,
      row.correct ? 'Right' : 'Wrong',
    ];
    tr.replaceChildren(...cells.map((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      return td;
    }));
    return tr;
  }));
  $('score').textContent = `You got ${report.correct} of ${report.total} right.`;
}

function renderClock() {
  const secondsLeft = Math.ceil(R.timeLeftMs(shift) / 1000);
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const paused = shift.pending || shift.hearing ? ' (paused while they think)' : '';
  $('clock').textContent = started ? `Shift clock ${clock}${paused}` : '';
}

function render() {
  const over = shift.phase === 'over';
  $('desk').hidden = !started || over;
  $('report').hidden = !started || !over;
  $('last-stamp').textContent = lastStamp ? `${lastStamp.name}: stamped ${STAMP_WORDS[lastStamp.verdict].toUpperCase()}` : '';
  renderClock();
  if (over) {
    $('queue-position').textContent = '';
    return renderReport();
  }
  const traveller = getTraveller(R.currentTravellerId(shift));
  $('queue-position').textContent = started ? `Traveller ${shift.current + 1} of ${shift.queue.length}` : '';
  renderPapers(traveller);
  renderConversation(traveller);
  const left = R.questionsLeft(shift, traveller.id);
  $('questions-left').textContent = `Questions left: ${left} of ${R.MAX_QUESTIONS}`;
  const busy = Boolean(shift.pending || shift.hearing);
  $('ask').disabled = busy || left === 0;
  $('talk').disabled = busy || left === 0;
}

function frame(now) {
  if (started && shift.phase === 'playing') {
    shift = R.tick(shift, now - lastFrame);
    if (shift.phase === 'over') {
      stopVoice();
      render();
    } else {
      renderClock();
    }
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}

// ---- Wiring ----

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
$('ask-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = $('question').value;
  $('question').value = '';
  askQuestion(text);
});
$('stamp-through').addEventListener('click', () => onStamp('through'));
$('stamp-away').addEventListener('click', () => onStamp('away'));
$('start').addEventListener('click', startShift);
$('again').addEventListener('click', playAgain);

async function checkLive() {
  try {
    ({ live } = await (await fetch('/api/health')).json());
  } catch {
    live = false;
  }
  $('status').textContent = live ? 'Live: Mistral connected.' : 'Offline: canned replies, no voices.';
}

render();
checkLive();
requestAnimationFrame(frame);
