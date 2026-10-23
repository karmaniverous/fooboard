/**
 * Tests for the commit in cell detail (spec.md C-13, Decision 21): the
 * sheet shows every line of the record's message and the full SHA, which
 * *Copy* copies (saying whether it could); the tooltip shows the
 * message's first line and the short SHA.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { githubSet } from '@/domain/derivation/testFixtures';
import { resolveStatus } from '@/domain/statuses/resolved';
import type { BoardCell } from '@/engine';

import { CellDetail } from './CellDetail';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const MESSAGE = 'Fix the deploy\n\nThe role was missing.\nSee #12.';

const cell: BoardCell = {
  rowId: 'api',
  stageId: 'dev',
  settled: true,
  active: false,
  badge: undefined,
  derivation: {
    kind: 'ok',
    status: resolveStatus(githubSet, githubSet.cell[0]),
    branch: 'dev',
    commit: SHA,
    message: MESSAGE,
    document: { branch: 'dev' },
  },
};

const show = (interactive: boolean) =>
  render(
    <CellDetail
      cell={cell}
      rowName="api"
      stageName="Dev"
      interactive={interactive}
    />,
  );

/** The detail's value for the term `name`. */
const value = (name: string) => screen.getByText(name).nextElementSibling;

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('the commit in cell detail', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('shows every line of the message and the full SHA in the sheet', () => {
    show(true);
    expect(value('Message')?.textContent).toBe(MESSAGE);
    expect(value('Commit')).toHaveTextContent(SHA);
  });

  it('copies the full SHA, and says whether it could', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    clipboard(writeText);
    show(true);
    const copy = screen.getByRole('button', { name: 'Copy the commit SHA' });
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(SHA);
    expect(screen.getByRole('status')).toHaveTextContent('Copied');

    clipboard(() => Promise.reject(new Error('denied')));
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't copy");
  });

  it('shows only the first line and the short SHA in the tooltip', () => {
    show(false);
    expect(value('Message')?.textContent).toBe('Fix the deploy');
    expect(value('Commit')?.textContent).toBe(SHA.slice(0, 7));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
