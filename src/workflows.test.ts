/**
 * Tests the GitHub Actions workflow configuration that guards `prod`:
 *
 * - CI and the prod guard both rerun when a PR is edited (retargeted to
 *   `prod`);
 * - the prod guard runs on `pull_request_target`, so its workflow comes from
 *   `prod` and the PR it checks can't replace it, with no token permissions;
 * - the prod guard never checks out PR code.
 *
 * These are plain text checks, not a parsed YAML tree: no YAML parser is a
 * direct dependency (`yaml` is only transitive), and adding one for two
 * small files isn't worth it. Each check strips comments first and looks at
 * one block, so prose in the workflow comments can't satisfy it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import ciRaw from '../.github/workflows/ci.yml?raw';
import prodPrRaw from '../.github/workflows/prod-pr.yml?raw';

/** Drops YAML comments (whole-line and trailing) and normalises EOLs. */
const stripComments = (yaml: string): string =>
  yaml
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, ''))
    .filter((line) => line.trim() !== '')
    .join('\n');

const ci = stripComments(ciRaw);
const prodPr = stripComments(prodPrRaw);

/**
 * The lines nested under a top-level-or-indented `key:` line, up to the next
 * line at the same or a lower indent.
 */
const block = (yaml: string, key: string): string => {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start < 0) return '';
  const indent = /^\s*/.exec(lines[start])?.[0].length ?? 0;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if ((/^\s*/.exec(line)?.[0].length ?? 0) <= indent) break;
    body.push(line);
  }
  return body.join('\n');
};

/** A flow-sequence list (`key: [a, b]`) under an event in the `on:` block. */
const listUnder =
  (key: string) =>
  (yaml: string, event: string): string[] => {
    const match = new RegExp(`^\\s*${key}:\\s*\\[([^\\]]*)\\]`, 'm').exec(
      block(block(yaml, 'on'), event),
    );
    return match ? match[1].split(',').map((item) => item.trim()) : [];
  };

/** The activity types an event triggers on. */
const types = listUnder('types');

/** The base branches an event is filtered to. */
const branches = listUnder('branches');

describe('CI workflow', () => {
  it('runs on PRs into prod, including when one is retargeted (edited)', () => {
    expect(branches(ci, 'pull_request')).toContain('prod');
    expect(types(ci, 'pull_request')).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'edited']),
    );
  });
});

describe('prod PR guard workflow', () => {
  it('runs on pull_request_target, not pull_request', () => {
    const on = block(prodPr, 'on');
    expect(on).toMatch(/^\s*pull_request_target:\s*$/m);
    expect(on).not.toMatch(/^\s*pull_request:\s*$/m);
  });

  it('checks PRs into prod, including when one is retargeted (edited)', () => {
    expect(branches(prodPr, 'pull_request_target')).toEqual(['prod']);
    expect(types(prodPr, 'pull_request_target')).toContain('edited');
  });

  it('has no token permissions', () => {
    expect(prodPr).toMatch(/^permissions:\s*\{\s*\}\s*$/m);
    expect(prodPr).not.toMatch(/^\s+permissions:/m);
  });

  it('never checks out PR code', () => {
    expect(prodPr).not.toMatch(/actions\/checkout/);
  });

  it('passes PR fields to the script only through env variables', () => {
    const start = prodPr.indexOf('run: |');
    expect(start).toBeGreaterThanOrEqual(0);
    const run = prodPr.slice(start);
    expect(run).not.toMatch(/\$\{\{/);
  });
});
