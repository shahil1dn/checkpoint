// Screen code only. Every rule (limits, clock, stamps, score) is decided by
// /src/rules.js; this file shows the shift and talks to our server.
import * as R from '/src/rules.js';
import { getTraveller } from '/src/travellers/index.js';
import { mockReply } from '/src/mockBrain.js';
import { endClip, micReady, prepareMic, recording, startClip } from '/mic.js';
import { createBooth } from '/booth.js';
import { MAX_LINES, lineForHeard, lineForSpeech, lineForTyped, linesForAnswer, modelName } from '/computer.js';
import { createSounds } from '/sounds.js';

const $ = (id) => document.getElementById(id);

let shift = R.newShift();
let started = false;
let live = false;
let voice = null;
let models = null;      // which Mistral model does which job, from /api/health
const callLog = [];     // the lines on the inspector's computer
let stampingNow = false;
let talkingTo = null;
let micSetup = false;
let lastFrame = performance.now();

const HINTS = {
  empty: 'Say or type a question first.',
  tooLong: 'Keep it under 300 characters.',
  pending: 'Wait for the answer.',
  outOfQuestions: 'No questions left. Stamp the papers.',
  shiftOver: 'The shift is over.',
  unclear: 'They mumble something unclear. Ask again.',
  tap: 'Hold the microphone (or Space) while you talk, then let go.',
  notHeard: "Didn't catch that. Try again.",
  noMic: 'No microphone, so type your questions.',
  blocked: 'Click the page once so the browser lets them speak.',
  noBribe: 'Nothing is on offer.',
  bribeOnTable: 'Take what he offered, or stamp the papers.',
};
const TOOL_TIPS = {
  papers: 'Papers: click to read',
  notebook: 'Scratchpad: click to open',
  transcript: 'Transcript: click to read it all',
  bribe: 'A bribe: click to pocket it',
  mic: 'Microphone: hold to ask (or hold Space)',
  'stamp-through': 'Stamp: let them through',
  'stamp-away': 'Stamp: turn them away',
};
const STAMP_WORDS = { through: 'Through', away: 'Turned away' };
const ITEM_WORDS = { croissant: 'croissant', cheese: 'wedge of cheese', sticker: 'sticker' };
const END_REASONS = { queueEmpty: 'Queue cleared.', time: "Time's up. Anyone not stamped counts as wrong." };

const hint = (text) => { $('hint').textContent = text; };

// What each edge arrow turns to, from each view.
const LOOK_LABELS = {
  left: [null, 'Window ›'],
  window: ['‹ Computer', 'Notices ›'],
  right: ['‹ Window', null],
};
function renderLook(view) {
  const [left, right] = LOOK_LABELS[view];
  $('look-left').textContent = left ?? '';
  $('look-right').textContent = right ?? '';
  $('look-left').hidden = !left;
  $('look-right').hidden = !right;
}

// Which cue shows for what's happening now: the mic's light and ring while
// recording, a thought bubble while the traveller thinks, and the hint's style.
function renderActivity() {
  const mode = !started || shift.phase !== 'playing' ? ''
    : recording() ? 'listening'
    : shift.hearing ? 'transcribing'
    : shift.pending ? 'thinking' : '';
  $('hint').dataset.mode = mode;
  booth?.setRecording(mode === 'listening');
  booth?.setThinking(mode === 'thinking');
}

// The 3D booth is scenery and controls together: you click the desk itself.
// Without it, the plain papers panel and a button row run the whole game.
const booth = createBooth($('booth'), {
  onMicDown: () => beginTalking(),
  onMicUp: () => finishTalking(),
  onStampClick: (verdict) => stampTraveller(verdict),
  onBribeClick: () => pocketBribe(),
  onHover: (tool) => { $('tool-tip').textContent = TOOL_TIPS[tool] ?? ''; },
  onView: (view) => renderLook(view),
});

// ---- Server calls. Each returns a value or an error name, never throws. ----

async function fetchReply(request) {
  if (!live) return { reply: R.parseReply(mockReply(request)) };
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ travellerId: request.travellerId, question: request.question, history: request.history, notes: request.notes }),
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
    return res.ok && body.text ? { text: body.text, ms: body.ms } : { error: 'notHeard' };
  } catch {
    return { error: 'notHeard' };
  }
}

// His last-ditch bribe, in his own voice. The server makes it once per
// traveller, so asking early (at the start of the shift) makes it instant later.
async function fetchPlea(travellerId) {
  try {
    const res = await fetch(`/api/plea?travellerId=${encodeURIComponent(travellerId)}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ---- Voice out ----

// The inspector's computer shows each real Mistral call as it happens.
function logCall(...lines) {
  callLog.push(...lines);
  callLog.splice(0, Math.max(0, callLog.length - MAX_LINES));
  booth?.setComputer(callLog);
}

// onDone runs once the voice stops for any reason: it ends, is cut off, or can't play.
function playVoice(base64Mp3, speechMs, onDone = () => {}) {
  stopVoice();
  const clip = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
  voice = clip;
  if (speechMs !== undefined) {
    clip.addEventListener('loadedmetadata', () => logCall(lineForSpeech(clip.duration, speechMs, models)), { once: true });
  }
  clip.addEventListener('ended', () => { if (voice === clip) booth?.setTalking(false); });
  for (const stopped of ['ended', 'pause', 'error']) clip.addEventListener(stopped, onDone);
  booth?.setTalking(true);
  clip.play().catch(() => {
    booth?.setTalking(false);
    hint(HINTS.blocked);
    onDone();
  });
}

function stopVoice() {
  voice?.pause();
  voice = null;
  booth?.setTalking(false);
}

// ---- Actions ----

// Typed and spoken questions both end up here.
async function askQuestion(text, { typed = false } = {}) {
  const asked = R.startQuestion(shift, text);
  if (asked.error) return hint(HINTS[asked.error]);
  shift = asked.shift;
  if (typed && live) logCall(lineForTyped(asked.request.question));
  const traveller = getTraveller(asked.request.travellerId);
  hint(`${traveller.name} is thinking`);
  render();

  const { reply, error } = await fetchReply(asked.request);
  const before = shift;
  // A "say that again" fallback is spoken but, like a failed call, not counted.
  shift = R.finishQuestion(shift, asked.request.id, reply && !reply.fallback ? reply : null);
  // Unchanged means the traveller was stamped while we waited: stay quiet.
  if (shift === before) return;
  if (reply?.timings) logCall(...linesForAnswer(reply, traveller.name, models));
  else if (error && live) logCall({ who: modelName(models?.answer), what: 'call failed, so nothing was counted' });
  if (error) hint(HINTS[error]);
  else if (reply.fallback) hint(`${traveller.name}: "${reply.reply}" (that question wasn't counted)`);
  else hint('');
  if (reply) booth?.setMood(reply.mood);
  if (reply?.audio) playVoice(reply.audio, reply.timings?.speechMs);
  render();
}

// The stamp comes down on the papers first, then the rules record it and the
// traveller reacts and walks off. The first TURNED AWAY on each traveller
// doesn't come down: he makes his last-ditch offer instead (Shahil 14:34).
async function stampTraveller(verdict) {
  if (!started || stampingNow || shift.phase !== 'playing') return;
  if (R.pleadsFirst(shift, verdict)) return hearPlea();
  await bringStampDown(verdict, (s) => R.stamp(s, verdict));
}

// rule turns the shift into the stamped one; returns false if it refused.
async function bringStampDown(verdict, rule) {
  stampingNow = true;
  const travellerId = R.currentTravellerId(shift);
  stopVoice();
  await booth?.stamp(verdict, getTraveller(travellerId).papers);
  stampingNow = false;
  const result = rule(shift);
  if (result.error) {
    hint(HINTS[result.error]);
    return false;
  }
  shift = result.shift;
  booth?.show(R.currentTravellerId(shift), { reaction: verdict });
  $('last-stamp').textContent = `${getTraveller(travellerId).name}: stamped ${STAMP_WORDS[verdict].toUpperCase()}`;
  hint('');
  render();
  return true;
}

// "Wait, wait!": he says his line in his own voice, it prints on the
// transcript, and his bribe sits on the window ledge. The clock waits while
// he says it. Offline there is no voice, so it doesn't wait.
async function hearPlea() {
  stopVoice();
  const { shift: offered, offer } = R.stamp(shift, 'away');
  shift = offered;
  const name = getTraveller(offer.travellerId).name;
  hint(`${name} slides a ${ITEM_WORDS[offer.item]} onto the ledge. Take it, or stamp TURNED AWAY again.`);
  booth?.setMood(offer.mood);
  render();
  const endPlea = () => { shift = R.setPleading(shift, false); };
  const plea = live ? await fetchPlea(offer.travellerId) : null;
  // Stamped or paid while his voice was being made: he says nothing.
  if (!R.bribeOffer(shift)) return endPlea();
  if (plea?.audio) playVoice(plea.audio, plea.speechMs, endPlea);
  else endPlea();
}

// Pocketing it lets him through: the THROUGH stamp comes down, and it goes on your record.
async function pocketBribe() {
  const offer = R.bribeOffer(shift);
  if (!started || stampingNow || !offer) return;
  booth?.setBribe(null);
  if (await bringStampDown('through', R.takeBribe)) {
    hint(`You pocket the ${ITEM_WORDS[offer.item]} and stamp ${getTraveller(offer.travellerId).name} THROUGH. That goes on your record.`);
  }
}

function beginTalking() {
  if (!started || shift.phase !== 'playing' || shift.pending || shift.hearing) return;
  if (R.bribeOffer(shift)) return hint(HINTS.bribeOnTable);
  stopVoice();
  if (!startClip()) return;
  talkingTo = R.currentTravellerId(shift);
  $('talk').textContent = 'Listening… let go to ask';
  hint('Listening… let go to ask.');
  renderActivity();
}

async function finishTalking() {
  if (!recording()) return;
  $('talk').textContent = 'Hold to talk';
  const clip = await endClip();
  renderActivity();
  if (!clip) return hint(HINTS.tap);
  shift = R.setHearing(shift, true);
  hint('Transcribing your question');
  render();
  const { text, ms, error } = await fetchTranscript(clip);
  shift = R.setHearing(shift, false);
  render();
  if (error) return hint(HINTS[error]);
  logCall(lineForHeard({ text, ms }, models));
  // A question meant for someone already stamped is not passed to the next one.
  if (R.currentTravellerId(shift) !== talkingTo) return hint('');
  await askQuestion(text);
}

async function startShift() {
  started = true;
  $('start-screen').hidden = true;
  micSetup = live;
  if (live) hint('Allow the microphone, or type a question.');
  if (live) for (const id of shift.queue) fetchPlea(id);
  lastFrame = performance.now();
  render();
  if (live) {
    try {
      await prepareMic();
      if (!shift.pending && !shift.hearing) hint('');
    } catch {
      if (!shift.pending && !shift.hearing) hint(HINTS.noMic);
    } finally {
      micSetup = false;
      lastFrame = performance.now();
      render();
    }
  }
}

function playAgain() {
  shift = R.restartShift(shift);
  stopVoice();
  hint('');
  $('last-stamp').textContent = '';
  lastFrame = performance.now();
  render();
}

// ---- Drawing ----

// Without 3D, the papers and notes show as plain text instead of on the desk.
function renderFallbackPanel(traveller) {
  $('papers').replaceChildren(...Object.entries(traveller.papers).flatMap(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }));
  const notes = shift.cases[traveller.id].notes;
  $('notes').replaceChildren(...(notes.length ? notes : ['Nothing noted yet.']).map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}

// The conversation prints on the transcript slip on the desk. The caption
// lines keep the last question and answer as text: on screen only without
// 3D, and always there for screen readers. No mood label: mood comes through
// the voice and the face, never as text.
function renderTranscript(traveller) {
  const { history } = shift.cases[traveller.id];
  const lines = history.flatMap((turn) => [
    { who: 'You', text: turn.question },
    { who: traveller.name, text: `${turn.reply}${turn.cracked ? ' [He cracked!]' : ''}` },
  ]);
  if (shift.pending) lines.push({ who: 'You', text: shift.pending.question }, { who: traveller.name, text: '…' });
  const offer = R.bribeOffer(shift);
  if (offer) lines.push({ who: traveller.name, text: offer.line });
  booth?.setTranscript(traveller.name, lines);
}

function renderCaptions(traveller) {
  const { history } = shift.cases[traveller.id];
  const last = history.at(-1);
  const offer = R.bribeOffer(shift);
  if (offer) {
    $('you-said').textContent = last ? `You: ${last.question}` : '';
    $('subtitle').textContent = `${traveller.name}: ${offer.line}`;
  } else if (shift.pending) {
    $('you-said').textContent = `You: ${shift.pending.question}`;
    $('subtitle').textContent = '';
  } else if (last) {
    $('you-said').textContent = `You: ${last.question}`;
    $('subtitle').textContent = `${traveller.name}: ${last.reply}${last.cracked ? ' [He cracked!]' : ''}`;
  } else {
    $('you-said').textContent = '';
    $('subtitle').textContent = '';
  }
  $('captions').hidden = !$('you-said').textContent && !$('subtitle').textContent;
  $('captions').classList.toggle('screen-reader-only', Boolean(booth));
}

function renderReport() {
  const report = R.shiftReport(shift);
  $('end-reason').textContent = END_REASONS[shift.endReason] ?? '';
  $('report-rows').replaceChildren(...report.rows.map((row) => {
    const tr = document.createElement('tr');
    tr.dataset.result = row.correct ? 'right' : 'wrong';
    const cells = [
      row.name,
      `${row.stamp ? STAMP_WORDS[row.stamp] : 'Not stamped'}${row.bribeTaken ? ' (took a bribe)' : ''}`,
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
  const bribers = report.rows.filter((row) => row.bribeTaken).map((row) => row.name).join(', ');
  $('bribes').textContent = report.record === 'corrupt'
    ? `Bribes taken: ${report.bribesTaken} (${bribers}). Inspector's record: CORRUPT.`
    : "No bribes taken. Inspector's record: clean.";
  $('bribes').className = report.record;
}

function renderClock() {
  const secondsLeft = Math.ceil(R.timeLeftMs(shift) / 1000);
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const paused = shift.pending || shift.hearing || shift.pleading ? ' (paused)' : '';
  $('clock').textContent = started ? `Clock ${clock}${paused}` : '';
}

function render() {
  const over = shift.phase === 'over';
  const playing = started && !over;
  renderActivity();
  $('report').hidden = !started || !over;
  $('shift-info').hidden = !playing;
  $('controls').hidden = !playing;
  $('look').hidden = !playing || !booth;
  $('fallback').hidden = Boolean(booth) || !playing;
  $('tools').hidden = Boolean(booth);
  $('hint').hidden = !playing;
  $('tool-tip').hidden = !playing;
  renderClock();
  if (!stampingNow) booth?.show(over ? null : R.currentTravellerId(shift));
  if (over) {
    booth?.putDown();
    $('captions').hidden = true;
    return renderReport();
  }
  const traveller = getTraveller(R.currentTravellerId(shift));
  const left = R.questionsLeft(shift, traveller.id);
  $('traveller-name').textContent = traveller.name;
  $('queue-position').textContent = `Traveller ${shift.current + 1} of ${shift.queue.length}`;
  $('questions-left').textContent = `Questions left: ${left} of ${R.MAX_QUESTIONS}`;
  booth?.setPapers(traveller.papers, shift.cases[traveller.id].stamp);
  booth?.setNotes(traveller.name, shift.cases[traveller.id].notes);
  if (!booth) renderFallbackPanel(traveller);
  renderCaptions(traveller);
  renderTranscript(traveller);
  const offer = R.bribeOffer(shift);
  if (!stampingNow) booth?.setBribe(offer?.item ?? null);
  $('take-bribe').hidden = !offer;
  $('talk').disabled = Boolean(shift.pending || shift.hearing) || left === 0 || !micReady();
}

function frame(now) {
  if (started && shift.phase === 'playing') {
    if (!micSetup) shift = R.tick(shift, now - lastFrame);
    if (shift.phase === 'over') {
      stopVoice();
      booth?.show(null, { reaction: 'away' });
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
  if (typingInBox(event) || !started) return;
  if (event.code === 'Space' && !event.repeat && micReady()) {
    event.preventDefault();
    beginTalking();
  } else if (event.code === 'KeyP') booth?.toggle('papers');
  else if (event.code === 'KeyN') booth?.toggle('notebook');
  else if (event.code === 'Escape') booth?.putDown();
  else if (event.code === 'ArrowLeft') booth?.look(-1);
  else if (event.code === 'ArrowRight') booth?.look(1);
});
// The hover label follows the pointer, flipping to its left near the right edge.
document.addEventListener('pointermove', (event) => {
  const tip = $('tool-tip');
  tip.style.left = `${event.clientX}px`;
  tip.style.top = `${event.clientY}px`;
  tip.classList.toggle('flip', event.clientX > innerWidth - 260);
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
  askQuestion(text, { typed: true });
});
$('show-papers').addEventListener('click', () => booth?.toggle('papers'));
$('show-notes').addEventListener('click', () => booth?.toggle('notebook'));
$('stamp-through').addEventListener('click', () => stampTraveller('through'));
$('stamp-away').addEventListener('click', () => stampTraveller('away'));
$('take-bribe').addEventListener('click', pocketBribe);
$('look-left').addEventListener('click', () => booth?.look(-1));
$('look-right').addEventListener('click', () => booth?.look(1));
$('start').addEventListener('click', startShift);
$('again').addEventListener('click', playAgain);

async function checkLive() {
  try {
    ({ live, models } = await (await fetch('/api/health')).json());
  } catch {
    live = false;
  }
  logCall(live ? { who: 'Mistral', what: 'connected: waiting for the first question' } : { who: 'Offline', what: 'no key, so no Mistral calls: canned replies' });
  $('status').textContent = live ? 'Live: Mistral connected.' : 'Offline: canned replies, no voices.';
}

// Sounds follow what the page tells the booth (public/sounds.js).
createSounds().follow(booth);
if (booth) renderLook(booth.view());
render();
checkLive();
requestAnimationFrame(frame);
