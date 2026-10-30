/**
 * Tests that a refused share names what is wrong with it, field by field
 * (spec 0.2.0 §3.J *Field-level errors*): zod's issues of the envelope
 * and the configuration at their paths, the integrity refinement's
 * included; repeated dashboard and credential ids naming both places; a
 * newer version, a wrong format tag and text that isn't JSON; a refusal
 * the migration throws, about the whole share; and never a value from
 * the share's credentials.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';

import { readShare, SHARE_FORMAT, SHARE_FORMAT_VERSION } from './envelope';
import { issueLine } from './issues';

const rule = (value: string) => ({
  combine: 'and',
  checks: [
    {
      path: '$.branch',
      operator: 'regex',
      value,
      ignoreCase: false,
      quantifier: 'any',
      not: false,
    },
  ],
});

/** A small valid dashboard, as an assistant writes one. */
const dashboard = (id = 'acme', credentialId = 'gh') => ({
  id,
  name: 'Acme',
  credentials: [{ id: credentialId, kind: 'github', label: 'acme GitHub' }],
  settings: { githubToken: credentialId },
  rows: [{ type: 'github', id: 'api', displayName: 'api', repo: 'acme/api' }],
  stages: [
    { id: 'dev', name: 'dev', rules: { github: rule('^dev$') } },
    { id: 'prod', name: 'prod', rules: { github: rule('^main$') } },
  ],
});
type Board = ReturnType<typeof dashboard>;

/** The share's JSON text holding `dashboards`, with `extra` over it. */
const share = (
  dashboards: unknown[] = [dashboard()],
  extra: Record<string, unknown> = {},
): string =>
  JSON.stringify({
    format: SHARE_FORMAT,
    formatVersion: SHARE_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    dashboards,
    credentials: null,
    ...extra,
  });

/** `dashboard()` changed by `change`. */
const changed = (change: (d: Board) => void): Board => {
  const d = dashboard();
  change(d);
  return d;
};

/** The lines of what `text` is refused with (none when it reads). */
const lines = (text: string): string[] => {
  const read = readShare(text);
  return read.ok ? [] : read.issues.map(issueLine);
};

describe('readShare: field-level errors', () => {
  it('reads a valid share with no issues', () => {
    expect(readShare(share())).toMatchObject({ ok: true });
  });

  it('names a bad operator at its path', () => {
    const d = changed((b) => {
      b.stages[1].rules.github.checks[0].operator = 'nope';
    });
    expect(lines(share([d]))).toEqual([
      expect.stringMatching(
        /^dashboards\[0\]\.stages\[1\]\.rules\.github\.checks\[0\]\.operator: /,
      ),
    ]);
  });

  it('names a missing stage id at its path', () => {
    const d = changed((b) => {
      delete (b.stages[1] as Partial<Board['stages'][number]>).id;
    });
    expect(lines(share([d]))).toEqual([
      expect.stringMatching(/^dashboards\[0\]\.stages\[1\]\.id: /),
    ]);
  });

  it("names a repeated stage id, from the dashboard's integrity check, at the repeat", () => {
    const d = changed((b) => {
      b.stages[1].id = 'dev';
    });
    expect(lines(share([d]))).toEqual([
      expect.stringMatching(/^dashboards\[0\]\.stages\[1\]\.id: /),
    ]);
  });

  it('names a repeated dashboard id at both places', () => {
    expect(
      lines(share([dashboard('a', 'gh1'), dashboard('a', 'gh2')])),
    ).toEqual(['dashboards[1].id: repeats dashboards[0].id']);
  });

  it('names a credential id repeated across dashboards at both places', () => {
    expect(lines(share([dashboard('a', 'gh'), dashboard('b', 'gh')]))).toEqual([
      'dashboards[1].credentials[0].id: repeats dashboards[0].credentials[0].id',
    ]);
  });

  it('names a newer schema version, and is refused as newer', () => {
    const read = readShare(
      share(undefined, { schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    );
    expect(read).toMatchObject({ ok: false, reason: 'newer' });
    expect(!read.ok && read.issues.map(issueLine)).toEqual([
      `schemaVersion: newer than this fooboard reads (at most ${String(CURRENT_SCHEMA_VERSION)})`,
    ]);
  });

  it('names a newer format version', () => {
    expect(
      lines(share(undefined, { formatVersion: SHARE_FORMAT_VERSION + 1 })),
    ).toEqual([
      `formatVersion: newer than this fooboard reads (at most ${String(SHARE_FORMAT_VERSION)})`,
    ]);
  });

  it.each([
    ['a wrong format tag', share(undefined, { format: 'other' }), 'format'],
    ['a missing format tag', share(undefined, { format: undefined }), 'format'],
    ['JSON that is no object', '[1]', 'share'],
  ])('names %s, refused as no share', (_why, text, path) => {
    const read = readShare(text);
    expect(read).toMatchObject({ ok: false, reason: 'notShare' });
    expect(!read.ok && read.issues.map((i) => i.path)).toEqual([path]);
  });

  it("names bad JSON as the whole share, with the parser's message", () => {
    expect(lines('{"format":')).toEqual([
      expect.stringMatching(/^share: not JSON: /),
    ]);
  });

  it('names an envelope field the envelope lacks', () => {
    expect(lines(share(undefined, { credentials: undefined }))).toEqual([
      expect.stringMatching(/^credentials: /),
    ]);
  });

  it('names a version the migration refuses as the whole share', () => {
    expect(lines(share(undefined, { schemaVersion: 1 }))).toEqual([
      expect.stringMatching(/^share: /),
    ]);
  });

  it("never puts a value from the share's credentials in a message", () => {
    const SECRET = 'ghp_SECRET123';
    const text = share(
      [
        changed((b) => {
          b.rows[0].repo = 'not a repo';
        }),
      ],
      {
        credentials: {
          encrypted: false,
          secrets: { gh: { kind: 'githubx', token: SECRET } },
        },
      },
    );
    const refused = lines(text);
    expect(refused.length).toBeGreaterThan(0);
    for (const line of refused) expect(line).not.toContain(SECRET);
  });
});
