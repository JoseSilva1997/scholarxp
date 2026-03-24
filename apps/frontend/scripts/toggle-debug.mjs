// Toggles the shared frontend UI debug flag so local diagnostics stay opt-in and easy to switch.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const flagFilePath = path.resolve(__dirname, '../src/utils/uiDebug.ts');
const nextStateInput = process.argv[2] ?? 'toggle';

if (!['toggle', 'on', 'off'].includes(nextStateInput)) {
  console.error(
    'Usage: pnpm --filter frontend toggle_debug [toggle|on|off]',
  );
  process.exit(1);
}

const fileContents = await readFile(flagFilePath, 'utf8');
const match = fileContents.match(
    /export const isUiDebugEnabled = (true|false);/,
);

if (!match) {
  console.error(`Could not find isUiDebugEnabled in ${flagFilePath}.`);
  process.exit(1);
}

const currentState = match[1] === 'true';
const nextState =
  nextStateInput === 'on'
    ? true
    : nextStateInput === 'off'
      ? false
      : !currentState;
const updatedContents = fileContents.replace(
  /export const isUiDebugEnabled = (true|false);/,
  `export const isUiDebugEnabled = ${String(nextState)};`,
);

if (updatedContents === fileContents) {
  console.log(`Frontend UI debug remains ${nextState ? 'ON' : 'OFF'}.`);
  process.exit(0);
}

await writeFile(flagFilePath, updatedContents, 'utf8');
console.log(`Frontend UI debug is now ${nextState ? 'ON' : 'OFF'}.`);
console.log(`Updated ${path.relative(process.cwd(), flagFilePath)}.`);
