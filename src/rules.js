// Checkpoint game rules. Pure: no DOM, no network, no clock reads.
// The page and the server both import this file, so a limit is enforced the
// same way in both places.
import { getTraveller } from './travellers.js';

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
  return { ok: true, value: { travellerId: body.travellerId, question: checked.question, history } };
}

// A transcript becomes the next question, so it obeys the question limit.
// Underscores are how Voxtral joins words from a hint list.
export function cleanTranscript(text) {
  if (typeof text !== 'string') return '';
  return [...text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, MAX_QUESTION_CHARS).join('').trim();
}

// ---- The shift ----
// Each function takes a shift and returns a new one, so the page can't
// half-apply a rule.

export const SHIFT_MS = 2 * 60 * 1000;
export const DEMO_QUEUE = ['max', 'colin'];
export const VERDICTS = ['through', 'away'];

export function newShift(queue = DEMO_QUEUE, { firstRequestId = 1 } = {}) {
  return {
    phase: 'playing',
    endReason: null,
    queue: [...queue],
    current: 0,
    usedMs: 0,
    pending: null,
    hearing: false,
    nextRequestId: firstRequestId,
    cases: Object.fromEntries(queue.map((id) => [id, { history: [], stamp: null }])),
  };
}

// Play again. Request ids keep counting so a reply still in flight from the
// old shift can never land in the new one.
export const restartShift = (shift) => newShift(shift.queue, { firstRequestId: shift.nextRequestId });

export const currentTravellerId = (shift) => (shift.phase === 'playing' ? shift.queue[shift.current] : null);
export const questionsLeft = (shift, id) => MAX_QUESTIONS - shift.cases[id].history.length;
export const timeLeftMs = (shift) => SHIFT_MS - shift.usedMs;

// Returns { shift, request } to send to the server, or { shift, error }.
export function startQuestion(shift, text) {
  if (shift.phase !== 'playing') return { shift, error: 'shiftOver' };
  if (shift.pending) return { shift, error: 'pending' };
  const checked = checkQuestion(text);
  if (!checked.ok) return { shift, error: checked.reason };
  const travellerId = currentTravellerId(shift);
  if (questionsLeft(shift, travellerId) <= 0) return { shift, error: 'outOfQuestions' };
  const pending = { id: shift.nextRequestId, travellerId, question: checked.question };
  const request = { ...pending, history: shift.cases[travellerId].history.map(({ question, reply, mood, cracked }) => ({ question, reply, mood, cracked })) };
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
  return {
    ...shift,
    pending: null,
    cases: { ...shift.cases, [travellerId]: { ...record, history: [...record.history, exchange] } },
  };
}

// Speech-to-text is a Mistral call too, so the clock waits for it as well.
export const setHearing = (shift, hearing) => ({ ...shift, hearing });

// The clock stands still while a question is out, so a slow connection
// never costs the player time.
export function tick(shift, dtMs) {
  if (shift.phase !== 'playing' || shift.pending || shift.hearing || !(dtMs > 0)) return shift;
  const usedMs = Math.min(SHIFT_MS, shift.usedMs + dtMs);
  if (usedMs < SHIFT_MS) return { ...shift, usedMs };
  return { ...shift, usedMs, phase: 'over', endReason: 'time' };
}

// Allowed at any time, even mid-question: the pending reply is dropped.
export function stamp(shift, verdict) {
  if (shift.phase !== 'playing') return { shift, error: 'shiftOver' };
  if (!VERDICTS.includes(verdict)) return { shift, error: 'badVerdict' };
  const travellerId = currentTravellerId(shift);
  const cases = { ...shift.cases, [travellerId]: { ...shift.cases[travellerId], stamp: verdict } };
  const current = shift.current + 1;
  const over = current >= shift.queue.length;
  return {
    shift: { ...shift, cases, current, pending: null, phase: over ? 'over' : 'playing', endReason: over ? 'queueEmpty' : null },
  };
}

// Scored only from the truth stored in travellers.js (ADR-2): nothing the
// model said during the shift is read here.
export function shiftReport(shift) {
  const rows = shift.queue.map((id) => {
    const traveller = getTraveller(id);
    const { stamp: verdict } = shift.cases[id];
    const honest = traveller.truth.honest;
    return { id, name: traveller.name, stamp: verdict, honest, secret: traveller.truth.secret, correct: verdict !== null && (verdict === 'through') === honest };
  });
  return { rows, correct: rows.filter((r) => r.correct).length, total: rows.length };
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
