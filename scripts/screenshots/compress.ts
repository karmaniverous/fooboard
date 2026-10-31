/**
 * Compresses the README screenshots losslessly, the last step of
 * `npm run screenshots` (CONTRIBUTING *Screenshots*): every PNG in
 * `docs/screenshots/` through oxipng, built as WebAssembly
 * (`@jsquash/oxipng`, no install script and no native binary), at level
 * 4 with alpha untouched, so the pixels stay exactly as Playwright took
 * them. A file is rewritten only when that makes it smaller. Run with
 * Node, which strips the types.
 *
 * @module
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { init } from '@jsquash/oxipng/optimise.js';

const DIR = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
/** oxipng's optimisation level, as `oxipng -o 4`. */
const LEVEL = 4;

// The codec's own loader fetches its .wasm by URL, which Node can't for
// a file: compile it here and hand the module over. Its `optimise`
// wrapper tests for `ImageData`, which Node lacks, so call the codec's.
const wasm = await readFile(
  fileURLToPath(
    import.meta.resolve('@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm'),
  ),
);
const { optimise } = await init(new WebAssembly.Module(wasm));

const names = (await readdir(DIR)).filter((n) => n.endsWith('.png')).sort();
let before = 0;
let after = 0;
for (const name of names) {
  const path = join(DIR, name);
  const png = await readFile(path);
  // Not interlaced, and alpha untouched: lossless.
  const out = optimise(new Uint8Array(png), LEVEL, false, false);
  const kept = out.length < png.length ? out : png;
  if (kept === out) await writeFile(path, out);
  before += png.length;
  after += kept.length;
}
console.log(
  `compressed ${String(names.length)} screenshots: ${String(before)} -> ${String(after)} bytes`,
);
