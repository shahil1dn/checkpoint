// npm start runs this first (prestart). The start command reads .env with
// --env-file-if-exists, added in Node 22.9.0; an older Node stops with a
// confusing "bad option" instead, so say what to install.
import { pathToFileURL } from 'node:url';

export const MINIMUM = { major: 22, minor: 9 };

export function newEnough(version, { major, minor } = MINIMUM) {
  const [have, haveMinor] = version.replace(/^v/, '').split('.').map(Number);
  return have > major || (have === major && haveMinor >= minor);
}

const runDirectly = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly && !newEnough(process.version)) {
  console.error(`Checkpoint needs Node.js ${MINIMUM.major}.${MINIMUM.minor} or newer; this is ${process.version}.`);
  console.error('Install the LTS from https://nodejs.org, then close and reopen your terminal.');
  process.exitCode = 1;
}
