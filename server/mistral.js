// The only file that reads the Mistral key. Plain fetch, no SDK (ADR-5).
// fetchImpl is injectable so tests can check what is sent without the network.
import { NOTES_FORMAT, REPLY_FORMAT, buildMessages, buildNoteMessages } from './prompt.js';

const API = 'https://api.mistral.ai/v1';
const TIMEOUT_MS = 20_000;
export const CHAT_MODEL = 'mistral-medium-3.5';
export const CHAT_MAX_TOKENS = 400;

export function hasApiKey() {
  return typeof process.env.MISTRAL_API_KEY === 'string' && process.env.MISTRAL_API_KEY.length > 0;
}

// Carries only where it failed and the HTTP status: never headers or bodies,
// so logging it can't leak the key, a transcript or a reply.
export class MistralError extends Error {
  constructor(path, status) {
    super(`Mistral ${path} failed with HTTP ${status}`);
    this.name = 'MistralError';
    this.status = status;
  }
}

async function postToMistral(path, { body, contentType }, fetchImpl) {
  const headers = { authorization: `Bearer ${process.env.MISTRAL_API_KEY}` };
  if (contentType) headers['content-type'] = contentType;
  const res = await fetchImpl(API + path, { method: 'POST', headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    await res.body?.cancel();
    throw new MistralError(path, res.status);
  }
  return res.json();
}

// Large models send a list of parts (thinking, then text); only text counts.
function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((part) => part?.type === 'text').map((part) => part.text ?? '').join('');
}

// One JSON-schema chat call. Returns the model's raw text, still untrusted.
export function makeMistralJsonChat({ fetchImpl = fetch } = {}) {
  return async function chatJson({ messages, format, maxTokens = CHAT_MAX_TOKENS }) {
    const data = await postToMistral('/chat/completions', {
      contentType: 'application/json',
      body: JSON.stringify({ model: CHAT_MODEL, max_tokens: maxTokens, response_format: format, messages }),
    }, fetchImpl);
    return textOf(data?.choices?.[0]?.message?.content);
  };
}

// The traveller's reply to one question.
export function makeMistralAsker({ fetchImpl = fetch } = {}) {
  const chatJson = makeMistralJsonChat({ fetchImpl });
  return ({ traveller, history, question, nudge }) =>
    chatJson({ messages: buildMessages(traveller, history, question, { nudge }), format: REPLY_FORMAT });
}

// The scratchpad's notes on the latest answer. Takes only what the player sees.
export function makeMistralNoteTaker({ fetchImpl = fetch } = {}) {
  const chatJson = makeMistralJsonChat({ fetchImpl });
  return ({ papers, exchanges, earlierNotes }) =>
    chatJson({ messages: buildNoteMessages({ papers, exchanges, earlierNotes }), format: NOTES_FORMAT, maxTokens: 200 });
}

export const HEAR_MODEL = 'voxtral-mini-latest';
const FILE_EXTENSIONS = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };
export const AUDIO_TYPES = Object.keys(FILE_EXTENSIONS);

// Turns one recorded clip into words. The clip stays in memory only.
export function makeMistralHearer({ hints = [], fetchImpl = fetch } = {}) {
  return async function hear({ audio, type }) {
    const form = new FormData();
    form.append('model', HEAR_MODEL);
    form.append('language', 'en');
    for (const word of hints) form.append('context_bias', word);
    form.append('file', new Blob([audio], { type }), `question.${FILE_EXTENSIONS[type]}`);
    const data = await postToMistral('/audio/transcriptions', { body: form }, fetchImpl);
    return typeof data?.text === 'string' ? data.text : '';
  };
}

export const SPEAK_MODEL = 'voxtral-mini-tts-3';

// Returns base64 mp3. Only this model takes the preset voices (checked 21 Nov).
export function makeMistralSpeaker({ fetchImpl = fetch } = {}) {
  return async function speak({ text, voiceId }) {
    const data = await postToMistral('/audio/speech', {
      contentType: 'application/json',
      body: JSON.stringify({ model: SPEAK_MODEL, input: text, voice_id: voiceId, response_format: 'mp3' }),
    }, fetchImpl);
    if (typeof data?.audio_data !== 'string' || data.audio_data.length === 0) throw new MistralError('/audio/speech', 'no audio');
    return data.audio_data;
  };
}

// Safe to log: the error's kind and status only.
export function describeError(error) {
  if (error instanceof MistralError) return error.message;
  return error?.name ?? 'Error';
}
