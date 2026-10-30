/**
 * Tests for *Set up with an AI assistant* (spec 0.2.0 §3.J *The dialog*):
 * it shows production's address for `/ai` and the ready prompt, copies
 * each with its own button and says so, says how it works, and is opened
 * by the navigation item in the menu and the footer as well as the header
 * (the header button is pinned in `Header.test.tsx`).
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AI_PROMPT, site } from '@/lib/site';
import { clickToCopy, mockClipboard, unmockClipboard } from '@/test/clipboard';
import { renderShell } from '@/test/renderShell';

import { AI_SETUP, AI_SETUP_HOW, AiSetupDialog } from './AiSetupDialog';
import { Footer } from './Footer';

const dialog = () => screen.getByRole('dialog', { name: AI_SETUP });

afterEach(unmockClipboard);

describe('AiSetupDialog', () => {
  it("shows production's /ai, the prompt naming it, and how it works", () => {
    render(<AiSetupDialog open onOpenChange={() => undefined} />);
    expect(site.aiUrl).toBe('https://www.fooboard.dev/ai');
    expect(AI_PROMPT).toBe(
      'Read https://www.fooboard.dev/ai and help me set up a fooboard board.',
    );
    expect(
      within(dialog()).getByLabelText('Instructions for your assistant'),
    ).toHaveValue(site.aiUrl);
    expect(within(dialog()).getByLabelText('A prompt to paste')).toHaveValue(
      AI_PROMPT,
    );
    expect(dialog()).toHaveAccessibleDescription(AI_SETUP_HOW);
  });

  it.each([
    ['Copy link', () => site.aiUrl, 'Link copied.'],
    ['Copy prompt', () => AI_PROMPT, 'Prompt copied.'],
  ])('%s copies it and says so', async (button, text, said) => {
    const writeText = mockClipboard();
    render(<AiSetupDialog open onOpenChange={() => undefined} />);
    await clickToCopy(within(dialog()).getByRole('button', { name: button }));
    expect(writeText).toHaveBeenCalledWith(text());
    expect(within(dialog()).getByText(said)).toBeVisible();
  });

  it("says when the browser won't copy", async () => {
    mockClipboard(true);
    render(<AiSetupDialog open onOpenChange={() => undefined} />);
    await clickToCopy(
      within(dialog()).getByRole('button', { name: 'Copy link' }),
    );
    expect(within(dialog()).getByText(/Couldn't copy the link/)).toBeVisible();
  });

  it('opens from its footer link', () => {
    renderShell(<Footer />);
    fireEvent.click(screen.getByRole('button', { name: AI_SETUP }));
    expect(dialog()).toBeInTheDocument();
  });
});
