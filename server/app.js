// HTTP handler: static files plus the /api routes. The Mistral calls are
// injected, so tests prove a bad request is refused before any call is made.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanTranscript, parseReply, validateAskRequest } from '../src/rules.js';
import { getTraveller, voiceFor } from '../src/travellers.js';
import { AUDIO_TYPES } from './mistral.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MAX_JSON_BYTES = 16 * 1024;
// A 15-second clip at the page's 32 kbit/s is about 60 KB; 1 MB leaves room
// for browsers that ignore the bitrate hint.
const MAX_AUDIO_BYTES = 1024 * 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// Only files that exist at startup in public/ and src/ are servable, so no
// request path can reach anything else on disk.
async function staticRoutes() {
  const routes = new Map();
  for (const [dir, prefix] of [['public', '/'], ['src', '/src/']]) {
    for (const name of await readdir(path.join(ROOT, dir))) {
      if (TYPES[path.extname(name)]) routes.set(prefix + name, path.join(ROOT, dir, name));
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

export async function createApp({ ask, hear, speak, liveAvailable, log = () => {} }) {
  const routes = await staticRoutes();

  async function handleHear(req, res) {
    const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.includes(type)) return send(res, 415, { error: 'badType' });
    const { bytes, error } = await readBody(req, MAX_AUDIO_BYTES);
    if (error) return send(res, 413, { error });
    if (bytes.length === 0) return send(res, 400, { error: 'empty' });
    if (!liveAvailable) return send(res, 503, { error: 'noKey' });
    try {
      return send(res, 200, { text: cleanTranscript(await hear({ audio: bytes, type })) });
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
    const { travellerId, history, question } = checked.value;
    const traveller = getTraveller(travellerId);
    let raw;
    try {
      raw = await ask({ traveller, history, question });
    } catch (err) {
      log(err);
      return send(res, 502, { error: 'callFailed' });
    }
    const reply = parseReply(raw);
    if (!reply) return send(res, 502, { error: 'badReply' });
    return send(res, 200, { ...reply, audio: await speakOrNull(traveller, reply) });
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
      return send(res, 200, { live: liveAvailable });
    }
    if (url.pathname === '/api/ask') {
      if (req.method !== 'POST') return send(res, 405, { error: 'method' });
      return handleAsk(req, res);
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
