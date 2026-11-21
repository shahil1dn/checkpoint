// A7: three scripted questions to the real superfan, through the real server
// code and real Mistral. Every reply must parse with a listed mood, arrive with
// audio, and take under 3 s for reply plus speech. Run: npm run live-check
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../server/app.js';
import { describeError, hasApiKey, makeMistralAsker, makeMistralSpeaker } from '../server/mistral.js';
import { MOODS } from '../src/rules.js';

const QUESTIONS = [
  'Good morning. What brings you here today?',
  'If you love Mistral so much, what is the nickname of Mistral Large 4?',
  'Then why does your ticket say it was sponsored by Frontier Horizon Labs?',
];
const LIMIT_MS = 3000;

if (!hasApiKey()) {
  console.error('No MISTRAL_API_KEY in .env');
  process.exit(1);
}

// Times each Mistral call separately, so a slow round trip shows which part was slow.
function timed(fn, into) {
  return async (args) => {
    const start = performance.now();
    try {
      return await fn(args);
    } finally {
      into.push(Math.round(performance.now() - start));
    }
  };
}

const chatMs = [];
const speechMs = [];
const handle = await createApp({
  ask: timed(makeMistralAsker(), chatMs),
  speak: timed(makeMistralSpeaker(), speechMs),
  liveAvailable: true,
  log: (err) => console.error(describeError(err)),
});
const server = http.createServer(handle);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const history = [];
const rows = [];
let failed = 0;
for (const question of QUESTIONS) {
  const start = performance.now();
  const res = await fetch(`${base}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ travellerId: 'max', question, history }),
  });
  const totalMs = Math.round(performance.now() - start);
  const body = await res.json();
  const problems = [];
  if (res.status !== 200) problems.push(`status ${res.status} ${body.error ?? ''}`);
  if (res.status === 200 && !MOODS.includes(body.mood)) problems.push(`mood ${body.mood}`);
  if (res.status === 200 && !body.audio) problems.push('no audio');
  if (totalMs >= LIMIT_MS) problems.push(`slow: ${totalMs} ms`);
  if (problems.length) failed += 1;
  if (res.status === 200) history.push({ question, reply: body.reply, mood: body.mood });
  rows.push({ question, reply: body.reply, mood: body.mood, cracked: body.cracked, audioKB: body.audio ? Math.round((body.audio.length * 3) / 4 / 1024) : 0, totalMs, chatMs: chatMs.at(-1), speechMs: speechMs.at(-1), problems });
}
server.close();

const stamp = new Date().toISOString().slice(0, 16).replace(':', '');
const lines = [
  `# Live check ${new Date().toISOString()}`,
  '',
  `Result: ${failed === 0 ? 'PASS' : `FAIL (${failed} of ${rows.length})`}. Limit per round trip: ${LIMIT_MS} ms.`,
  '',
  '| # | Question | Reply | Mood | Cracked | Audio KB | Chat ms | Speech ms | Total ms | Problems |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | ${r.question} | ${r.reply ?? ''} | ${r.mood ?? ''} | ${r.cracked ?? ''} | ${r.audioKB} | ${r.chatMs ?? ''} | ${r.speechMs ?? ''} | ${r.totalMs} | ${r.problems.join('; ') || 'none'} |`),
  '',
];
await mkdir('docs/live-check', { recursive: true });
const file = `docs/live-check/${stamp}.md`;
await writeFile(file, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`Saved ${file}`);
process.exit(failed === 0 ? 0 : 1);
