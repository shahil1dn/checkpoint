// Sound effects, made in the browser with the Web Audio API: no audio files.
// A stamp thunk, a low Antarctic wind, and a cue when a traveller steps up or
// is taken away. Screen code only: it listens to what the page already tells
// the booth, so the rest of the page needs one line to switch it on.

const MUTE_KEY = 'checkpoint-muted';
// Kept low on purpose: the travellers' voices and the microphone come first.
const MASTER = 0.6;
const WIND = 0.14;
// booth.stamp() lifts the stamp for 0.45 s before it lands on the papers.
const STAMP_LANDS_AFTER = 0.45;
// A turned-away traveller is hauled off before the next one walks on.
const NEXT_STEPS_UP_AFTER = 1.6;

// Which cues a change of traveller plays. Pure, so a test can read it.
export function cuesFor(previousId, nextId, reaction) {
  if (previousId === nextId) return [];
  const cues = [];
  if (previousId && reaction === 'away') cues.push({ cue: 'takenAway', after: 0 });
  if (nextId) cues.push({ cue: 'stepUp', after: cues.length ? NEXT_STEPS_UP_AFTER : 0 });
  return cues;
}

export function createSounds({
  AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  doc = globalThis.document,
  storage = globalThis.localStorage,
} = {}) {
  let ctx = null;
  let master = null;
  let duck = null;
  let noise = null;
  let muted = readMuted();
  let button = null;
  const quiet = { talking: false, recording: false };

  function readMuted() {
    try { return storage?.getItem(MUTE_KEY) === '1'; } catch { return false; }
  }

  // Browsers refuse sound before the player has clicked or pressed a key, so
  // nothing is built until then. A machine with no sound just stays silent.
  function unlock() {
    if (ctx || !AudioContextClass) return;
    try {
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER;
      master.connect(ctx.destination);
      noise = makeNoise();
      startWind();
    } catch {
      ctx = null;
    }
  }

  // Three seconds of soft rumbling noise, used by the wind and the thunk.
  function makeNoise() {
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    // Fade the ends so the loop has no click where it joins.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i += 1) {
      data[i] *= i / fade;
      data[length - 1 - i] *= i / fade;
    }
    return buffer;
  }

  function slowWave(hertz, depth, target) {
    const wave = ctx.createOscillator();
    wave.frequency.value = hertz;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    wave.connect(amount).connect(target);
    wave.start();
  }

  function startWind() {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    const level = ctx.createGain();
    level.gain.value = WIND;
    duck = ctx.createGain();
    source.connect(filter).connect(level).connect(duck).connect(master);
    // Two slow waves at unrelated speeds make it gust instead of hiss.
    slowWave(0.07, 150, filter.frequency);
    slowWave(0.11, WIND * 0.5, level.gain);
    source.start();
  }

  // The wind drops out while the microphone is held or a reply is playing.
  function setQuiet(why, on) {
    quiet[why] = Boolean(on);
    if (!ctx) return;
    const target = quiet.talking || quiet.recording ? 0 : 1;
    duck.gain.setTargetAtTime(target, ctx.currentTime, target ? 0.4 : 0.05);
  }

  // One short note that fades out.
  function note({ type = 'sine', from, to = from, at, lasts, loud }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + lasts);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(loud, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + lasts);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + lasts + 0.02);
  }

  const CUES = {
    // A low knock plus a puff of noise: rubber on paper on a wooden desk.
    stamp(at) {
      note({ from: 150, to: 48, at, lasts: 0.16, loud: 0.8 });
      const puff = ctx.createBufferSource();
      puff.buffer = noise;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
      puff.connect(gain).connect(master);
      puff.start(at, 1, 0.1);
    },
    // Two rising notes, like a counter bell: next, please.
    stepUp(at) {
      note({ from: 587, at, lasts: 0.22, loud: 0.2 });
      note({ from: 784, at: at + 0.13, lasts: 0.3, loud: 0.2 });
    },
    // Two falling notes: the police have him.
    takenAway(at) {
      note({ type: 'triangle', from: 392, at, lasts: 0.2, loud: 0.22 });
      note({ type: 'triangle', from: 262, to: 233, at: at + 0.17, lasts: 0.38, loud: 0.22 });
    },
  };

  function play(cue, after = 0) {
    if (!ctx) return;
    try { CUES[cue](ctx.currentTime + after); } catch { /* sound is never worth breaking the game */ }
  }

  function setMuted(on) {
    muted = Boolean(on);
    try { storage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private browsing */ }
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.02);
    drawButton();
  }

  function drawButton() {
    if (!button) return;
    button.textContent = muted ? 'Sound: off (M)' : 'Sound: on (M)';
    button.setAttribute('aria-pressed', String(muted));
  }

  // The mute button is added here, not in index.html, so this file is the
  // whole feature. It sits in the top bar beside the connection status.
  function addButton() {
    const bar = doc?.getElementById?.('topbar');
    if (!bar) return;
    button = doc.createElement('button');
    button.id = 'mute';
    button.type = 'button';
    // Drawn as a status chip like its neighbour, not a button: the booth has no
    // button row (Shahil 13:40). M does the same from the keyboard.
    button.style.cssText = 'margin-left: auto; min-height: 0; color: var(--muted); font: 13px/1.4 system-ui, sans-serif;';
    button.addEventListener('click', () => setMuted(!muted));
    bar.append(button);
    drawButton();
  }

  if (doc?.addEventListener) {
    doc.addEventListener('pointerdown', unlock, true);
    doc.addEventListener('keydown', (event) => {
      unlock();
      const typing = event.target?.tagName === 'INPUT';
      if (event.code === 'KeyM' && !typing && !event.repeat) setMuted(!muted);
    }, true);
    addButton();
  }

  // Wraps the booth's own methods, so the sounds follow the game without a
  // hook at every place the page stamps, speaks or listens.
  function follow(booth) {
    if (!booth) return booth;
    let shown = null;
    const before = (name, heard) => {
      const original = booth[name];
      if (typeof original !== 'function') return;
      booth[name] = (...args) => {
        try { heard(...args); } catch { /* never break the booth */ }
        return original.apply(booth, args);
      };
    };
    before('stamp', () => play('stamp', STAMP_LANDS_AFTER));
    before('setTalking', (on) => setQuiet('talking', on));
    before('setRecording', (on) => setQuiet('recording', on));
    before('show', (id, { reaction } = {}) => {
      const next = id ?? null;
      for (const { cue, after } of cuesFor(shown, next, reaction)) play(cue, after);
      shown = next;
    });
    return booth;
  }

  return { follow, play, setMuted, unlock, isMuted: () => muted, started: () => Boolean(ctx) };
}
