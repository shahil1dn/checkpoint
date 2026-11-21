// A9: a timed run of the demo shift in real Chrome, voice in and out.
// Each question is spoken by the Mac's voice into the page's own recorder
// (standing in for the microphone). The desk is used as a player would: real
// mouse presses hold the desk mic (Space for follow-up questions), lift the
// papers and bring the desk stamps down. Every reply plays to the end. Saves
// a frame a second as the recording. Needs `npm start` running.
// Run: npm run rehearse
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { browserOnThisMachine } from './find-browser.js';

const APP = process.env.APP_URL ?? 'http://localhost:5173/';
// The demo slot is 5 minutes (Shahil 15:00); the shift itself stays short.
const LIMIT_S = 300;
const OUT = process.env.REHEARSE_OUT ?? 'docs/proof/s6-rehearsal';

// The demo script: what the inspector says, and the stamp at the end.
const DEMO = [
  // lookUp: after the questions, open his case folder and look up the line starting with this.
  { traveller: 'Max Tokens', readPapers: true, lookUp: 'Sponsor', questions: [
    'Good evening. What brings you to the checkpoint?',
    'If you love Mistral so much, what is the nickname of Mistral Large 4?',
    'Then why did Frontier Horizon Labs pay for your ticket?',
  ], stamp: 'away' },
  { traveller: 'Colin Stilton', questions: [
    'Why are you bringing forty kilos of English cheese to Antarctica?',
  ], stamp: 'through' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The hover tip names each desk object, so hovering finds them on screen.
const DESK_TIPS = { mic: 'Microphone', papers: 'Case folder', through: 'Stamp: let', away: 'Stamp: turn' };

// Synthetic test speech; written to a temp folder and deleted at the end.
async function speakToMp3(dir, text, i) {
  const aiff = path.join(dir, `${i}.aiff`);
  const mp3 = path.join(dir, `${i}.mp3`);
  execFileSync('say', ['-v', 'Samantha', '-o', aiff, text]);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', aiff, '-ac', '1', '-b:a', '48k', mp3]);
  return (await readFile(mp3)).toString('base64');
}

// Chrome picks a free debugging port and writes it into its profile, so a
// rehearsal never drives another session's browser check, as a fixed port could.
async function debugPort(profile) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const [port] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      if (Number(port) > 0) return Number(port);
    } catch { /* Chrome still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

// Minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
async function connect(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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
  // The questions are spoken by the Mac's own voice (say), so this runs on a Mac only.
  if (process.platform !== 'darwin') {
    console.log('npm run rehearse needs a Mac: it speaks the questions with the Mac\'s built-in voice. Play the demo by hand instead.');
    process.exitCode = 1;
    return;
  }
  const browser = browserOnThisMachine();
  const work = await mkdtemp(path.join(tmpdir(), 'checkpoint-rehearsal-'));
  const chrome = spawn(browser, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(work, 'profile')}`,
    '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    const clips = [];
    let n = 0;
    for (const step of DEMO) for (const q of step.questions) clips.push(await speakToMp3(work, q, n++));

    const cdp = await connect(await debugPort(path.join(work, 'profile')));
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: APP });
    await sleep(1500);
    // The 3D desk can take a few seconds more to appear on a busy machine.
    for (let n = 0; n < 100 && !(await evaluate(`Boolean(document.querySelector('#booth canvas'))`)); n += 1) await sleep(100);

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

    // Find each desk object by hovering a grid over the lower screen and reading
    // the hover tip; use the hit nearest the middle of each object's hits.
    const desk = await evaluate(`(() => {
      const canvas = document.querySelector('#booth canvas');
      const tip = document.getElementById('tool-tip');
      const hits = {};
      for (let y = innerHeight * 0.35; y < innerHeight * 0.95; y += 10) {
        for (let x = 0; x < innerWidth; x += 10) {
          canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
          if (tip.textContent) (hits[tip.textContent] ??= []).push([x, y]);
        }
      }
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true }));
      const nearestMiddle = (pts) => {
        const [mx, my] = pts.reduce(([a, b], [x, y]) => [a + x / pts.length, b + y / pts.length], [0, 0]);
        return pts.reduce((best, p) => (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? p : best));
      };
      return Object.fromEntries(Object.entries(hits).map(([name, pts]) => [name, nearestMiddle(pts)]));
    })()`);
    const spot = (tool) => {
      const found = Object.entries(desk).find(([name]) => name.startsWith(DESK_TIPS[tool]));
      if (!found) throw new Error(`could not find the ${tool} on the desk (found: ${Object.keys(desk).join(', ')})`);
      return found[1];
    };
    const mouse = (type, [x, y]) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    const click = async (tool) => {
      await mouse('mouseMoved', spot(tool));
      await mouse('mousePressed', spot(tool));
      await mouse('mouseReleased', spot(tool));
    };
    const key = async (code, keyCode) => {
      for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, code, key: code, windowsVirtualKeyCode: keyCode });
    };
    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      await writeFile(path.join(OUT, name), Buffer.from(data, 'base64'));
    };
    const waitFor = async (condition, ms = 10000) => {
      for (let waited = 0; waited < ms; waited += 100) {
        if (await evaluate(condition)) return true;
        await sleep(100);
      }
      return false;
    };

    await evaluate(`window.__startTimer(); document.getElementById('start').click(); true`);
    note('Start shift');
    await sleep(500);

    let clipIndex = 0;
    for (const step of DEMO) {
      const name = await evaluate(`document.getElementById('traveller-name').textContent`);
      if (name !== step.traveller) throw new Error(`expected ${step.traveller}, desk shows ${name}`);
      if (step.readPapers) {
        await click('papers');
        note('opened the case folder to read it');
        await sleep(1500);
        await shot('case-folder-1440.jpg');
        await sleep(1000);
        await key('Escape', 27);
        note('closed the case folder');
        await sleep(500);
      }
      for (const [i, question] of step.questions.entries()) {
        const voicesBefore = await evaluate('window.__voices.length');
        // The first question to each traveller holds the desk mic; the rest hold Space.
        const byMic = i === 0;
        if (byMic) {
          await mouse('mouseMoved', spot('mic'));
          await mouse('mousePressed', spot('mic'));
        } else {
          await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
        }
        await evaluate(`window.__say(${JSON.stringify(clips[clipIndex++])})`);
        if (byMic) await mouse('mouseReleased', spot('mic'));
        else await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
        note(`asked out loud, holding ${byMic ? 'the desk mic' : 'Space'}: "${question}"`);
        // Wait for the reply's subtitle and voice, then for the voice to finish.
        let heard = null;
        for (let n = 0; n < 100 && !heard; n += 1) {
          await sleep(200);
          heard = await evaluate(`(() => {
            const hint = document.getElementById('hint').textContent;
            if (hint.startsWith("Didn't")) return { failed: hint };
            const reply = document.getElementById('subtitle').textContent;
            // The voice's length is only known once its audio has loaded.
            if (window.__voices.length <= ${voicesBefore} || !reply || !Number.isFinite(window.__voices.at(-1).duration)) return null;
            return {
              transcript: document.getElementById('you-said').textContent.replace(/^You: /, ''),
              reply,
              fallback: hint.includes("wasn't counted") ? hint : '',
              seconds: window.__voices.at(-1).duration,
            };
          })()`);
        }
        if (!heard || heard.failed) throw new Error(`no reply: ${heard?.failed ?? 'timed out'}`);
        note(`page heard "${heard.transcript}"`);
        note(heard.fallback ? `fallback, not counted: ${heard.fallback}` : `subtitle (${heard.seconds.toFixed(1)} s of voice): ${heard.reply}`);
        await evaluate(`new Promise((r) => { const v = window.__voices.at(-1); if (v.ended || v.paused) return r(true); v.addEventListener('ended', () => r(true)); setTimeout(() => r(false), ${LIMIT_S * 1000}); })`);
        note('voice finished');
      }
      // ADR-12: look one line up on the records terminal, and watch it search.
      if (step.lookUp) {
        await click('papers');
        await sleep(1200);
        const lineAt = await evaluate(`(() => {
          const canvas = document.querySelector('#booth canvas');
          const tip = document.getElementById('tool-tip');
          const hits = [];
          for (let y = innerHeight * 0.05; y < innerHeight * 0.95; y += 10) for (let x = innerWidth * 0.1; x < innerWidth * 0.9; x += 10) {
            canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
            if (tip.textContent.startsWith(${JSON.stringify(`Look up: ${step.lookUp}`)})) hits.push([x, y]);
          }
          return hits[Math.floor(hits.length / 2)] ?? null;
        })()`);
        if (!lineAt) throw new Error(`no "${step.lookUp}" line in ${step.traveller}'s case folder`);
        await mouse('mouseMoved', lineAt);
        await mouse('mousePressed', lineAt);
        await mouse('mouseReleased', lineAt);
        note(`clicked "${step.lookUp}" in the case folder to look it up`);
        await key('Escape', 27);
        await key('ArrowLeft', 37);
        await sleep(1300);
        await shot('terminal-mid-search-1440.jpg');
        const looked = await waitFor(`document.getElementById('lookups-left').textContent.includes(' 2 of ')`, 20000);
        if (!looked) throw new Error('the lookup did not finish');
        note(`records terminal answered: ${await evaluate(`document.getElementById('lookups-left').textContent`)}`);
        await sleep(2500);
        await shot('terminal-answer-1440.jpg');
        await key('ArrowRight', 39);
        await sleep(900);
      }
      await sleep(800);
      const voicesBefore = await evaluate('window.__voices.length');
      await click(step.stamp);
      note(`brought the ${step.stamp} stamp down on ${step.traveller}'s papers`);
      // Shahil 14:34: the first TURNED AWAY brings out his last-ditch bribe.
      // The demo refuses it with a second TURNED AWAY, so the police still come.
      if (step.stamp === 'away') {
        if (!(await waitFor(`!document.getElementById('take-bribe').hidden`))) throw new Error(`${step.traveller} made no offer`);
        note(`he pleads: ${await evaluate(`document.getElementById('subtitle').textContent`)}`);
        if (await waitFor(`window.__voices.length > ${voicesBefore}`)) {
          await evaluate(`new Promise((r) => { const v = window.__voices.at(-1); if (v.ended || v.paused) return r(true); v.addEventListener('ended', () => r(true)); setTimeout(() => r(false), 20000); })`);
          note(`plea finished (${(await evaluate('window.__voices.at(-1).duration')).toFixed(1)} s of voice)`);
        } else note('the plea had no voice');
        await sleep(800);
        await click('away');
        note('refused the bribe: brought the away stamp down again');
      }
      // The stamp lands first; then the rules move on to the next traveller.
      const movedOn = await waitFor(`!document.getElementById('report').hidden || document.getElementById('traveller-name').textContent !== ${JSON.stringify(step.traveller)}`);
      if (!movedOn) throw new Error(`stamping ${step.traveller} did not move the queue on`);
      note('next');
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
