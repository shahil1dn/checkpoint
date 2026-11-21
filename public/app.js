// Screen code only. Every rule (limits, clock, stamps, score) is decided by
// /src/rules.js; this file shows the shift and talks to our server.
import * as R from '/src/rules.js';
import { getTraveller } from '/src/travellers/index.js';
import { documentsFor } from '/src/records/index.js';
import { mockReply } from '/src/mockBrain.js';
import { endClip, micReady, prepareMic, recording, startClip } from '/mic.js';
import { createBooth } from '/booth.js';
import { MAX_LINES, lineForHeard, lineForLookup, lineForSpeech, lineForTyped, linesForAnswer, modelName } from '/computer.js';
import { createSounds } from '/sounds.js';

const $ = (id) => document.getElementById(id);

let shift = R.newShift();
let started = false;
let live = false;
let voice = null;
// His newest line while it types out on the transcript, like a typewriter, in step
// with his voice: { id: traveller, text, shown: characters so far, cps: null until
// his voice starts }. null once the line is complete.
let typing = null;
const TYPE_CPS = 30;   // with no voice to follow: characters a second
let models = null;      // which Mistral model does which job, from /api/health
const callLog = [];     // the lines on the inspector's computer
let stampingNow = false;
let talkingTo = null;
let micSetup = false;
let lastFrame = performance.now();
// What the records terminal shows: the latest lookup, while it searches and after.
let screenLookup = null;
// The end-of-shift review on the computer, once per shift (Shahil 17:10).
let shiftReview = null;
let cursorOn = true;
const STEP_PAUSE_MS = 450;   // steps can arrive together; each gets a moment on screen

const HINTS = {
  empty: 'Say or type a question first.',
  tooLong: 'Keep it under 300 characters.',
  pending: 'Wait for the answer.',
  outOfQuestions: 'No questions left. Stamp the papers.',
  outOfTime: 'Time is up for this traveller. Stamp the papers.',
  shiftOver: 'The shift is over.',
  unclear: 'They mumble something unclear. Ask again.',
  tap: 'Hold the microphone (or Space) while you talk, then let go.',
  notHeard: "Didn't catch that. Try again.",
  noMic: 'No microphone, so type your questions.',
  blocked: 'Click the page once so the browser lets them speak.',
  noBribe: 'Nothing is on offer.',
  lookingUp: 'Looking it up on the records terminal (turn left to watch).',
  recordsReady: 'The records report is ready: turn left to the computer.',
  lookupPending: 'The records terminal is still searching.',
  outOfLookups: 'No lookups left for this traveller.',
  alreadyLookedUp: 'Already looked up: the report is on the computer.',
  notGathered: 'The terminal only checks lines from his documents or his own answers.',
  noReport: "The records terminal found nothing it could report. That lookup wasn't counted.",
  lookupFailed: "The records terminal didn't answer. That lookup wasn't counted.",
  bribeOnTable: 'Take what he offered, or stamp the papers.',
};
const TOOL_TIPS = {
  'play-again': 'Play again: a new shift',
  papers: 'Case folder: click to open it',
  notebook: 'Scratchpad: click to open',
  transcript: 'Transcript: click to read it all',
  bribe: 'A bribe: click (or B) to pocket it',
  mic: 'Microphone: hold to ask (or hold Space)',
  'stamp-through': 'Stamp: let them through',
  'stamp-away': 'Stamp: turn them away',
  'start-shift': 'Start shift: back to the desk',
};
const STAMP_WORDS = { through: 'Through', away: 'Turned away' };
const END_REASONS = { queueEmpty: 'Queue cleared.' };

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
  onStartClick: () => startFromMenu(),
  onHover: (tool, detail) => { $('tool-tip').textContent = tipFor(tool, detail); },
  onLookup: (line) => lookUp(line),
  onPlayAgain: () => playAgain(),
  onView: (view) => {
    renderLook(view);
    $('tool-tip').textContent = '';
    if (view === 'left' && [HINTS.recordsReady, HINTS.lookingUp].includes($('hint').textContent)) hint('');
  },
});

// detail is the line under the pointer, or how many things the tray or spike holds.
function tipFor(tool, detail) {
  if (tool === 'line') return lineTip(detail);
  if (tool === 'tray') return `Confiscated papers: ${detail}`;
  if (tool === 'spike') return `Finished transcripts: ${detail}`;
  return TOOL_TIPS[tool] ?? '';
}

// The hover label on a line of a lifted paper.
function lineTip(line) {
  const id = R.currentTravellerId(shift);
  if (!id) return '';
  if (shift.cases[id].lookups.some((l) => l.line === line)) return 'Looked up: the report is on the computer';
  const left = R.lookupsLeft(shift, id);
  const shown = line.length > 44 ? `${line.slice(0, 43)}…` : line;
  return left ? `Look up: ${shown} (${left} of ${R.MAX_LOOKUPS} left)` : 'No lookups left for this traveller';
}

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

// The records terminal streams one JSON object a line: each step as it
// happens, then the report or an error.
async function fetchLookup(request, onStep) {
  try {
    const res = await fetch('/api/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ travellerId: request.travellerId, line: request.line, earlier: request.earlier }),
    });
    if (!res.ok) return { error: (await res.json().catch(() => ({}))).error ?? 'lookupFailed' };
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    const steps = [];
    let outcome = { error: 'lookupFailed' };
    let buffered = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = (buffered + value).split('\n');
      buffered = lines.pop();
      for (const event of lines.filter((l) => l.trim()).map((l) => JSON.parse(l))) {
        if (event.step) { steps.push(event.step); onStep(event.step); }
        if (event.answer) outcome = { result: { steps, answer: event.answer, ms: event.ms, tools: event.tools } };
        if (event.error) outcome = { error: event.error };
      }
    }
    return outcome;
  } catch {
    return { error: 'lookupFailed' };
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
  // The line this clip speaks types out as it plays, and is complete the moment
  // the clip ends or is cut off. A clip that can't play types at the fixed pace.
  const line = typing;
  clip.addEventListener('playing', () => {
    if (typing === line) startTyping(clip.duration > 0 && Number.isFinite(clip.duration) ? line.text.length / clip.duration : TYPE_CPS);
  }, { once: true });
  clip.addEventListener('error', () => { if (typing === line) startTyping(TYPE_CPS); }, { once: true });
  for (const stopped of ['ended', 'pause']) clip.addEventListener(stopped, () => { if (typing === line) finishTyping(); });
  if (speechMs !== undefined) {
    clip.addEventListener('loadedmetadata', () => logCall(lineForSpeech(clip.duration, speechMs, models)), { once: true });
  }
  for (const stopped of ['ended', 'error']) clip.addEventListener(stopped, () => { if (voice === clip) setSpeaking(false); });
  for (const stopped of ['ended', 'pause', 'error']) clip.addEventListener(stopped, onDone);
  setSpeaking(true);
  clip.play().catch(() => {
    if (typing === line) startTyping(TYPE_CPS);
    setSpeaking(false);
    hint(HINTS.blocked);
    onDone();
  });
}

// The line starts hidden; startTyping lets it begin, at cps characters a second.
function typeOut(id, text) { typing = { id, text, shown: 0, cps: null }; }
function startTyping(cps) { if (typing && typing.cps === null) typing.cps = cps; }
// Whatever interrupts it (the next question, a stamp, a new traveller, his voice
// cut off) leaves the whole line on the paper, never half of it.
function finishTyping() {
  if (!typing) return;
  typing = null;
  repaintTranscript();
}
function advanceTyping(seconds) {
  if (typing.id !== R.currentTravellerId(shift) || shift.phase === 'over') { typing = null; return; }
  const before = Math.floor(typing.shown);
  typing.shown += seconds * typing.cps;
  if (typing.shown >= typing.text.length) typing = null;
  if (!typing || Math.floor(typing.shown) !== before) repaintTranscript();
}
function repaintTranscript() {
  const id = R.currentTravellerId(shift);
  if (started && id && shift.phase !== 'over') renderTranscript(getTraveller(id));
}

function stopVoice() {
  voice?.pause();
  voice = null;
  setSpeaking(false);
}

// His clock waits while he talks, the same as while Mistral thinks.
function setSpeaking(speaking) {
  shift = R.setSpeaking(shift, speaking);
  booth?.setTalking(speaking);
}

// ---- Actions ----

// Typed and spoken questions both end up here.
async function askQuestion(text, { typed = false } = {}) {
  const asked = R.startQuestion(shift, text);
  if (asked.error) return hint(HINTS[asked.error]);
  shift = asked.shift;
  finishTyping();
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
  // A counted answer prints as he says it; the "say that again" fallback is never on paper.
  if (reply && !reply.fallback) typeOut(traveller.id, spokenLine(shift.cases[traveller.id].history.at(-1)));
  if (reply?.audio) playVoice(reply.audio, reply.timings?.speechMs);
  else startTyping(TYPE_CPS);
  render();
}

// Clicking a line on a lifted paper looks it up. The inspector can keep
// questioning while it searches; the steps show on the computer as they come.
async function lookUp(line) {
  if (!started) return;
  const asked = R.startLookup(shift, line);
  if (asked.error) return hint(HINTS[asked.error]);
  shift = asked.shift;
  const { request } = asked;
  const searcher = live ? `asking ${modelName(models?.records)} to search the records` : 'searching the records (offline: by code alone)';
  const view = { travellerId: request.travellerId, line: request.line, steps: [searcher], answer: [], status: 'searching' };
  screenLookup = view;
  if (booth?.view() !== 'left') hint(HINTS.lookingUp);
  render();
  let shown = Promise.resolve();
  const { result, error } = await fetchLookup(request, (step) => {
    shown = shown.then(() => new Promise((resolve) => setTimeout(resolve, STEP_PAUSE_MS))).then(() => { view.steps.push(step); renderTerminal(); });
  });
  await shown;
  const before = shift;
  shift = R.finishLookup(shift, request.id, result ?? null);
  // Unchanged means the shift was restarted while it searched: stay quiet.
  if (shift === before) return;
  view.status = result ? 'done' : 'failed';
  view.answer = result?.answer ?? [];
  if (result && live) logCall(lineForLookup(result, models));
  const stillHere = R.currentTravellerId(shift) === request.travellerId;
  if (stillHere && !shift.pending && !shift.hearing) {
    if (error) hint(HINTS[error] ?? HINTS.lookupFailed);
    else hint(booth?.view() === 'left' ? '' : HINTS.recordsReady);
  }
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
  await booth?.stamp(verdict, documentsFor(getTraveller(travellerId)));
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
  hint(`${name} offers a ${R.BRIBE_ITEMS[offer.item]}. Take it (B), or stamp TURNED AWAY.`);
  booth?.setMood(offer.mood);
  finishTyping();   // his last answer is whole on the paper before the plea starts
  typeOut(offer.travellerId, offer.line);
  render();
  const endPlea = () => { shift = R.setPleading(shift, false); };
  const plea = live ? await fetchPlea(offer.travellerId) : null;
  // Stamped or paid while his voice was being made: he says nothing.
  if (!R.bribeOffer(shift)) { finishTyping(); return endPlea(); }
  if (plea?.audio) playVoice(plea.audio, plea.speechMs, endPlea);
  else { startTyping(TYPE_CPS); endPlea(); }
}

// Pocketing it lets him through: the THROUGH stamp comes down, and it goes on your record.
async function pocketBribe() {
  const offer = R.bribeOffer(shift);
  if (!started || stampingNow || !offer) return;
  booth?.setBribe(null);
  if (await bringStampDown('through', R.takeBribe)) {
    hint(`You pocket the ${R.BRIBE_ITEMS[offer.item]} and stamp ${getTraveller(offer.travellerId).name} THROUGH. That goes on your record.`);
  }
}

function beginTalking() {
  if (!started || shift.phase !== 'playing' || shift.pending || shift.hearing) return;
  if (R.bribeOffer(shift)) return hint(HINTS.bribeOnTable);
  if (R.travellerTimeLeftMs(shift) <= 0) return hint(HINTS.outOfTime);
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
  $('start').disabled = true;
  $('start-screen').hidden = true;
  await booth?.runArrival(shift.queue);
  started = true;
  micSetup = live;
  if (live) hint('Allow the microphone, or type a question.');
  if (live) for (const id of shift.queue) if (getTraveller(id).bribe) fetchPlea(id);
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

// START SHIFT on the terminal: the inspector turns back to his desk, and only
// then does the shift (and its clock) begin.
let leavingMenu = false;
async function startFromMenu() {
  if (started || leavingMenu) return;
  leavingMenu = true;
  $('tool-tip').textContent = '';
  booth.setMenu(false);
  await new Promise((resolve) => setTimeout(resolve, 700));
  startShift();
}

async function playAgain() {
  shift = R.restartShift(shift);
  screenLookup = null;
  shiftReview = null;
  booth?.setReview(null);
  booth?.face('window');   // the new shift starts at the window
  $('booth').removeAttribute('aria-label');
  booth?.clearDesk();
  stopVoice();
  hint('');
  $('last-stamp').textContent = '';
  started = false;
  $('report').hidden = true;
  $('shift-info').hidden = true;
  $('controls').hidden = true;
  $('look').hidden = true;
  await booth?.runArrival(shift.queue);
  started = true;
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
const spokenLine = (turn) => `${turn.reply}${turn.cracked ? ' [He cracked!]' : ''}`;
// How much of a line is on the paper: all of it, unless it is his newest and still typing.
const typedPart = (id, text) => (typing && typing.id === id && typing.text === text ? text.slice(0, Math.floor(typing.shown)) : text);

function renderTranscript(traveller) {
  const { history } = shift.cases[traveller.id];
  const lines = history.flatMap((turn, i) => {
    const text = i === history.length - 1 ? typedPart(traveller.id, spokenLine(turn)) : spokenLine(turn);
    return [
      { who: 'You', text: turn.question },
      // His exact words, so a click can look them up (ADR-12), once they are all typed.
      ...(text ? [{ who: traveller.name, text, ...(text === spokenLine(turn) ? { lookup: turn.reply } : {}) }] : []),
    ];
  });
  // While he thinks, only your question is printed: the printer never overprints a line.
  if (shift.pending) lines.push({ who: 'You', text: shift.pending.question });
  const offer = R.bribeOffer(shift);
  const pleaTyped = offer ? typedPart(traveller.id, offer.line) : '';
  if (pleaTyped) lines.push({ who: traveller.name, text: pleaTyped });
  // What is on the paper of his newest line, for the browser check.
  $('subtitle').dataset.typed = pleaTyped || (history.length ? typedPart(traveller.id, spokenLine(history.at(-1))) : '');
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

// The shift is over: turn to the computer and show the review. The score and
// rating show at once, from the code; the server rebuilds them from its own
// truth and adds Mistral's words. If that fails, the code writes the words.
async function reviewShift() {
  const ended = shift;
  const report = R.shiftReport(ended);
  const rating = R.rateShift(report);
  const waiting = { status: 'waiting', correct: report.correct, total: report.total, rating, rows: report.rows, review: null };
  shiftReview = waiting;
  booth.setReview(waiting);
  // The screen is a picture in the 3D desk, so it is said in words too, for screen readers.
  $('booth').setAttribute('aria-label', `Shift review on the computer: ${report.correct} / ${report.total} correct, ${rating.title}`);
  booth.face('left');
  const body = {
    queue: ended.queue,
    stamps: Object.fromEntries(ended.queue.map((id) => [id, ended.cases[id].stamp])),
    bribesTaken: report.rows.filter((row) => row.bribeTaken).map((row) => row.id),
  };
  let done;
  try {
    const res = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`review ${res.status}`);
    done = { ...(await res.json()), status: 'done' };
  } catch {
    done = { ...waiting, status: 'done', review: R.cannedReview(report, rating), by: 'code' };
  }
  if (shiftReview !== waiting) return;   // Play again came first
  shiftReview = done;
  booth.setReview(shiftReview);
}

function renderTerminal() {
  const id = R.currentTravellerId(shift);
  if (!booth || !id) return booth?.setTerminal(null);
  const searching = shift.lookup?.travellerId === id ? 1 : 0;
  const lookup = screenLookup?.travellerId === id ? screenLookup : null;
  booth.setTerminal({ name: getTraveller(id).name, left: R.lookupsLeft(shift, id) - searching, max: R.MAX_LOOKUPS, lookup }, cursorOn);
}

const minutes = (ms) => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// The shift's six minutes, and the two that belong to whoever is at the window.
function renderClock() {
  const id = R.currentTravellerId(shift);
  const paused = shift.pending || shift.hearing || shift.speaking || shift.pleading ? ' (paused)' : '';
  const his = id ? ` · ${getTraveller(id).name.split(' ')[0]} ${minutes(R.travellerTimeLeftMs(shift))}${paused}` : '';
  $('clock').textContent = started ? `Shift ${minutes(R.timeLeftMs(shift))}${his}` : '';
}

function render() {
  const over = shift.phase === 'over';
  const playing = started && !over;
  renderActivity();
  $('report').hidden = !started || !over;
  $('report').classList.toggle('on-computer', Boolean(booth));
  $('status').hidden = !started;   // the connection badge waits for the shift
  $('shift-info').hidden = !playing;
  $('controls').hidden = !playing;
  $('look').hidden = !playing || !booth;
  $('fallback').hidden = Boolean(booth) || !playing;
  $('tools').hidden = Boolean(booth);
  $('hint').hidden = !playing;
  $('tool-tip').hidden = !playing && !(booth && !started);   // the menu's button has a tip too
  renderClock();
  if (!stampingNow) booth?.show(playing ? R.currentTravellerId(shift) : null);
  if (over) {
    booth?.putDown();
    $('captions').hidden = true;
    if (booth && !shiftReview) reviewShift();
    return renderReport();
  }
  const traveller = getTraveller(R.currentTravellerId(shift));
  const left = R.questionsLeft(shift, traveller.id);
  $('traveller-name').textContent = traveller.name;
  $('queue-position').textContent = `Traveller ${shift.current + 1} of ${shift.queue.length}`;
  $('questions-left').textContent = `Questions left: ${left} of ${R.MAX_QUESTIONS}`;
  $('lookups-left').textContent = booth ? `Lookups left: ${R.lookupsLeft(shift, traveller.id)} of ${R.MAX_LOOKUPS}` : '';
  booth?.setPapers(documentsFor(traveller), shift.cases[traveller.id].stamp, { name: traveller.name, hatColor: traveller.look?.hatColor });
  booth?.setLookedUp(shift.cases[traveller.id].lookups.map((l) => l.line));
  renderTerminal();
  booth?.setNotes(traveller.name, shift.cases[traveller.id].notes);
  if (!booth) renderFallbackPanel(traveller);
  renderCaptions(traveller);
  renderTranscript(traveller);
  const offer = R.bribeOffer(shift);
  if (!stampingNow) booth?.setBribe(offer?.item ?? null);
  $('take-bribe').hidden = !offer;
  $('talk').disabled = Boolean(shift.pending || shift.hearing) || left === 0 || R.travellerTimeLeftMs(shift) <= 0 || !micReady();
}

function frame(now) {
  if (started && shift.phase === 'playing') {
    const hadTime = R.travellerTimeLeftMs(shift) > 0;
    if (!micSetup) shift = R.tick(shift, now - lastFrame);
    if (hadTime && R.travellerTimeLeftMs(shift) <= 0) {
      hint(HINTS.outOfTime);
      render();
    } else {
      renderClock();
    }
  }
  // The terminal's cursor blinks while it searches.
  const blink = Math.floor(now / 500) % 2 === 0;
  if (screenLookup?.status === 'searching' && blink !== cursorOn) {
    cursorOn = blink;
    renderTerminal();
  }
  if (typing && typing.cps !== null) advanceTyping((now - lastFrame) / 1000);
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
  else if (event.code === 'KeyB' && !event.repeat) pocketBribe();
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
// With the 3D booth the main menu is on the terminal; the HTML card is the
// fallback for a machine without it.
if (booth) {
  $('start-screen').hidden = true;
  booth.setMenu(true);
  renderLook(booth.view());
}
render();
// Enter (or Space) on the focused button starts the shift.
if (!booth) $('start').focus();
checkLive();
requestAnimationFrame(frame);
