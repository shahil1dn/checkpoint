// The sounds run on the Web Audio API, which Node doesn't have. A fake audio
// context that accepts every call lets these tests count what would be played.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSounds, cuesFor } from '../public/sounds.js';

function fakeAudio() {
  const made = { contexts: 0, notes: 0, clips: 0 };
  const anything = () => new Proxy(function node() {}, {
    get: (_, name) => (name === 'then' ? undefined : anything()),
    set: () => true,
    apply: () => anything(),
  });
  class FakeAudioContext {
    constructor() { made.contexts += 1; this.sampleRate = 100; this.currentTime = 0; this.destination = anything(); }
    createGain() { return anything(); }
    createBiquadFilter() { return anything(); }
    createOscillator() { made.notes += 1; return anything(); }
    createBufferSource() { made.clips += 1; return anything(); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  return { FakeAudioContext, made };
}

function fakeBooth() {
  const calls = [];
  const record = (name, result) => (...args) => { calls.push([name, ...args]); return result; };
  return { calls, stamp: record('stamp', 'stamped'), show: record('show'), setTalking: record('setTalking'), setRecording: record('setRecording') };
}

test('a traveller change picks the right cues', () => {
  assert.deepEqual(cuesFor(null, 'max'), [{ cue: 'stepUp', after: 0 }]);
  assert.deepEqual(cuesFor('max', 'max'), []);
  assert.deepEqual(cuesFor('max', 'colin', 'through'), [{ cue: 'stepUp', after: 0 }]);
  assert.deepEqual(cuesFor('max', 'colin', 'away').map((c) => c.cue), ['takenAway', 'stepUp']);
  assert.ok(cuesFor('max', 'colin', 'away')[1].after > 0, 'the next one steps up after the police have gone');
  assert.deepEqual(cuesFor('colin', null, 'away'), [{ cue: 'takenAway', after: 0 }]);
  assert.deepEqual(cuesFor('colin', null, 'through'), []);
});

test('nothing is built or played before the first click or key press', () => {
  const { FakeAudioContext, made } = fakeAudio();
  const sounds = createSounds({ AudioContextClass: FakeAudioContext, doc: null, storage: null });
  const booth = sounds.follow(fakeBooth());
  booth.stamp('away', {});
  booth.show('max');
  assert.equal(sounds.started(), false);
  assert.deepEqual(made, { contexts: 0, notes: 0, clips: 0 });
});

test('after the first click the wind starts once, and the booth sets off the cues', async () => {
  const { FakeAudioContext, made } = fakeAudio();
  const sounds = createSounds({ AudioContextClass: FakeAudioContext, doc: null, storage: null });
  const booth = sounds.follow(fakeBooth());
  sounds.unlock();
  sounds.unlock();
  assert.equal(made.contexts, 1);
  assert.deepEqual([made.clips, made.notes], [1, 2], 'one wind loop and its two slow waves');
  assert.equal(booth.stamp('through', { Name: 'x' }), 'stamped', 'the booth still gets the call and its answer comes back');
  assert.deepEqual([made.clips, made.notes], [2, 3], 'the thunk: a knock and a puff');
  booth.show('max');
  booth.show('max');
  assert.equal(made.notes, 5, 'stepping up plays once, not on every redraw');
  booth.show('colin', { reaction: 'away' });
  assert.equal(made.notes, 9, 'taken away, then the next steps up');
  booth.setTalking(true);
  booth.setRecording(true);
  assert.deepEqual(booth.calls.map((c) => c[0]), ['stamp', 'show', 'show', 'show', 'setTalking', 'setRecording']);
});

test('a machine with no sound, or a broken one, never breaks the game', () => {
  const none = createSounds({ AudioContextClass: undefined, doc: null, storage: null });
  none.unlock();
  const booth = none.follow(fakeBooth());
  assert.equal(booth.stamp('away', {}), 'stamped');
  booth.setTalking(true);
  assert.equal(none.follow(null), null);
  class Broken { constructor() { throw new Error('no audio device'); } }
  const broken = createSounds({ AudioContextClass: Broken, doc: null, storage: null });
  broken.unlock();
  broken.play('stamp');
  assert.equal(broken.started(), false);
});

test('mute is remembered between visits', () => {
  const kept = new Map();
  const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  const first = createSounds({ AudioContextClass: undefined, doc: null, storage });
  assert.equal(first.isMuted(), false);
  first.setMuted(true);
  assert.equal(createSounds({ AudioContextClass: undefined, doc: null, storage }).isMuted(), true);
});
