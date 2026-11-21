// The penguins walking behind the traveller must never walk into each other,
// or into the traveller and the police penguin at the window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCrowd, pointAt } from '../public/arrivals.js';

const BODY_WIDTH = 1.0;              // two penguins closer than this overlap on screen
const AT_THE_WINDOW_Z = -1.1;        // the traveller, and the police penguin's run (public/booth.js)
const MINUTES = 3;
const STEP = 1 / 60;

// A seeded random, so a failure can be replayed exactly.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  test(`walkers keep a body's width apart for ${MINUTES} minutes (seed ${seed})`, () => {
    const crowd = makeCrowd({ random: seeded(seed) });
    let closest = Infinity;
    let when = 0;
    for (let t = 0; t < MINUTES * 60; t += STEP) {
      crowd.step(STEP);
      const out = crowd.walkers.filter((w) => w.visible).map((w) => pointAt(w.distance));
      for (let i = 0; i < out.length; i += 1) {
        assert.ok(Math.abs(out[i].z - AT_THE_WINDOW_Z) >= BODY_WIDTH, `a walker reached the window at ${t.toFixed(1)} s`);
        for (let j = i + 1; j < out.length; j += 1) {
          if (gap(out[i], out[j]) < closest) { closest = gap(out[i], out[j]); when = t; }
        }
      }
    }
    assert.ok(closest >= BODY_WIDTH, `two walkers came ${closest.toFixed(2)} apart at ${when.toFixed(1)} s`);
  });
}

test('the crowd keeps coming: someone sets off at least every 15 seconds', () => {
  const crowd = makeCrowd({ random: seeded(42) });
  let since = 0;
  let longest = 0;
  for (let t = 0; t < MINUTES * 60; t += STEP) {
    crowd.step(STEP);
    since = crowd.walkers.some((w) => w.justArrived) ? 0 : since + STEP;
    longest = Math.max(longest, since);
  }
  assert.ok(longest <= 15, `nobody set off for ${longest.toFixed(1)} s`);
});
