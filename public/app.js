// Screen code only. Every rule (limits, clock, stamps, score) is decided by
// /src/rules.js; this file shows the shift and talks to our server.
import * as R from '/src/rules.js';
import { getTraveller } from '/src/travellers/index.js';
import { mockReply } from '/src/mockBrain.js';
import { endClip, micReady, prepareMic, recording, startClip } from '/mic.js';
import { createBooth } from '/booth.js';
import { createSounds } from '/sounds.js';

const $ = (id) => document.getElementById(id);

let shift = R.newShift();
let started = false;
let live = false;
let voice = null;
let stampingNow = false;
let talkingTo = null;
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
};
const TOOL_TIPS = {
  papers: 'Papers: click to read',
  notebook: 'Scratchpad: click to open',
  mic: 'Microphone: hold to ask (or hold Space)',
  'stamp-through': 'Stamp: let them through',
  'stamp-away': 'Stamp: turn them away',
};
const STAMP_WORDS = { through: 'Through', away: 'Turned away' };
const END_REASONS = { queueEmpty: 'Queue cleared.', time: "Time's up. Anyone not stamped counts as wrong." };

const hint = (text) => { $('hint').textContent = text; };

// The 3D booth is scenery and controls together; without it the plain papers
// panel and the toolbar still run the whole game.
const booth = createBooth($('booth'), {
  onMicDown: () => beginTalking(),
  onMicUp: () => finishTalking(),
  onStampClick: (verdict) => stampTraveller(verdict),
  onHover: (tool) => { $('tool-tip').textContent = TOOL_TIPS[tool] ?? ''; },
});
createSounds().follow(booth);

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
    return res.ok && body.text ? { text: body.text } : { error: 'notHeard' };
  } catch {
    return { error: 'notHeard' };
  }
}

// ---- Voice out ----

function playVoice(base64Mp3) {
  stopVoice();
  const clip = new Audio(`data:audio/mpeg;base64,${base64Mp3}`);
  voice = clip;
  clip.addEventListener('ended', () => { if (voice === clip) booth?.setTalking(false); });
  booth?.setTalking(true);
  clip.play().catch(() => {
    booth?.setTalking(false);
    hint(HINTS.blocked);
  });
}

function stopVoice() {
  voice?.pause();
  voice = null;
  booth?.setTalking(false);
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
  // A "say that again" fallback is spoken but, like a failed call, not counted.
  shift = R.finishQuestion(shift, asked.request.id, reply && !reply.fallback ? reply : null);
  // Unchanged means the traveller was stamped while we waited: stay quiet.
  if (shift === before) return;
  if (error) hint(HINTS[error]);
  else hint(reply.fallback ? `${traveller.name}: "${reply.reply}" (that question wasn't counted)` : '');
  if (reply) booth?.setMood(reply.mood);
  if (reply?.audio) playVoice(reply.audio);
  render();
}

// The stamp comes down on the papers first, then the rules record it and the
// traveller reacts and walks off.
async function stampTraveller(verdict) {
  if (!started || stampingNow || shift.phase !== 'playing') return;
  stampingNow = true;
  const travellerId = R.currentTravellerId(shift);
  stopVoice();
  await booth?.stamp(verdict, getTraveller(travellerId).papers);
  stampingNow = false;
  const result = R.stamp(shift, verdict);
  if (result.error) return hint(HINTS[result.error]);
  shift = result.shift;
  booth?.show(R.currentTravellerId(shift), { reaction: verdict });
  $('last-stamp').textContent = `${getTraveller(travellerId).name}: stamped ${STAMP_WORDS[verdict].toUpperCase()}`;
  hint('');
  render();
}

function beginTalking() {
  if (!started || shift.phase !== 'playing' || shift.pending || shift.hearing) return;
  stopVoice();
  if (!startClip()) return;
  talkingTo = R.currentTravellerId(shift);
  booth?.setRecording(true);
  $('talk').textContent = 'Listening… let go to ask';
  hint('Listening… let go to ask.');
}

async function finishTalking() {
  if (!recording()) return;
  booth?.setRecording(false);
  $('talk').textContent = 'Hold to talk';
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
    } catch {
      hint(HINTS.noMic);
    }
  }
  lastFrame = performance.now();
  render();
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

// Subtitles: the last question and the last answer. No mood label: mood
// comes through the voice and the face, never as text.
function renderCaptions(traveller) {
  const { history } = shift.cases[traveller.id];
  const last = history.at(-1);
  if (shift.pending) {
    $('you-said').textContent = `You: ${shift.pending.question}`;
    $('subtitle').textContent = '';
  } else if (last) {
    $('you-said').textContent = `You: ${last.question}`;
    $('subtitle').textContent = `${traveller.name}: ${last.reply}${last.cracked ? ' [He cracked!]' : ''}`;
  } else {
    $('you-said').textContent = '';
    $('subtitle').textContent = '';
  }
  $('captions').hidden = !$('you-said').textContent;
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
  const paused = shift.pending || shift.hearing ? ' (paused)' : '';
  $('clock').textContent = started ? `Clock ${clock}${paused}` : '';
}

function render() {
  const over = shift.phase === 'over';
  const playing = started && !over;
  $('report').hidden = !started || !over;
  $('shift-info').hidden = !playing;
  $('controls').hidden = !playing;
  $('fallback').hidden = Boolean(booth) || !playing;
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
  const busy = Boolean(shift.pending || shift.hearing);
  $('ask').disabled = busy || left === 0;
  $('talk').disabled = busy || left === 0 || !micReady();
}

function frame(now) {
  if (started && shift.phase === 'playing') {
    shift = R.tick(shift, now - lastFrame);
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
$('show-papers').addEventListener('click', () => booth?.toggle('papers'));
$('show-notes').addEventListener('click', () => booth?.toggle('notebook'));
$('stamp-through').addEventListener('click', () => stampTraveller('through'));
$('stamp-away').addEventListener('click', () => stampTraveller('away'));
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
