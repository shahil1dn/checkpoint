// Finds a Chrome or Edge to drive headless, on Mac, Windows or Linux. Pure:
// the platform, environment and file check are passed in, so the tests can
// fake a Windows machine. Edge takes the same headless and debugging flags.
import { existsSync } from 'node:fs';
import path from 'node:path';

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WINDOWS_ROOTS = ['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'];
const WINDOWS_BROWSERS = [
  ['Google', 'Chrome', 'Application', 'chrome.exe'],
  ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
];
const LINUX_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

// Windows environment names ignore case (ProgramFiles, PROGRAMFILES); a plain object doesn't.
function envValue(env, name) {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name);
  return key ? env[key] : undefined;
}

function candidates(platform, env) {
  if (platform === 'darwin') return [MAC_CHROME];
  if (platform === 'win32') {
    const roots = WINDOWS_ROOTS.map((name) => envValue(env, name)).filter(Boolean);
    return WINDOWS_BROWSERS.flatMap((parts) => roots.map((root) => path.win32.join(root, ...parts)));
  }
  const dirs = (envValue(env, 'PATH') ?? '').split(path.posix.delimiter).filter(Boolean);
  return LINUX_NAMES.flatMap((name) => dirs.map((dir) => path.posix.join(dir, name)));
}

// Returns the browser's path, or null. CHROME_PATH, when set, is the only place looked.
export function findBrowser({ platform, env, exists }) {
  const chosen = envValue(env, 'CHROME_PATH');
  if (chosen) return exists(chosen) ? chosen : null;
  return candidates(platform, env).find(exists) ?? null;
}

export function noBrowserMessage(env) {
  const chosen = envValue(env, 'CHROME_PATH');
  return chosen
    ? `CHROME_PATH is set to "${chosen}", but there is no file there. Fix the path or unset it.`
    : 'No Chrome or Edge found. Set CHROME_PATH to your browser, for example in Git Bash:\n'
      + '  export CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"';
}

// The browser on this machine, or an Error that says how to point at one.
export function browserOnThisMachine() {
  const found = findBrowser({ platform: process.platform, env: process.env, exists: existsSync });
  if (!found) throw new Error(noBrowserMessage(process.env));
  return found;
}
