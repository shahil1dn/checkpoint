// The only file that reads the Mistral key. Plain fetch, no SDK (ADR-5).
// fetchImpl is injectable so tests can check what is sent without the network.
import { REPLY_FORMAT, buildMessages } from './prompt.js';

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

// Returns the model's raw reply text, still untrusted.
export function makeMistralAsker({ fetchImpl = fetch } = {}) {
  return async function ask({ traveller, history, question }) {
    const data = await postToMistral('/chat/completions', {
      contentType: 'application/json',
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        response_format: REPLY_FORMAT,
        messages: buildMessages(traveller, history, question),
      }),
    }, fetchImpl);
    return textOf(data?.choices?.[0]?.message?.content);
  };
}

// Safe to log: the error's kind and status only.
export function describeError(error) {
  if (error instanceof MistralError) return error.message;
  return error?.name ?? 'Error';
}
