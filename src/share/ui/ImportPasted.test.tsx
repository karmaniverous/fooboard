/**
 * Tests for importing a pasted share link (spec.md §3.9 *Import from link
 * or file*): the dialog opened without a link takes one pasted in, read
 * as opening it would read it (its dashboards listed, imported on
 * *Import*), refuses text that isn't a share link as a damaged link, and
 * forgets it when the field is cleared.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { dialog, renderImport, savedIds, where } from '@/test/renderImport';
import { shareBoard } from '@/test/shareBoard';

import { buildEnvelope } from '../envelope';
import { shareLink } from '../link';

const board = shareBoard();
const paste = (text: string) => {
  fireEvent.change(
    within(dialog()).getByLabelText('Or a fooboard link, or its JSON'),
    {
      target: { value: text },
    },
  );
};

describe('the import dialog, from a pasted link', () => {
  it('lists the dashboards a pasted link holds and imports them', async () => {
    const stores = renderImport();
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    paste(
      `  ${shareLink(buildEnvelope([board], null), 'https://fooboard.dev')}  `,
    );
    expect(
      within(dialog()).getByText('This link holds 1 dashboard.'),
    ).toBeVisible();
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }));
      await Promise.resolve();
    });
    expect(savedIds(stores)).toEqual([board.id]);
    expect(where()).toBe(`/d/${board.id}`);
  });

  it.each([
    ['text with no share in it', 'https://example.com/#a=1'],
    ['a damaged share', 'https://fooboard.dev/#b=%E2%98%83'],
  ])('refuses %s as a damaged link, and forgets it when cleared', (_, text) => {
    renderImport();
    fireEvent.click(screen.getByRole('button', { name: 'Open import' }));
    paste(text);
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      "This link isn't a fooboard board, or it's damaged.",
    );
    expect(
      within(dialog()).getByText(
        'Ask whoever sent it for a new link, or for a file.',
      ),
    ).toBeVisible();
    paste('');
    expect(within(dialog()).queryByRole('alert')).toBeNull();
  });
});
