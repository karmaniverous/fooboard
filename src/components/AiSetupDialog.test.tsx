/**
 * Tests for *Set up with an AI assistant* (spec 0.2.0 §3.J *The dialog*,
 * *The dialog uses the current site*; Decision 107): on production it
 * shows production's `/ai` and the prompt naming it, with no
 * *Copy instructions*; on any other site it shows that site's `/ai`, says
 * an assistant can't reach it, copies the site's own `/ai.md` with
 * *Copy instructions*, and its prompt refers to the pasted instructions
 * and has the link built on that site. Each button copies and says so,
 * and says when it couldn't; the navigation item in the menu and the
 * footer opens it as well as the header (the header button is pinned in
 * `Header.test.tsx`).
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PRODUCTION_ORIGIN, site } from '@/lib/site';
import { clickToCopy, mockClipboard, unmockClipboard } from '@/test/clipboard';
import { renderShell } from '@/test/renderShell';

import aiMd from '../../public/ai.md?raw';
import {
  AI_SETUP,
  AI_SETUP_HOW,
  AI_SETUP_UNREACHABLE,
  AiSetupDialog,
} from './AiSetupDialog';
import { Footer } from './Footer';

const dialog = () => screen.getByRole('dialog', { name: AI_SETUP });
const field = (label: string) => within(dialog()).getByLabelText(label);
const button = (name: string) => within(dialog()).getByRole('button', { name });

/** The dialog on the site at `origin` (this page's when left out). */
const renderAt = (origin?: string, load?: () => Promise<string>) =>
  render(
    <AiSetupDialog
      open
      onOpenChange={() => undefined}
      {...(origin === undefined ? {} : { origin })}
      {...(load ? { load } : {})}
    />,
  );

/** Click *Copy instructions*, then let its load and copy settle. */
async function copyInstructions(): Promise<void> {
  fireEvent.click(button('Copy instructions'));
  await within(dialog()).findByText(/^(Instructions copied|Couldn't copy)/);
}

afterEach(unmockClipboard);

describe('AiSetupDialog on production', () => {
  it("shows production's /ai, the prompt naming it, and how it works", () => {
    renderAt(PRODUCTION_ORIGIN);
    expect(field('Instructions for your assistant')).toHaveValue(
      'https://www.fooboard.dev/ai',
    );
    expect(field('A prompt to paste')).toHaveValue(
      'Read https://www.fooboard.dev/ai and help me set up a fooboard board.',
    );
    expect(dialog()).toHaveAccessibleDescription(AI_SETUP_HOW);
  });

  it('offers no Copy instructions, since an assistant can read it', () => {
    renderAt(PRODUCTION_ORIGIN);
    expect(
      within(dialog()).queryByRole('button', { name: 'Copy instructions' }),
    ).toBeNull();
    expect(within(dialog()).queryByText(AI_SETUP_UNREACHABLE)).toBeNull();
  });

  it.each([
    ['Copy link', 'https://www.fooboard.dev/ai', 'Link copied.'],
    [
      'Copy prompt',
      'Read https://www.fooboard.dev/ai and help me set up a fooboard board.',
      'Prompt copied.',
    ],
  ])('%s copies it and says so', async (name, text, said) => {
    const writeText = mockClipboard();
    renderAt(PRODUCTION_ORIGIN);
    await clickToCopy(button(name));
    expect(writeText).toHaveBeenCalledWith(text);
    expect(within(dialog()).getByText(said)).toBeVisible();
  });

  it("says when the browser won't copy", async () => {
    mockClipboard(true);
    renderAt(PRODUCTION_ORIGIN);
    await clickToCopy(button('Copy link'));
    expect(within(dialog()).getByText(/Couldn't copy the link/)).toBeVisible();
  });
});

describe('AiSetupDialog on another site', () => {
  const DEV = 'https://dev.fooboard.dev';

  it("shows this page's own /ai, not production's", () => {
    renderAt();
    expect(window.location.origin).not.toBe(PRODUCTION_ORIGIN);
    expect(field('Instructions for your assistant')).toHaveValue(
      `${window.location.origin}/ai`,
    );
  });

  it("shows the site's /ai, says an assistant can't reach it, and prompts for the pasted instructions with the link on this site", () => {
    renderAt(DEV);
    expect(field('Instructions for your assistant')).toHaveValue(
      'https://dev.fooboard.dev/ai',
    );
    expect(within(dialog()).getByText(AI_SETUP_UNREACHABLE)).toBeVisible();
    expect(field('A prompt to paste')).toHaveValue(
      'Use the fooboard instructions I pasted to help me set up a fooboard board. Build its link on https://dev.fooboard.dev/.',
    );
    expect(dialog()).not.toHaveTextContent(site.aiUrl);
  });

  it("Copy instructions copies this site's /ai.md in full and says so", async () => {
    const writeText = mockClipboard();
    renderAt(DEV);
    await copyInstructions();
    expect(writeText).toHaveBeenCalledWith(aiMd);
    expect(aiMd).toMatch(/^# fooboard: set up a board, for AI assistants/);
    expect(
      within(dialog()).getByText(
        'Instructions copied. Paste them into your assistant, then the prompt.',
      ),
    ).toBeVisible();
  });

  it("says where to find the instructions when they can't be loaded", async () => {
    const writeText = mockClipboard();
    renderAt(DEV, () => Promise.reject(new Error('offline')));
    await copyInstructions();
    expect(writeText).not.toHaveBeenCalled();
    expect(
      within(dialog()).getByText(
        "Couldn't copy the instructions. Open https://dev.fooboard.dev/ai and copy them yourself.",
      ),
    ).toBeVisible();
  });

  it('starts loading the instructions as it opens', () => {
    const load = vi.fn(() => Promise.resolve('instructions'));
    renderAt(DEV, load);
    expect(load).toHaveBeenCalled();
  });
});

describe('opening AiSetupDialog', () => {
  it('opens from its footer link', () => {
    renderShell(<Footer />);
    fireEvent.click(screen.getByRole('button', { name: AI_SETUP }));
    expect(dialog()).toBeInTheDocument();
  });
});
