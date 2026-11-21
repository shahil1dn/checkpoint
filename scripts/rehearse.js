// A9: a timed run of the demo shift in real Chrome, voice in and out.
// Each question is spoken by the Mac's voice into the page's own recorder
// (standing in for the microphone), Space is held with real key presses,
// every reply plays to the end, then the traveller is stamped. Saves a frame
// a second as the recording. Needs `npm start` running. Run: npm run rehearse
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const LIMIT_S = 120;
const OUT = 'docs/proof/s6-rehearsal';

// The demo script: what the inspector says, and the stamp at the end.
const DEMO = [
  { traveller: 'Max Tokens', questions: [
    'Good evening. What brings you to the checkpoint?',
    'If you love Mistral so much, what is the nickname of Mistral Large 4?',
    'Then why did Frontier Horizon Labs pay for your ticket?',
  ], stamp: 'away' },
  { traveller: 'Colin Stilton', questions: [
    'Forty kilos of blue cheese? Who is all that for?',
  ], stamp: 'through' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Synthetic test speech; written to a temp folder and deleted at the end.
async function speakToMp3(dir, text, i) {
  const aiff = path.join(dir, `${i}.aiff`);
  const mp3 = path.join(dir, `${i}.mp3`);
  execFileSync('say', ['-v', 'Samantha', '-o', aiff, text]);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', aiff, '-ac', '1', '-b:a', '48k', mp3]);
  return (await readFile(mp3)).toString('base64');
}

// Minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
async function connect() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return openSocket(page.webSocketDebuggerUrl);
    } catch { /* Chrome still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

function openSocket(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const waiting = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return new Promise((resolve) => { ws.onopen = () => resolve({ send, close: () => ws.close() }); });
}

async function main() {
  const work = await mkdtemp(path.join(tmpdir(), 'checkpoint-rehearsal-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(work, 'profile')}`,
    '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
    '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    const clips = [];
    let n = 0;
    for (const step of DEMO) for (const q of step.questions) clips.push(await speakToMp3(work, q, n++));

    const cdp = await connect();
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: APP });
    await sleep(1500);

    // Stand-in microphone plus a play spy, so we know when a reply finishes.
    await evaluate(`(() => {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      navigator.mediaDevices.getUserMedia = async () => dest.stream;
      window.__say = async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const buffer = await ctx.decodeAudioData(bytes.buffer);
        const src = ctx.createBufferSource();
        src.buffer = buffer; src.connect(dest); src.start();
        await new Promise((r) => setTimeout(r, buffer.duration * 1000 + 250));
      };
      window.__voices = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__voices.push(this); return play.call(this); };
      const timer = document.createElement('div');
      timer.style.cssText = 'position:fixed;top:8px;right:8px;background:#000;color:#fff;font:20px monospace;padding:4px 8px;z-index:9';
      document.body.append(timer);
      window.__startTimer = () => { const t0 = performance.now(); setInterval(() => { timer.textContent = 'rehearsal ' + ((performance.now() - t0) / 1000).toFixed(0) + ' s'; }, 200); };
      return true;
    })()`);

    await mkdir(OUT, { recursive: true });
    const frames = [];
    const log = [];
    const t0 = performance.now();
    const at = () => ((performance.now() - t0) / 1000).toFixed(1);
    const note = (text) => { log.push(`${at()} s  ${text}`); console.log(`${at()} s  ${text}`); };
    const capture = setInterval(async () => {
      try {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
        frames.push(data);
      } catch { /* page busy; skip a frame */ }
    }, 1000);

    await evaluate(`window.__startTimer(); document.getElementById('start').click(); true`);
    note('Start shift');
    await sleep(500);

    let clipIndex = 0;
    for (const step of DEMO) {
      const name = await evaluate(`document.getElementById('traveller-name').textContent`);
      if (name !== step.traveller) throw new Error(`expected ${step.traveller}, desk shows ${name}`);
      for (const question of step.questions) {
        const voicesBefore = await evaluate('window.__voices.length');
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
        await evaluate(`window.__say(${JSON.stringify(clips[clipIndex++])})`);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
        note(`asked out loud: "${question}"`);
        // Wait for the reply to show and its voice to finish.
        let heard = null;
        for (let i = 0; i < 100 && !heard; i += 1) {
          await sleep(200);
          heard = await evaluate(`(() => {
            const lines = [...document.querySelectorAll('#conversation li')].map((li) => li.textContent);
            const last = lines.at(-1) ?? '';
            const v = window.__voices.at(-1);
            const spoke = window.__voices.length > ${voicesBefore};
            if (!spoke || last.endsWith('…')) return document.getElementById('hint').textContent.startsWith("Didn't") ? { failed: document.getElementById('hint').textContent } : null;
            return { transcript: lines.at(-2), reply: last, seconds: v.duration };
          })()`);
        }
        if (!heard || heard.failed) throw new Error(`no reply: ${heard?.failed ?? 'timed out'}`);
        note(`page heard "${heard.transcript}"`);
        note(`reply (${heard.seconds.toFixed(1)} s of voice): ${heard.reply}`);
        await evaluate(`new Promise((r) => { const v = window.__voices.at(-1); if (v.ended || v.paused) return r(true); v.addEventListener('ended', () => r(true)); setTimeout(() => r(false), ${LIMIT_S * 1000}); })`);
        note('voice finished');
      }
      await sleep(800);
      await evaluate(`document.getElementById('stamp-${step.stamp}').click(); true`);
      note(`stamped ${step.traveller}: ${step.stamp}`);
      await sleep(800);
    }

    const report = await evaluate(`({ visible: !document.getElementById('report').hidden, score: document.getElementById('score').textContent, rows: [...document.querySelectorAll('#report-rows tr')].map((tr) => tr.textContent) })`);
    note(`end-of-shift report: ${report.score}`);
    await sleep(2000);
    clearInterval(capture);
    const total = Number(at()) - 2;
    const pass = report.visible && total < LIMIT_S;
    log.push('', `Total, Start shift to report: ${total.toFixed(1)} s (limit ${LIMIT_S} s): ${pass ? 'PASS' : 'FAIL'}`);
    console.log(log.at(-1));

    const frameDir = path.join(work, 'frames');
    await mkdir(frameDir);
    await Promise.all(frames.map((f, i) => writeFile(path.join(frameDir, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(f, 'base64'))));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(frameDir, '%04d.jpg'), '-vf', 'scale=1280:-2', '-pix_fmt', 'yuv420p', `${OUT}/rehearsal.mp4`]);
    await writeFile(path.join(frameDir, '..', 'last.jpg'), Buffer.from(frames.at(-1), 'base64'));
    execFileSync('cp', [path.join(work, 'last.jpg'), `${OUT}/report.jpg`]);
    await writeFile(`${OUT}/timing.md`, `# Demo rehearsal ${new Date().toISOString()}\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n`);
    console.log(`Saved ${OUT}/rehearsal.mp4, report.jpg and timing.md`);
    cdp.close();
    process.exitCode = pass ? 0 : 1;
  } finally {
    // Chrome keeps writing its profile until it has fully exited.
    const exited = once(chrome, 'exit');
    chrome.kill();
    await exited;
    await rm(work, { recursive: true, force: true, maxRetries: 5 });
  }
}

await main();
