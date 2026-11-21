// Checks the real page in headless Chrome, offline: its own server with no
// Mistral (canned replies, no cost). Catches screen bugs the rules tests can't
// see, such as a hint left over from the last shift. Run: npm run browser-check
// It must pass on a busy machine and with two copies running at once, so it
// waits for what it checks instead of sleeping a set time, the shift clock
// runs at real speed until the check skips it to the end, and each run gets
// its own Chrome port and profile.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { browserOnThisMachine } from './find-browser.js';

const OUT_OF_QUESTIONS = 'No questions left. Stamp the papers.';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs before the page's own scripts: the page's clock runs at real speed,
// and window.__skipClock(ms) jumps it forward when the check wants time to pass.
const SKIPPABLE_CLOCK = `(() => {
  const realNow = performance.now.bind(performance);
  let skipped = 0;
  performance.now = () => realNow() + skipped;
  window.__skipClock = (ms) => { skipped += ms; };
  const realFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (draw) => realFrame(() => draw(performance.now()));
})();`;
const SHIFT_AND_A_BIT_MS = 125000;

// Finds a desk object on screen: hover a grid over the lower screen and keep
// the middle of the spots whose hover label starts with the given words.
const DESK_SPOT = (label, { left = 0, right = 1, top = 0.35, bottom = 0.95 } = {}) => `(() => {
  const canvas = document.querySelector('#booth canvas');
  const tip = document.getElementById('tool-tip');
  const hits = [];
  for (let y = innerHeight * ${top}; y < innerHeight * ${bottom}; y += 8) {
    for (let x = innerWidth * ${left}; x < innerWidth * ${right}; x += 8) {
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      if (tip.textContent.startsWith(${JSON.stringify(label)})) hits.push([x, y]);
    }
  }
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true }));
  if (!hits.length) return null;
  return hits[Math.floor(hits.length / 2)];
})()`;

// Chrome picks a free port and writes it into the profile folder, so two runs never share one.
async function devtoolsPort(profile) {
  for (let i = 0; i < 150; i += 1) {
    try {
      const [port] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      if (port) return port;
    } catch { /* Chrome still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

async function openPage(port, url) {
  for (let i = 0; i < 100; i += 1) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
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
        await send('Page.addScriptToEvaluateOnNewDocument', { source: SKIPPABLE_CLOCK });
        await send('Page.navigate', { url });
        const evaluate = async (expression) => {
          const msg = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (msg.result?.exceptionDetails) throw new Error(msg.result.exceptionDetails.exception?.description);
          return msg.result.result.value;
        };
        // Up to 20 s for the page and its 3D desk on a slow machine.
        const waitFor = async (expression, ms = 20000) => {
          for (let waited = 0; waited < ms; waited += 100) {
            try { if (await evaluate(expression)) return true; } catch { /* page still loading */ }
            await sleep(100);
          }
          return false;
        };
        if (!(await waitFor(`Boolean(document.querySelector('#booth canvas') && window.__skipClock)`))) throw new Error('the page and its 3D desk did not load');
        return { evaluate, send, waitFor, close: () => ws.close() };
      }
    } catch { /* Chrome still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

async function main() {
  // It normally takes about 10 s. A stuck Chrome once hung check.sh for 5 minutes;
  // fail plainly instead, so a rerun is the obvious next step.
  setTimeout(() => {
    console.log('   FAIL the browser check took over 120 s (Chrome stuck?): run it again');
    process.exit(1);
  }, 120000).unref();
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
  const chrome = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${work}`, '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  const failures = [];
  try {
    const page = await openPage(await devtoolsPort(work), `http://127.0.0.1:${server.address().port}/`);
    const { waitFor } = page;
    const screen = () => page.evaluate(`({
      hint: document.getElementById('hint').textContent,
      left: document.getElementById('questions-left').textContent,
      over: !document.getElementById('report').hidden,
    })`);
    const check = (name, ok, seen) => {
      console.log(`   ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `: saw ${JSON.stringify(seen)}`}`);
      if (!ok) failures.push(name);
    };
    let seen;
    const ask = (text) => page.evaluate(`document.getElementById('question').value = ${JSON.stringify(text)}; document.getElementById('ask-form').requestSubmit(); true`);

    const stampAt = await page.evaluate(DESK_SPOT('Stamp: let them through'));
    if (!stampAt) throw new Error('could not find the THROUGH stamp on the desk');
    const awayAt = await page.evaluate(DESK_SPOT('Stamp: turn them away'));
    if (!awayAt) throw new Error('could not find the TURNED AWAY stamp on the desk');
    const press = async ([x, y]) => {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
      }
    };
    const OFFER_OUT = `!document.getElementById('take-bribe').hidden`;
    const desk = () => page.evaluate(`({
      name: document.getElementById('traveller-name').textContent,
      hint: document.getElementById('hint').textContent,
      said: document.getElementById('subtitle').textContent,
      offer: ${OFFER_OUT},
      over: !document.getElementById('report').hidden,
    })`);
    // The transcript's full page is hidden while the slip is down; it must not
    // catch the pointer above the slip, where the papers, mic and stamps are.
    const aboveSlip = await page.evaluate(`(() => {
      const canvas = document.querySelector('#booth canvas');
      const tip = document.getElementById('tool-tip');
      let caught = 0;
      for (let y = innerHeight * 0.45; y < innerHeight * 0.68; y += 8) for (let x = 0; x < innerWidth; x += 8) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
        if (tip.textContent.startsWith('Transcript')) caught += 1;
      }
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true }));
      return caught;
    })()`);
    check('hidden parts of the desk never catch the pointer', aboveSlip === 0, { transcriptAboveTheSlip: aboveSlip });
    await page.evaluate(`document.getElementById('start').click(); true`);
    await waitFor(`!document.getElementById('controls').hidden`);
    // Shahil 13:40: no button row in the booth; you click the desk, and a typed question goes with Enter.
    const buttons = await page.evaluate(`({ booth: Boolean(document.querySelector('#booth canvas')), ask: Boolean(document.getElementById('ask')), row: !document.getElementById('tools').hidden })`);
    check('the booth has no on-screen button row', buttons.booth && !buttons.ask && !buttons.row, buttons);
    await page.evaluate(`document.getElementById('question').focus(); true`);
    await page.send('Input.insertText', { text: 'Question 1?' });
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: type === 'keyDown' ? '\r' : undefined });
    await waitFor(`document.getElementById('questions-left').textContent.includes(' 4 of ')`, 5000);
    seen = await screen();
    check('a typed question is asked with Enter', seen.left.includes(' 4 of '), seen);
    for (let i = 2; i <= 5; i += 1) {
      await ask(`Question ${i}?`);
      await waitFor(`document.getElementById('questions-left').textContent.includes(' ${5 - i} of ')`, 5000);
    }
    // Shahil 14:34: nobody bribes while he's being questioned.
    seen = await desk();
    check('no bribe is offered during the questions', !seen.offer && !seen.hint.includes('ledge'), seen);
    // A 6th question can still be typed; it must be refused with a hint.
    await ask('One more?');
    await waitFor(`document.getElementById('hint').textContent === ${JSON.stringify(OUT_OF_QUESTIONS)}`, 5000);
    seen = await screen();
    check('a 6th question shows the out-of-questions hint', seen.hint === OUT_OF_QUESTIONS && seen.left.includes(' 0 of '), seen);

    // The take run: TURNED AWAY brings out his bribe instead of landing, and
    // clicking it on the ledge lets him through.
    await press(awayAt);
    await waitFor(OFFER_OUT, 5000);
    seen = await desk();
    check('TURNED AWAY does not land: Max says "wait" and a croissant comes out', seen.name === 'Max Tokens' && seen.offer && seen.said.includes('Wait, wait!') && seen.hint.includes('croissant onto the ledge'), seen);
    // Only the ledge's left half is scanned, to keep the check quick.
    const bribeAt = (await page.evaluate(DESK_SPOT('A bribe', { left: 0.15, right: 0.5, top: 0.45, bottom: 0.7 }))) ?? [0, 0];
    await press(bribeAt);
    await waitFor(`document.getElementById('traveller-name').textContent !== 'Max Tokens'`, 10000);
    seen = await desk();
    check('clicking the croissant pockets it and lets Max through', seen.name === 'Colin Stilton' && seen.hint.includes('THROUGH') && seen.hint.includes('record'), { bribeAt, ...seen });

    await page.evaluate(`window.__skipClock(${SHIFT_AND_A_BIT_MS}); true`);
    await waitFor(`!document.getElementById('report').hidden`, 10000);
    seen = await screen();
    check('the shift clock runs out to the report', seen.over, seen);
    const maxRow = await page.evaluate(`document.querySelector('#report-rows tr')?.textContent ?? ''`);
    check('the bribed liar counts as let through, and wrong', maxRow.includes('Through (took a bribe)') && maxRow.endsWith('Wrong'), maxRow);
    const bribes = await page.evaluate(`document.getElementById('bribes').textContent`);
    check('the report names the bribe taken and marks the record', bribes.includes('Max Tokens') && bribes.includes('CORRUPT'), bribes);

    await page.evaluate(`document.getElementById('again').click(); true`);
    await waitFor(`!document.getElementById('controls').hidden`, 5000);
    seen = await screen();
    check('Play again starts with no hint left over from the last shift', seen.hint === '' && seen.left.includes(' 5 of '), seen);

    // SPEC item 8: stamping is allowed at any time, even before the first question.
    const first = await page.evaluate(`document.getElementById('traveller-name').textContent`);
    // Shahil 13:40: one message at a time. The hover label sits by the pointer,
    // and the status line keeps its own fixed place at the bottom centre.
    const placed = await page.evaluate(`(() => {
      document.getElementById('hint').textContent = 'Say or type a question first.';
      document.querySelector('#booth canvas').dispatchEvent(new PointerEvent('pointermove', { clientX: ${stampAt[0]}, clientY: ${stampAt[1]}, bubbles: true }));
      const tip = document.getElementById('tool-tip').getBoundingClientRect();
      const hint = document.getElementById('hint').getBoundingClientRect();
      document.getElementById('hint').textContent = '';
      const overlap = !(tip.right < hint.left || hint.right < tip.left || tip.bottom < hint.top || hint.bottom < tip.top);
      return { tipFromPointer: Math.round(Math.hypot(Math.max(tip.left - ${stampAt[0]}, ${stampAt[0]} - tip.right, 0), Math.max(tip.top - ${stampAt[1]}, ${stampAt[1]} - tip.bottom, 0))),
        hintCentre: Math.round(hint.left + hint.width / 2 - innerWidth / 2), hintFromBottom: Math.round(innerHeight - hint.bottom), overlap };
    })()`);
    check('the hover label sits by the pointer, apart from the status line', placed.tipFromPointer <= 24 && Math.abs(placed.hintCentre) <= 1 && placed.hintFromBottom <= 16 && !placed.overlap, placed);
    await press(stampAt);
    await waitFor(`document.getElementById('traveller-name').textContent !== ${JSON.stringify(first)}`, 10000);
    seen = await desk();
    check('stamping THROUGH before any question moves the queue on, with no bribe', seen.name !== first && !seen.offer, { first, ...seen });

    // The refuse run: TURNED AWAY brings out Colin's cheese; TURNED AWAY again lands.
    await press(awayAt);
    await waitFor(OFFER_OUT, 5000);
    seen = await desk();
    check('the honest one bribes too: TURNED AWAY brings out the cheese', seen.name === 'Colin Stilton' && seen.offer && seen.hint.includes('wedge of cheese'), seen);
    await press(awayAt);
    await waitFor(`!document.getElementById('report').hidden`, 10000);
    const refused = await page.evaluate(`({ over: !document.getElementById('report').hidden, row: document.querySelectorAll('#report-rows tr')[1]?.textContent ?? '', record: document.getElementById('bribes').textContent })`);
    check('TURNED AWAY again refuses it: the stamp lands and the record stays clean', refused.over && refused.row.includes('Turned away') && !refused.row.includes('bribe') && refused.record.includes('clean'), refused);

    // Sounds: headless Chrome may have no audio device; the page must not mind.
    const sound = await page.evaluate(`(() => {
      const button = document.getElementById('mute');
      const before = button?.textContent;
      button?.click();
      return { chips: document.querySelectorAll('#mute').length, before, after: button?.textContent };
    })()`);
    // One chip: wiring the sounds up twice doubled every sound and the chip.
    check('the mute button turns the sound off', sound.chips === 1 && sound.before === 'Sound: on (M)' && sound.after === 'Sound: off (M)', sound);
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
