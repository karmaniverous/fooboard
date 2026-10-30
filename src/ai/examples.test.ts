/**
 * `/ai` and `/llms.txt` (spec 0.2.0 §3.J): every worked example in
 * `public/ai.md` is a share fooboard reads with no configuration problem;
 * each example's stage rules read back as the branch patterns its table
 * names, so the examples teach exactly the form fooboard writes; every
 * fooboard address in either file is production's canonical host
 * (Decision 96); the envelope and examples are this data model's
 * version; the example link opens to the example's share; and every id
 * in the examples is letters, digits and hyphens, as `/ai` asks (a
 * dashboard's id becomes its address).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';
import { configProblems } from '@/domain/problems/problems';
import { branchOf } from '@/domain/rules/branch';
import { readShare } from '@/share/envelope';
import { SHARE_JSON_LINK_PREFIX, takeShareLink } from '@/share/link';
import { readLink } from '@/share/readLink';
import { windowAt } from '@/test/linkWindow';

import aiMd from '../../public/ai.md?raw';
import llmsTxt from '../../public/llms.txt?raw';

/** Production's canonical host, where every fooboard address points. */
const CANONICAL = 'https://www.fooboard.dev/';

/** Each worked example: the stage table before it, and its JSON. */
const examples = [
  ...aiMd.matchAll(
    /\| Stage id[^\n]*\n\|[^\n]*\n((?:\|[^\n]*\n)+)\n```json\n([\s\S]*?)\n```/g,
  ),
].map(([, table = '', json = '']) => ({
  patterns: Object.fromEntries(
    table
      .trim()
      .split('\n')
      .map((line) => {
        const [, id = '', pattern = ''] =
          /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/.exec(line) ?? [];
        return [id, pattern];
      }),
  ),
  json,
}));

/** The share an example's JSON reads as. */
function shareOf(json: string) {
  const read = readShare(json);
  if (!read.ok) throw new Error(JSON.stringify(read.issues));
  return read.share;
}

describe('the worked examples in /ai', () => {
  it('has the two examples, each with its stage table', () => {
    expect(examples).toHaveLength(2);
  });

  it.each(examples.map((e, i) => [i + 1, e] as const))(
    'example %i reads as a share with no configuration problem',
    (_n, { json }) => {
      const share = shareOf(json);
      expect(share.credentials).toEqual({ kind: 'none' });
      for (const d of share.dashboards) expect(configProblems(d)).toEqual([]);
    },
  );

  it.each(examples.map((e, i) => [i + 1, e] as const))(
    "example %i's stage rules are the branch patterns its table names",
    (_n, { json, patterns }) => {
      const [dashboard] = shareOf(json).dashboards;
      const read = Object.fromEntries(
        dashboard.stages.map((s) => [
          s.id,
          [
            ...new Set(
              [s.rules.github, s.rules.amplify]
                .filter((r) => r !== undefined)
                .map(branchOf),
            ),
          ],
        ]),
      );
      expect(read).toEqual(
        Object.fromEntries(
          Object.entries(patterns).map(([id, p]) => [id, [p]]),
        ),
      );
    },
  );

  it("example 1's link opens to example 1's share", () => {
    const [link] =
      aiMd.match(/https:\/\/www\.fooboard\.dev\/#j=[A-Za-z0-9_-]+/) ?? [];
    expect(link).toBeDefined();
    const taken = takeShareLink(windowAt(link ?? ''), '/');
    expect(taken && readLink(taken)).toEqual({
      ok: true,
      share: shareOf(examples[0]?.json ?? ''),
    });
  });

  it.each([
    ['/ai', aiMd],
    ['/llms.txt', llmsTxt],
  ])('%s gives every fooboard address on the canonical host', (_f, text) => {
    const fooboard = [
      ...text.matchAll(/https?:\/\/[^\s)`>"]*fooboard\.dev[^\s)`>"]*/g),
    ].map(([url]) => url);
    expect(fooboard.length).toBeGreaterThan(0);
    for (const url of fooboard)
      expect(url).toMatch(/^https:\/\/www\.fooboard\.dev\//);
  });

  it("/ai's envelope and examples are this data model's version", () => {
    expect(aiMd).toMatch(
      new RegExp(`^schemaVersion +${String(CURRENT_SCHEMA_VERSION)}$`, 'm'),
    );
    for (const { json } of examples)
      expect(JSON.parse(json)).toMatchObject({
        schemaVersion: CURRENT_SCHEMA_VERSION,
      });
  });

  it('asks for ids of letters, digits and hyphens, and its examples keep to them', () => {
    expect(aiMd).toContain(
      'Write every id with letters, digits and hyphens only',
    );
    const ids = examples.flatMap(({ json }) => {
      const shape = JSON.parse(json) as unknown;
      const found: string[] = [];
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value !== null && typeof value === 'object')
          for (const [k, v] of Object.entries(value)) {
            if (k === 'id' && typeof v === 'string') found.push(v);
            walk(v);
          }
      };
      walk(shape);
      return found;
    });
    expect(ids.length).toBeGreaterThan(10);
    expect(ids.filter((id) => !/^[A-Za-z0-9-]+$/.test(id))).toEqual([]);
  });

  it('/ai tells the assistant to build the link on the canonical host', () => {
    expect(aiMd).toContain(`${CANONICAL}${SHARE_JSON_LINK_PREFIX}`);
  });
});
