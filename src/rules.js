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
  const { question, reply, mood = 'neutral' } = item;
  if (!checkQuestion(question).ok) return null;
  if (typeof reply !== 'string' || reply.length === 0 || charCount(reply) > MAX_REPLY_CHARS) return null;
  if (!MOODS.includes(mood)) return null;
  return { question, reply, mood };
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
