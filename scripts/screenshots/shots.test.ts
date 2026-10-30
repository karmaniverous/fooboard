/**
 * Tests `npm run screenshots`' list of shots (`shots.ts`) against the
 * README: the PNGs it writes are exactly the ones the README shows, and
 * the ones committed in `docs/screenshots/`, at each shot's size. A shot
 * added to or dropped from one but not the other fails here.
 *
 * @module
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCHEMES, shotFiles, SHOTS } from './shots';

const ROOT = path.resolve(import.meta.dirname, '../..');
const README = path.join(ROOT, 'README.md');
const DIR = path.join(ROOT, 'docs', 'screenshots');

/** The screenshots `markdown` shows (`src` and `srcset` alike). */
const referenced = (markdown: string): string[] => [
  ...new Set(
    [...markdown.matchAll(/docs\/screenshots\/([\w-]+\.png)/g)].map(
      ([, file]) => file,
    ),
  ),
];

/** A PNG's size, from its IHDR chunk. */
const pngSize = (png: Buffer): { width: number; height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

describe('the README screenshots', () => {
  it('finds image references in a document', () => {
    expect(
      referenced(
        '<source srcset="docs/screenshots/a-dark.png" />\n<img src="docs/screenshots/a-light.png" /> docs/screenshots/a-dark.png',
      ),
    ).toEqual(['a-dark.png', 'a-light.png']);
  });

  it('are the shots the script takes, no more and no fewer', () => {
    expect(referenced(readFileSync(README, 'utf8')).sort()).toEqual(
      shotFiles().sort(),
    );
  });

  it('are the PNGs committed, no more and no fewer', () => {
    expect(
      readdirSync(DIR)
        .filter((file) => file.endsWith('.png'))
        .sort(),
    ).toEqual(shotFiles().sort());
  });

  it.each(
    SHOTS.flatMap((shot) =>
      SCHEMES.map((scheme) => ({
        file: `${shot.name}-${scheme}.png`,
        size: 'clip' in shot ? shot.clip : shot.viewport,
      })),
    ),
  )('$file is the shot\u2019s size', ({ file, size }) => {
    expect(pngSize(readFileSync(path.join(DIR, file)))).toEqual(size);
  });
});
