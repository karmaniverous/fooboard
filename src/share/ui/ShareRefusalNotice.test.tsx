/**
 * Tests for the import's refusal (spec 0.2.0 §3.J *Headline*): over a
 * share's issues it says the share has problems and lists the first
 * `IMPORT_ISSUES_SHOWN`, with "and N more"; *Copy errors for your
 * assistant* copies every issue after the preamble; a newer share keeps
 * its message and lists its issue; a share with no issues is damaged, and
 * says who to ask.
 *
 * @module
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { clickToCopy, mockClipboard, unmockClipboard } from '@/test/clipboard';

import { readShare, refused } from '../envelope';
import type { ShareIssue } from '../issues';
import { ShareRefusalNotice } from './ShareRefusalNotice';
import {
  COPY_ERRORS,
  IMPORT_ISSUES_SHOWN,
  ISSUES_PREAMBLE,
} from './shareWords';

const issues = (n: number): ShareIssue[] =>
  Array.from({ length: n }, (_, i) => ({
    path: `dashboards[0].rows[${String(i)}].repo`,
    message: 'Invalid string',
  }));

const listed = (): string[] =>
  within(screen.getByRole('list', { name: 'Import errors' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

afterEach(unmockClipboard);

describe('ShareRefusalNotice', () => {
  it('says a share with issues has problems, and lists them as path: message', () => {
    render(
      <ShareRefusalNotice
        refusal={refused('damaged', issues(2))}
        origin="link"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      "This link has problems fooboard can't import:",
    );
    expect(listed()).toEqual([
      'dashboards[0].rows[0].repo: Invalid string',
      'dashboards[0].rows[1].repo: Invalid string',
    ]);
    expect(screen.queryByText(/and \d+ more/)).toBeNull();
    expect(screen.queryByText(/Ask whoever sent it/)).toBeNull();
  });

  it(`lists the first ${String(IMPORT_ISSUES_SHOWN)} and counts the rest`, () => {
    render(
      <ShareRefusalNotice
        refusal={refused('damaged', issues(IMPORT_ISSUES_SHOWN + 5))}
        origin="file"
      />,
    );
    expect(listed()).toHaveLength(IMPORT_ISSUES_SHOWN);
    expect(screen.getByText('and 5 more')).toBeVisible();
  });

  it('copies every issue, the unlisted ones too, after the preamble', async () => {
    const writeText = mockClipboard();
    const all = issues(IMPORT_ISSUES_SHOWN + 5);
    render(
      <ShareRefusalNotice refusal={refused('damaged', all)} origin="link" />,
    );
    await clickToCopy(screen.getByRole('button', { name: COPY_ERRORS }));
    expect(writeText).toHaveBeenCalledWith(
      [ISSUES_PREAMBLE, ...all.map((i) => `${i.path}: ${i.message}`)].join(
        '\n',
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copied. Paste it into your assistant.',
    );
  });

  it('copies no part of a secret from text that is not JSON', async () => {
    const writeText = mockClipboard();
    // An odd number of quotes around an unquoted secret, as V8 quotes it.
    const read = readShare(
      '{"format":"fooboard","credentials":{"secrets":{"gh":{"token": ghp_SECRET123"x""}}}}',
    );
    if (read.ok) throw new Error('expected a refusal');
    render(<ShareRefusalNotice refusal={read} origin="file" />);
    expect(listed().join('\n')).not.toMatch(/ghp|SECRET/);
    await clickToCopy(screen.getByRole('button', { name: COPY_ERRORS }));
    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(copied).toMatch(/^share: not JSON: the error is at position \d+/m);
    expect(copied).not.toMatch(/ghp|SECRET/);
  });

  it("says so when the browser won't copy", async () => {
    mockClipboard(true);
    render(
      <ShareRefusalNotice
        refusal={refused('damaged', issues(1))}
        origin="link"
      />,
    );
    await clickToCopy(screen.getByRole('button', { name: COPY_ERRORS }));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't copy");
  });

  it('keeps a newer share its message, and lists its issue', () => {
    const newer = [
      {
        path: 'schemaVersion',
        message: 'newer than this fooboard reads (at most 7)',
      },
    ];
    render(
      <ShareRefusalNotice refusal={refused('newer', newer)} origin="link" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This link was made with a newer fooboard',
    );
    expect(listed()).toEqual([
      'schemaVersion: newer than this fooboard reads (at most 7)',
    ]);
  });

  it('says a share with no issues is damaged, and who to ask, with nothing to copy', () => {
    render(<ShareRefusalNotice refusal={refused('damaged')} origin="file" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      "This file isn't a fooboard board, or it's damaged.",
    );
    expect(
      screen.getByText('Ask whoever sent it for a new file.'),
    ).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: COPY_ERRORS })).toBeNull();
  });
});
