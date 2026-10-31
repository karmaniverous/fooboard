/**
 * The instructions for AI assistants as a module (spec 0.2.0 §3.J *The
 * dialog uses the current site*, Decision 107): `virtual:ai-instructions`
 * exports the text of `public/ai.md`, so *Copy instructions* copies the
 * file this site serves at `/ai.md` without a request (the CSP's
 * `connect-src` allows none to the site itself) and without importing from
 * `public/`, which Vite refuses. The app imports it lazily, so the text is
 * a chunk of its own, loaded on every site when the AI setup dialog opens
 * (Decision 108: *Copy instructions* shows everywhere).
 *
 * @module
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/** The module's id, as the app imports it. */
const ID = 'virtual:ai-instructions';

/** Vite's convention for a virtual module's resolved id. */
const RESOLVED_ID = `\0${ID}`;

/** The instructions file, relative to the project root. */
const FILE = 'public/ai.md';

/** Serve `virtual:ai-instructions` as the text of `public/ai.md`. */
export function aiInstructions(): Plugin {
  let file = FILE;
  return {
    name: 'fooboard:ai-instructions',
    configResolved(config) {
      file = path.resolve(config.root, FILE);
    },
    resolveId: (id) => (id === ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      this.addWatchFile(file);
      return `export default ${JSON.stringify(readFileSync(file, 'utf8'))};`;
    },
  };
}
