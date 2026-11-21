import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBrowser, noBrowserMessage } from '../scripts/find-browser.js';

// A fake disk: only the listed paths exist.
const disk = (...paths) => (p) => paths.includes(p);

test('CHROME_PATH wins when the file is there', () => {
  const env = { CHROME_PATH: '/opt/my/chrome', PATH: '/usr/bin' };
  assert.equal(findBrowser({ platform: 'linux', env, exists: disk('/opt/my/chrome', '/usr/bin/chromium') }), '/opt/my/chrome');
});

test('a CHROME_PATH that points nowhere is not silently replaced', () => {
  const env = { CHROME_PATH: '/nope/chrome' };
  assert.equal(findBrowser({ platform: 'darwin', env, exists: disk('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') }), null);
  assert.match(noBrowserMessage(env), /CHROME_PATH is set to "\/nope\/chrome"/);
});

test('Mac: Chrome in Applications', () => {
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  assert.equal(findBrowser({ platform: 'darwin', env: {}, exists: disk(mac) }), mac);
});

const windowsEnv = {
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  LOCALAPPDATA: 'C:\\Users\\hamzah\\AppData\\Local',
};

test('Windows: Chrome in Program Files, whatever case the variable names use', () => {
  const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  assert.equal(findBrowser({ platform: 'win32', env: windowsEnv, exists: disk(chrome) }), chrome);
});

test('Windows: Chrome installed for one user only, in LOCALAPPDATA', () => {
  const chrome = 'C:\\Users\\hamzah\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  assert.equal(findBrowser({ platform: 'win32', env: windowsEnv, exists: disk(chrome) }), chrome);
});

test('Windows: Edge when there is no Chrome, and Chrome first when both are there', () => {
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chrome = 'C:\\Users\\hamzah\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  assert.equal(findBrowser({ platform: 'win32', env: windowsEnv, exists: disk(edge) }), edge);
  assert.equal(findBrowser({ platform: 'win32', env: windowsEnv, exists: disk(edge, chrome) }), chrome);
});

test('Linux: a browser on the PATH', () => {
  const env = { PATH: '/usr/local/bin:/usr/bin' };
  assert.equal(findBrowser({ platform: 'linux', env, exists: disk('/usr/bin/chromium') }), '/usr/bin/chromium');
});

test('nothing found: null, and the message says to set CHROME_PATH', () => {
  assert.equal(findBrowser({ platform: 'win32', env: windowsEnv, exists: disk() }), null);
  assert.equal(findBrowser({ platform: 'linux', env: {}, exists: disk() }), null);
  assert.match(noBrowserMessage({}), /Set CHROME_PATH/);
});
