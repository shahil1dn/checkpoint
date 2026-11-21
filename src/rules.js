// Checkpoint game rules. Pure: no DOM, no network, no clock reads.
// The page and the server both import this file, so a limit is enforced the
// same way in both places.
import { getTraveller, QUEUE } from './travellers/index.js';

export const MAX_QUESTION_CHARS = 300;
export const MAX_QUESTIONS = 5;
export const MAX_REPLY_CHARS = 300;
export const MOODS = ['confident', 'neutral', 'happy', 'frustrated', 'sad', 'excited'];

// Counts characters the way a player sees them, so an emoji is one character.
const charCount = (s) => [...s].length;
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function checkQuestion(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'empty' };
  const question = text.trim();
  if (question.length === 0) return { ok: false, reason: 'empty' };
  if (charCount(question) > MAX_QUESTION_CHARS) return { ok: false, reason: 'tooLong' };
  return { ok: true, question };
}

function checkPastExchange(item) {
  if (!isPlainObject(item)) return null;
  const { question, reply, mood = 'neutral', cracked = false } = item;
  if (!checkQuestion(question).ok) return null;
  if (typeof reply !== 'string' || reply.length === 0 || charCount(reply) > MAX_REPLY_CHARS) return null;
  if (!MOODS.includes(mood) || typeof cracked !== 'boolean') return null;
  return { question, reply, mood, cracked };
}

// ---- Confessions belong to the code (C3) ----

export const CONFESS_FROM_QUESTION = 3;
export const FALLBACK_LINE = 'Sorry, could you say that again?';
export const hasConfessed = (history) => history.some((exchange) => exchange.cracked);

// An honest traveller has nothing to confess, so his `cracked` is ignored.
// A liar's confession before question 3 is refused, so one lucky push can't
// end the interrogation.
export function judgeReply(traveller, questionNumber, reply) {
  if (traveller.truth.honest) return { ok: true, reply: { ...reply, cracked: false } };
  if (reply.cracked && questionNumber < CONFESS_FROM_QUESTION) return { ok: false, reason: 'earlyConfession' };
  return { ok: true, reply };
}

// The server runs this on every /api/ask body before any Mistral call.
export function validateAskRequest(body) {
  if (!isPlainObject(body)) return { ok: false, reason: 'badBody' };
  if (typeof body.travellerId !== 'string' || !getTraveller(body.travellerId)) {
    return { ok: false, reason: 'unknownTraveller' };
  }
  const checked = checkQuestion(body.question);
  if (!checked.ok) return checked;
  if (!Array.isArray(body.history)) return { ok: false, reason: 'badHistory' };
  if (body.history.length >= MAX_QUESTIONS) return { ok: false, reason: 'outOfQuestions' };
  const history = body.history.map(checkPastExchange);
  if (history.includes(null)) return { ok: false, reason: 'badHistory' };
  const notes = body.notes ?? [];
  if (!checkEarlierNotes(notes)) return { ok: false, reason: 'badNotes' };
  return { ok: true, value: { travellerId: body.travellerId, question: checked.question, history, notes } };
}

// The notes already on the scratchpad, sent back so the note-taker doesn't
// repeat itself. Same limits as when they were first written.
function checkEarlierNotes(notes) {
  return Array.isArray(notes)
    && notes.length <= MAX_QUESTIONS * MAX_NOTES_PER_ANSWER
    && notes.every((n) => typeof n === 'string' && n.length > 0 && charCount(n) <= MAX_NOTE_CHARS);
}

// A transcript becomes the next question, so it obeys the question limit.
// Underscores are how Voxtral joins words from a hint list.
export function cleanTranscript(text) {
  if (typeof text !== 'string') return '';
  return [...text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, MAX_QUESTION_CHARS).join('').trim();
}

// ---- The scratchpad (ADR-8) ----
// Notes are observations, never verdicts: the player still has to decide.

export const MAX_NOTES_PER_ANSWER = 2;
export const MAX_NOTE_CHARS = 120;
// The spec's list, plus the forms of those words a note would actually use.
const VERDICT = /\b(lie|lies|lied|liar|liars|lying|truth\w*|untruth\w*|honest\w*|dishonest\w*|suspicious\w*|suspicion\w*|suspect\w*|guilt\w*|innocen\w*)\b|[✓✔✗✘]/i;
export const hasVerdictWord = (text) => VERDICT.test(text);

// A "Says X; papers say Y" note would mislead the player if it isn't a real
// clash. Measured live, the model writes two kinds even when told not to:
// the same fact as a clash ("Says Stilton; papers say Colin Stilton") and a
// papers line that doesn't exist ("papers say 'Mistral Large'").
const TWO_SIDED = /^says\s+(.+?);\s*papers say\s+(.+)$/i;
const plain = (s) => s.toLowerCase().replace(/['"‘’“”.,:;]/g, '').replace(/\s+/g, ' ').trim();
function isFalseClash(text, papers) {
  const match = TWO_SIDED.exec(text);
  if (!match) return false;
  const [said, onPapers] = [plain(match[1]), plain(match[2])];
  if (said.includes(onPapers) || onPapers.includes(said)) return true;
  if (!papers) return false;
  const paperLines = Object.entries(papers).map(([label, value]) => plain(`${label} ${value}`));
  return !paperLines.some((line) => line.includes(onPapers));
}

// Returns the notes to show, how many broke the rules (refused) and how many
// were dropped as a false clash. A dropped note is simply not shown.
// With `papers`, a note's "papers say" side must quote the papers.
export function checkNotes(raw, papers = null) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kept: [], refused: 0, falseClash: 0 };
  }
  const candidates = (Array.isArray(data?.notes) ? data.notes : [])
    .map((note) => (typeof note === 'string' ? note.replace(/\s+/g, ' ').trim() : ''))
    .filter((text) => text !== '');
  const allowed = candidates.filter((text, i) => i < MAX_NOTES_PER_ANSWER && charCount(text) <= MAX_NOTE_CHARS && !VERDICT.test(text));
  const kept = allowed.filter((text) => !isFalseClash(text, papers));
  return { kept, refused: candidates.length - allowed.length, falseClash: allowed.length - kept.length };
}

// ---- The shift ----
// Each function takes a shift and returns a new one, so the page can't
// half-apply a rule.

// Each traveller has his own two minutes, so a three-traveller shift is six.
// usedMs counts along the whole shift, and traveller n owns the slice from
// n × TRAVELLER_MS to (n + 1) × TRAVELLER_MS. Stamping early skips the rest of
// his slice, so nobody's spare time is handed on and nobody's overrun eats the next.
export const TRAVELLER_MS = 2 * 60 * 1000;
export const DEMO_QUEUE = QUEUE;   // shift order: src/travellers/index.js
export const VERDICTS = ['through', 'away'];

export function newShift(queue = DEMO_QUEUE, { firstRequestId = 1 } = {}) {
  return {
    phase: 'playing',
    endReason: null,
    queue: [...queue],
    current: 0,
    usedMs: 0,
    pending: null,
    lookup: null,
    hearing: false,
    speaking: false,
    pleading: false,
    paused: false,
    nextRequestId: firstRequestId,
    // bribe: null until he makes his offer, then 'offered', 'taken' or 'refused'.
    cases: Object.fromEntries(queue.map((id) => [id, { history: [], notes: [], lookups: [], stamp: null, bribe: null }])),
  };
}

// Play again. Request ids keep counting so a reply still in flight from the
// old shift can never land in the new one.
export const restartShift = (shift) => newShift(shift.queue, { firstRequestId: shift.nextRequestId });

export const currentTravellerId = (shift) => (shift.phase === 'playing' ? shift.queue[shift.current] : null);
export const questionsLeft = (shift, id) => MAX_QUESTIONS - shift.cases[id].history.length;
const sliceStart = (shift) => shift.current * TRAVELLER_MS;
const sliceUsedMs = (shift) => Math.max(shift.usedMs, sliceStart(shift));
// What the shift clock shows: his time left plus two minutes for everyone after him.
export const timeLeftMs = (shift) => Math.max(0, shift.queue.length * TRAVELLER_MS - sliceUsedMs(shift));
export const travellerTimeLeftMs = (shift) => (shift.phase === 'playing' ? sliceStart(shift) + TRAVELLER_MS - sliceUsedMs(shift) : 0);

// Returns { shift, request } to send to the server, or { shift, error }.
export function startQuestion(shift, text) {
  if (shift.phase !== 'playing') return { shift, error: 'shiftOver' };
  if (shift.pending) return { shift, error: 'pending' };
  if (bribeOffer(shift)) return { shift, error: 'bribeOnTable' };
  const checked = checkQuestion(text);
  if (!checked.ok) return { shift, error: checked.reason };
  const travellerId = currentTravellerId(shift);
  if (questionsLeft(shift, travellerId) <= 0) return { shift, error: 'outOfQuestions' };
  if (travellerTimeLeftMs(shift) <= 0) return { shift, error: 'outOfTime' };
  const pending = { id: shift.nextRequestId, travellerId, question: checked.question };
  const record = shift.cases[travellerId];
  const request = { ...pending, history: record.history.map(({ question, reply, mood, cracked }) => ({ question, reply, mood, cracked })), notes: record.notes };
  return { shift: { ...shift, pending, nextRequestId: shift.nextRequestId + 1 }, request };
}

// reply is a parsed reply, or null when the call failed. A failed question
// isn't counted, so a bad connection never costs the player a question.
export function finishQuestion(shift, requestId, reply) {
  if (!shift.pending || shift.pending.id !== requestId) return shift;
  const { travellerId, question } = shift.pending;
  if (!reply) return { ...shift, pending: null };
  const exchange = { question, reply: reply.reply, mood: reply.mood, cracked: reply.cracked };
  const record = shift.cases[travellerId];
  const notes = [...record.notes, ...(reply.notes ?? []).slice(0, MAX_NOTES_PER_ANSWER)];
  return {
    ...shift,
    pending: null,
    cases: { ...shift.cases, [travellerId]: { ...record, history: [...record.history, exchange], notes } },
  };
}

// ---- The records terminal (ADR-12) ----
// The inspector clicks a line he has gathered and the terminal looks it up.
// No free typing, and 3 lookups a traveller: spending them is his strategy.

export const MAX_LOOKUPS = 3;
export const MAX_REPORT_LINES = 4;
export const MAX_REPORT_LINE_CHARS = 220;
const sameLine = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

export const lookupsLeft = (shift, id) => MAX_LOOKUPS - shift.cases[id].lookups.length;

// Returns { shift, request } to send to the server, or { shift, error }.
export function startLookup(shift, text) {
  if (shift.phase !== 'playing') return { shift, error: 'shiftOver' };
  if (shift.lookup) return { shift, error: 'lookupPending' };
  const line = sameLine(text);
  if (!line) return { shift, error: 'empty' };
  const travellerId = currentTravellerId(shift);
  const done = shift.cases[travellerId].lookups.map((l) => l.line);
  if (done.length >= MAX_LOOKUPS) return { shift, error: 'outOfLookups' };
  if (done.includes(line)) return { shift, error: 'alreadyLookedUp' };
  const lookup = { id: shift.nextRequestId, travellerId, line };
  return { shift: { ...shift, lookup, nextRequestId: shift.nextRequestId + 1 }, request: { ...lookup, earlier: done } };
}

// result is { steps, answer } or null when the lookup failed. A failed lookup
// isn't counted. A result that lands after a stamp still goes on the case it
// was asked about.
export function finishLookup(shift, requestId, result) {
  if (!shift.lookup || shift.lookup.id !== requestId) return shift;
  const { travellerId, line } = shift.lookup;
  if (!result) return { ...shift, lookup: null };
  const record = shift.cases[travellerId];
  const done = { line, steps: result.steps ?? [], answer: result.answer ?? [] };
  return { ...shift, lookup: null, cases: { ...shift.cases, [travellerId]: { ...record, lookups: [...record.lookups, done] } } };
}

// The server runs this on every /api/lookup body before anything else.
export function validateLookupRequest(body) {
  if (!isPlainObject(body)) return { ok: false, reason: 'badBody' };
  if (typeof body.travellerId !== 'string' || !getTraveller(body.travellerId)) return { ok: false, reason: 'unknownTraveller' };
  const line = sameLine(body.line);
  if (!line) return { ok: false, reason: 'empty' };
  if (charCount(line) > MAX_QUESTION_CHARS) return { ok: false, reason: 'tooLong' };
  const earlier = body.earlier ?? [];
  if (!Array.isArray(earlier) || !earlier.every((l) => typeof l === 'string')) return { ok: false, reason: 'badEarlier' };
  if (earlier.length >= MAX_LOOKUPS) return { ok: false, reason: 'outOfLookups' };
  if (earlier.map(sameLine).includes(line)) return { ok: false, reason: 'alreadyLookedUp' };
  return { ok: true, value: { travellerId: body.travellerId, line, earlier } };
}

// Where a line came from: the kind of document it's on ('passport', 'visa',
// 'ticket' or 'papers'), or 'said' for his own answers, or null when the
// inspector never gathered it. His own questions don't count, or a typed
// question would be free typing by the back door.
export function gatheredFrom(text, { documents = [], said = [] }) {
  const line = sameLine(text);
  for (const doc of documents) {
    const lines = Object.entries(doc.fields ?? {}).map(([label, value]) => sameLine(`${label}: ${value}`));
    if (lines.includes(line)) return doc.kind;
  }
  if (said.map(sameLine).includes(line)) return 'said';
  return null;
}

// The terminal's report is untrusted: markdown and list marks go, and any
// line with a verdict word is refused, because the inspector decides.
export function checkLookupAnswer(raw) {
  const candidates = String(raw ?? '').split('\n')
    .map((line) => line.replace(/[*_`#~]/g, '').replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const allowed = candidates.filter((line) => !hasVerdictWord(line));
  const cut = (line) => ([...line].length > MAX_REPORT_LINE_CHARS ? `${[...line].slice(0, MAX_REPORT_LINE_CHARS - 1).join('').trimEnd()}…` : line);
  const lines = allowed.slice(0, MAX_REPORT_LINES).map(cut);
  return { lines, refused: candidates.length - allowed.length };
}

// ---- Bribes (Shahil 14:34) ----
// A bribe is a last-ditch offer, never part of the questioning: the first
// TURNED AWAY on a traveller doesn't land, and he offers what his own file
// says instead. The game decides when, not the model. Whether the inspector
// took it is the game's fact too, kept like the truth (ADR-2), and it never
// changes whether a stamp was right.

// What can sit on the window ledge, and the words the hints use for it.
// public/booth.js draws each one: a new item needs a drawing there too.
export const BRIBE_ITEMS = { cheese: 'wedge of cheese', sticker: 'sticker', card: 'business card' };

// The offer on the ledge, until the inspector takes it or stamps.
export function bribeOffer(shift) {
  const travellerId = currentTravellerId(shift);
  if (!travellerId || shift.cases[travellerId].bribe !== 'offered') return null;
  return { travellerId, ...getTraveller(travellerId).bribe };
}

// True when this stamp would bring out his offer instead of landing. A
// traveller without a bribe in his file has nothing to offer (Shahil 16:05).
export function pleadsFirst(shift, verdict) {
  const travellerId = currentTravellerId(shift);
  return verdict === 'away' && travellerId !== null && shift.cases[travellerId].bribe === null && Boolean(getTraveller(travellerId).bribe);
}

// Like a stamp, the offer drops a question still out. The clock waits while
// he says it, until the page calls setPleading(shift, false).
function makeOffer(shift) {
  const travellerId = currentTravellerId(shift);
  const cases = { ...shift.cases, [travellerId]: { ...shift.cases[travellerId], bribe: 'offered' } };
  const offered = { ...shift, cases, pending: null, pleading: true };
  return { shift: offered, offer: bribeOffer(offered) };
}

// Pocketing it lets him through: the stamp is THROUGH, and the record shows it.
export function takeBribe(shift) {
  if (!bribeOffer(shift)) return { shift, error: 'noBribe' };
  return landStamp(shift, 'through', 'taken');
}

export const setPleading = (shift, pleading) => ({ ...shift, pleading });

// Speech-to-text is a Mistral call too, so the clock waits for it as well.
export const setHearing = (shift, hearing) => ({ ...shift, hearing });
// And for his answer being played aloud, so a long answer never costs time.
export const setSpeaking = (shift, speaking) => ({ ...shift, speaking });

// The pause menu: the player stopped the game, so both clocks stand still.
export const setPaused = (shift, paused) => (shift.phase === 'playing' ? { ...shift, paused: Boolean(paused) } : shift);

// The clock stands still while a question is out, so a slow connection
// never costs the player time. When his two minutes are up the clock stops
// and the shift waits for a stamp: the questions are over, not the shift.
export function tick(shift, dtMs) {
  if (shift.phase !== 'playing' || shift.paused || shift.pending || shift.hearing || shift.speaking || shift.pleading || !(dtMs > 0)) return shift;
  const usedMs = Math.min(sliceStart(shift) + TRAVELLER_MS, sliceUsedMs(shift) + dtMs);
  return { ...shift, usedMs };
}

// Allowed at any time, even mid-question: the pending reply is dropped.
// The first TURNED AWAY on each traveller with a bribe returns { shift, offer }
// instead: he pleads, and the stamp hasn't landed.
export function stamp(shift, verdict) {
  if (shift.phase !== 'playing') return { shift, error: 'shiftOver' };
  if (!VERDICTS.includes(verdict)) return { shift, error: 'badVerdict' };
  if (pleadsFirst(shift, verdict)) return makeOffer(shift);
  const { bribe } = shift.cases[currentTravellerId(shift)];
  return landStamp(shift, verdict, bribe === 'offered' ? 'refused' : bribe);
}

function landStamp(shift, verdict, bribe) {
  const travellerId = currentTravellerId(shift);
  const cases = { ...shift.cases, [travellerId]: { ...shift.cases[travellerId], stamp: verdict, bribe } };
  const current = shift.current + 1;
  const over = current >= shift.queue.length;
  return {
    shift: { ...shift, cases, current, pending: null, pleading: false, phase: over ? 'over' : 'playing', endReason: over ? 'queueEmpty' : null },
  };
}

// Scored only from the truth stored in src/travellers/ (ADR-2): nothing the
// model said during the shift is read here.
export function shiftReport(shift) {
  const rows = shift.queue.map((id) => {
    const traveller = getTraveller(id);
    const { stamp: verdict, bribe } = shift.cases[id];
    const honest = traveller.truth.honest;
    return { id, name: traveller.name, stamp: verdict, honest, secret: traveller.truth.secret, correct: verdict !== null && (verdict === 'through') === honest, bribeTaken: bribe === 'taken' };
  });
  const bribesTaken = rows.filter((r) => r.bribeTaken).length;
  return { rows, correct: rows.filter((r) => r.correct).length, total: rows.length, bribesTaken, record: bribesTaken > 0 ? 'corrupt' : 'clean' };
}

// Markdown would be read aloud as symbols, so it goes before the length cut.
export function cleanReplyText(text) {
  const plain = text.replace(/[*_`#~]/g, '').replace(/\s+/g, ' ').trim();
  return [...plain].slice(0, MAX_REPLY_CHARS).join('').trim();
}

// The model's reply is untrusted: anything off-schema is repaired or refused.
// Returns null when there is nothing usable to show.
export function parseReply(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(data) || typeof data.reply !== 'string') return null;
  const reply = cleanReplyText(data.reply);
  if (reply.length === 0) return null;
  return {
    reply,
    mood: MOODS.includes(data.mood) ? data.mood : 'neutral',
    cracked: data.cracked === true,
  };
}
