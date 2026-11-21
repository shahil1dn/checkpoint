import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newEnough } from '../scripts/check-node.js';

test('Node 22.9 or newer is enough; older is not', () => {
  for (const version of ['v22.9.0', 'v22.10.0', 'v23.0.0', 'v25.1.0']) assert.equal(newEnough(version), true, version);
  for (const version of ['v22.8.9', 'v20.18.0', 'v18.20.4', 'v21.99.0']) assert.equal(newEnough(version), false, version);
});
