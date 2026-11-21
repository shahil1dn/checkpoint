// HTTP handler: static files plus the /api routes. The Mistral calls are
// injected, so tests prove a bad request is refused before any call is made.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_LINE, checkNotes, cleanTranscript, judgeReply, parseReply, validateAskRequest } from '../src/rules.js';
import { getTraveller, voiceFor } from '../src/travellers/index.js';
import { AUDIO_TYPES } from './mistral.js';
import { EARLY_CONFESSION_NUDGE } from './prompt.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_JSON_BYTES = 16 * 1024;
// A 15-second clip at the page's 32 kbit/s is about 60 KB; 1 MB leaves room
// for browsers that ignore the bitrate hint.
const MAX_AUDIO_BYTES = 1024 * 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// Only files that exist at startup are servable, listed once here, so no
// request path can reach anything else on disk. three.js is served from its
// browser builds and addons only, for the page's import map (ADR-7).
const STATIC_DIRS = [
  ['public', '/', Object.keys(TYPES)],
  ['src', '/src/', Object.keys(TYPES)],
  ['node_modules/three/build', '/vendor/three/build/', ['.js']],
  ['node_modules/three/examples/jsm', '/vendor/three/addons/', ['.js']],
];

async function staticRoutes() {
  const routes = new Map();
  for (const [dir, prefix, extensions] of STATIC_DIRS) {
    for (const name of await readdir(path.join(ROOT, dir), { recursive: true })) {
      if (extensions.includes(path.extname(name))) routes.set(prefix + name.split(path.sep).join('/'), path.join(ROOT, dir, name));
    }
  }
  routes.set('/', path.join(ROOT, 'public', 'index.html'));
  return routes;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) return { error: 'tooBig' };
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks) };
}

async function readJsonBody(req) {
  const { bytes, error } = await readBody(req, MAX_JSON_BYTES);
  if (error) return { error };
  try {
    return { body: JSON.parse(bytes.toString('utf8')) };
  } catch {
    return { error: 'badJson' };
  }
}

// How long a call took, in whole milliseconds, for the inspector's computer screen.
async function timed(call) {
  const started = performance.now();
  const value = await call();
  return { value, ms: Math.round(performance.now() - started) };
}

// models: which Mistral model does each job, shown by name on the computer screen.
export async function createApp({ ask, hear, speak, takeNotes, liveAvailable, models, log = () => {} }) {
  const routes = await staticRoutes();

  async function handleHear(req, res) {
    const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.includes(type)) return send(res, 415, { error: 'badType' });
    const { bytes, error } = await readBody(req, MAX_AUDIO_BYTES);
    if (error) return send(res, 413, { error });
    if (bytes.length === 0) return send(res, 400, { error: 'empty' });
    if (!liveAvailable) return send(res, 503, { error: 'noKey' });
    try {
      const heard = await timed(() => hear({ audio: bytes, type }));
      return send(res, 200, { text: cleanTranscript(heard.value), ms: heard.ms });
    } catch (err) {
      log(err);
      return send(res, 502, { error: 'callFailed' });
    }
  }

  async function handleAsk(req, res) {
    const { body, error } = await readJsonBody(req);
    if (error) return send(res, 400, { error });
    const checked = validateAskRequest(body);
    if (!checked.ok) return send(res, 400, { error: checked.reason });
    if (!liveAvailable) return send(res, 503, { error: 'noKey' });
    const { travellerId, history, question, notes: earlierNotes } = checked.value;
    const traveller = getTraveller(travellerId);
    let reply;
    let answerMs;
    try {
      ({ value: reply, ms: answerMs } = await timed(() => askUntilAcceptable(traveller, history, question)));
    } catch (err) {
      log(err);
      return send(res, 502, { error: 'callFailed' });
    }
    // Notes are taken while the voice is made, so they add no wait.
    const exchanges = [...history, { question, reply: reply.reply, mood: reply.mood }];
    const [speech, noted] = await Promise.all([
      timed(() => speakOrNull(traveller, reply)),
      timed(async () => (reply.fallback ? [] : notesOrNone(traveller.papers, exchanges, earlierNotes))),
    ]);
    const timings = { answerMs, speechMs: speech.ms, notesMs: noted.ms };
    return send(res, 200, { ...reply, audio: speech.value, notes: noted.value, timings });
  }

  // Only the papers, the conversation and the notes the player already has go
  // to the note-taker (ADR-8). A failed or refused note is dropped; the answer
  // still arrives.
  async function notesOrNone(papers, exchanges, earlierNotes) {
    if (!takeNotes) return [];
    try {
      const seen = new Set(earlierNotes.map((n) => n.toLowerCase()));
      const { kept } = checkNotes(await takeNotes({ papers, exchanges, earlierNotes }), papers);
      return kept.filter((n) => !seen.has(n.toLowerCase()));
    } catch (err) {
      log(err);
      return [];
    }
  }

  // C5: a broken or refused reply gets one retry. After that the traveller
  // asks the inspector to repeat himself, which the page doesn't count as a
  // question, so a bad turn never looks like silence or costs anything.
  async function askUntilAcceptable(traveller, history, question) {
    const questionNumber = history.length + 1;
    let nudge;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parsed = parseReply(await ask({ traveller, history, question, nudge }));
      const judged = parsed ? judgeReply(traveller, questionNumber, parsed) : { ok: false, reason: 'badReply' };
      if (judged.ok) return judged.reply;
      nudge = judged.reason === 'earlyConfession' ? EARLY_CONFESSION_NUDGE : undefined;
    }
    return { reply: FALLBACK_LINE, mood: 'neutral', cracked: false, fallback: true };
  }

  // The last-ditch bribe (Shahil 14:34). Its words come from the traveller's
  // file, never the request, so this can't be used to make anyone say
  // anything. The voice is made once per traveller and kept; a failed one is
  // not kept, so the next plea tries again.
  const pleas = new Map();
  async function handlePlea(url, res) {
    const traveller = getTraveller(url.searchParams.get('travellerId') ?? '');
    if (!traveller) return send(res, 400, { error: 'unknownTraveller' });
    if (!liveAvailable) return send(res, 503, { error: 'noKey' });
    if (!pleas.has(traveller.id)) {
      const { line, mood } = traveller.bribe;
      pleas.set(traveller.id, timed(() => speakOrNull(traveller, { reply: line, mood })));
    }
    const { value: audio, ms: speechMs } = await pleas.get(traveller.id);
    if (!audio) pleas.delete(traveller.id);
    return send(res, 200, { audio, speechMs });
  }

  // A reply that can't be voiced is still shown, so speech failing never
  // costs the player the answer.
  async function speakOrNull(traveller, reply) {
    try {
      return await speak({ text: reply.reply, voiceId: voiceFor(traveller, reply.mood) });
    } catch (err) {
      log(err);
      return null;
    }
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/health' && req.method === 'GET') {
      return send(res, 200, liveAvailable && models ? { live: true, models } : { live: liveAvailable });
    }
    if (url.pathname === '/api/ask') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method' });
      return handleAsk(req, res);
    }
    if (url.pathname === '/api/plea') {
      if (req.method !== 'GET') return send(res, 405, { error: 'method' });
      return handlePlea(url, res);
    }
    if (url.pathname === '/api/hear') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method' });
      return handleHear(req, res);
    }

    const file = req.method === 'GET' ? routes.get(url.pathname) : undefined;
    if (!file) return send(res, 404, { error: 'notFound' });
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)], 'cache-control': 'no-store' });
    res.end(await readFile(file));
  };
}
