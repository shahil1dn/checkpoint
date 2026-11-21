// Checks the real page in headless Chrome, offline: its own server with no
// Mistral (canned replies, no cost), and the page's clock sped up so a whole
// shift runs out in seconds. Catches screen bugs the rules tests can't see,
// such as a hint left over from the last shift. Run: npm run browser-check
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { browserOnThisMachine } from './find-browser.js';

const PORT = 9336;
const SPEED = 60;   // a 2-minute shift ends in 2 seconds
const OUT_OF_QUESTIONS = 'No questions left. Stamp the papers.';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs before the page's own scripts: every clock the page reads goes SPEED times faster.
const FAST_CLOCK = `(() => {
  const realNow = performance.now.bind(performance);
  const start = realNow();
  performance.now = () => start + (realNow() - start) * ${SPEED};
  const realFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (draw) => realFrame(() => draw(performance.now()));
})();`;

async function openPage(url) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await once(ws, 'open');
        let nextId = 1;
        const waiting = new Map();
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
        };
        const send = (method, params = {}) => new Promise((resolve) => {
          const id = nextId++;
          waiting.set(id, resolve);
          ws.send(JSON.stringify({ id, method, params }));
        });
        await send('Page.enable');
        await send('Page.addScriptToEvaluateOnNewDocument', { source: FAST_CLOCK });
        await send('Page.navigate', { url });
        await sleep(1500);
        const evaluate = async (expression) => {
          const msg = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (msg.result?.exceptionDetails) throw new Error(msg.result.exceptionDetails.exception?.description);
          return msg.result.result.value;
        };
        return { evaluate, close: () => ws.close() };
      }
    } catch { /* Chrome still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

async function main() {
  let browser;
  try {
    browser = browserOnThisMachine();
  } catch (err) {
    console.log(`   FAIL ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const offline = async () => { throw new Error('offline check: Mistral is never called'); };
  const handle = await createApp({ ask: offline, hear: offline, speak: offline, takeNotes: offline, liveAvailable: false });
  const server = http.createServer(handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const work = await mkdtemp(path.join(tmpdir(), 'checkpoint-browser-check-'));
  const chrome = spawn(browser, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${work}`, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  const failures = [];
  try {
    const page = await openPage(`http://127.0.0.1:${server.address().port}/`);
    const screen = () => page.evaluate(`({
      hint: document.getElementById('hint').textContent,
      left: document.getElementById('questions-left').textContent,
      over: !document.getElementById('report').hidden,
    })`);
    const check = (name, ok, seen) => {
      console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: saw ${JSON.stringify(seen)}`}`);
      if (!ok) failures.push(name);
    };
    const ask = (text) => page.evaluate(`document.getElementById('question').value = ${JSON.stringify(text)}; document.getElementById('ask-form').requestSubmit(); true`);

    await page.evaluate(`document.getElementById('start').click(); true`);
    await sleep(300);
    for (let i = 1; i <= 5; i += 1) {
      await ask(`Question ${i}?`);
      await sleep(150);
    }
    // A 6th question can only come by voice (the Ask button is greyed out);
    // submitting the form directly takes the same path.
    await ask('One more?');
    await sleep(150);
    let seen = await screen();
    check('a 6th question shows the out-of-questions hint', seen.hint === OUT_OF_QUESTIONS && seen.left.includes(' 0 of '), seen);

    for (let i = 0; i < 100 && !(await screen()).over; i += 1) await sleep(100);
    seen = await screen();
    check('the shift clock runs out to the report', seen.over, seen);

    await page.evaluate(`document.getElementById('again').click(); true`);
    await sleep(300);
    seen = await screen();
    check('Play again starts with no hint left over from the last shift', seen.hint === '' && seen.left.includes(' 5 of '), seen);

    // SPEC item 8: stamping is allowed at any time, even before the first question.
    const first = await page.evaluate(`document.getElementById('traveller-name').textContent`);
    await page.evaluate(`document.getElementById('stamp-through').click(); true`);
    let next = first;
    for (let i = 0; i < 50 && next === first; i += 1) {
      await sleep(100);
      next = await page.evaluate(`document.getElementById('traveller-name').textContent`);
    }
    check('stamping before any question moves the queue on', next !== first, { first, next, ...(await screen()) });

    // Sounds: headless Chrome may have no audio device; the page must not mind.
    const sound = await page.evaluate(`(() => {
      const button = document.getElementById('mute');
      const before = button?.textContent;
      button?.click();
      return { before, after: button?.textContent };
    })()`);
    check('the mute button turns the sound off', sound.before === 'Sound: on (M)' && sound.after === 'Sound: off (M)', sound);
    page.close();
  } finally {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await exited;
    server.close();
    await rm(work, { recursive: true, force: true, maxRetries: 5 });
  }
  if (failures.length) process.exitCode = 1;
}

await main();
