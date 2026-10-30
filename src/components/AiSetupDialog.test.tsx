/**
 * Tests for *Set up with an AI assistant* (spec 0.2.0 §3.J *The dialog
 * uses the current site*, *The dialog's layout, revised*, *Copy buttons*;
 * Decisions 107 and 108): exactly two rows, the site's `/ai` address with
 * *Open instructions in a new tab*, *Copy link* and *Copy instructions*,
 * and "Follow the instructions at \{address\}" with *Copy prompt*, the same
 * on every site; each button's value; a copy's green check that reverts
 * after `COPIED_FEEDBACK_MS`, with "Copied" announced and no visible text;
 * a failed copy keeping its icon and announcing why; each button's name as
 * its tooltip; and the footer link opening it (the header button is
 * pinned in `Header.test.tsx`).
 *
 * @module
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PRODUCTION_ORIGIN, site } from '@/lib/site';
import { clickToCopy, mockClipboard, unmockClipboard } from '@/test/clipboard';
import { focusElement } from '@/test/focus';
import { renderShell } from '@/test/renderShell';
import { WAIT } from '@/test/timeouts';

import aiMd from '../../public/ai.md?raw';
import {
  AI_INSTRUCTIONS_LABEL,
  AI_PROMPT_LABEL,
  AI_SETUP,
  AI_SETUP_HOW,
  AiSetupDialog,
  OPEN_INSTRUCTIONS,
} from './AiSetupDialog';
import { COPIED, COPIED_FEEDBACK_MS } from './CopyButton';
import { Footer } from './Footer';

const DEV = 'https://dev.fooboard.dev';

const dialog = () => screen.getByRole('dialog', { name: AI_SETUP });
const field = (label: string) => within(dialog()).getByLabelText(label);
const button = (name: string) => within(dialog()).getByRole('button', { name });
const announced = () =>
  within(dialog())
    .getAllByRole('status')
    .map((s) => s.textContent)
    .filter(Boolean);
const checked = (name: string) =>
  button(name).querySelector('[data-copied]') !== null;

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

/** The names of the controls beside a row's text box, in order. */
const rowControls = (label: string) =>
  [...(field(label).parentElement?.querySelectorAll('a, button') ?? [])].map(
    (control) => control.getAttribute('aria-label'),
  );

afterEach(() => {
  unmockClipboard();
  vi.useRealTimers();
});

describe('AiSetupDialog layout', () => {
  it.each([
    ['production', PRODUCTION_ORIGIN],
    ['dev', DEV],
    ['this page', undefined],
  ])(
    'holds the title, how it works and exactly the two rows on %s',
    (_site, origin) => {
      renderAt(origin);
      expect(dialog()).toHaveAccessibleDescription(AI_SETUP_HOW);
      expect(
        within(dialog())
          .getAllByRole('textbox')
          .map((box) => box.getAttribute('id') ?? ''),
      ).toEqual([field(AI_INSTRUCTIONS_LABEL).id, field(AI_PROMPT_LABEL).id]);
      expect(rowControls(AI_INSTRUCTIONS_LABEL)).toEqual([
        OPEN_INSTRUCTIONS,
        'Copy link',
        'Copy instructions',
      ]);
      expect(rowControls(AI_PROMPT_LABEL)).toEqual(['Copy prompt']);
      expect(dialog()).not.toHaveTextContent(/can't reach/i);
    },
  );

  it("shows the site's own /ai and the prompt pointing at it", () => {
    renderAt(DEV);
    expect(field(AI_INSTRUCTIONS_LABEL)).toHaveValue(`${DEV}/ai`);
    expect(field(AI_PROMPT_LABEL)).toHaveValue(
      `Follow the instructions at ${DEV}/ai`,
    );
    expect(dialog()).not.toHaveTextContent(site.aiUrl);
  });

  it("shows this page's /ai when no origin is given, not production's", () => {
    renderAt();
    expect(window.location.origin).not.toBe(PRODUCTION_ORIGIN);
    expect(field(AI_INSTRUCTIONS_LABEL)).toHaveValue(
      `${window.location.origin}/ai`,
    );
  });

  it('opens the instructions in a new tab, without an opener or referrer', () => {
    renderAt(PRODUCTION_ORIGIN);
    const open = within(dialog()).getByRole('link', {
      name: OPEN_INSTRUCTIONS,
    });
    expect(open).toHaveAttribute('href', `${PRODUCTION_ORIGIN}/ai`);
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // The board's action buttons' tooltip (`WithTooltip`), its text the
  // accessible name, on hover and on keyboard focus.
  describe.each([
    [
      'hover',
      (control: HTMLElement) => {
        fireEvent.pointerMove(control, { pointerType: 'mouse' });
      },
    ],
    ['focus', focusElement],
  ])('on %s', (_how, reach) => {
    it.each([
      OPEN_INSTRUCTIONS,
      'Copy link',
      'Copy instructions',
      'Copy prompt',
    ])('%s shows its name as a tooltip', async (name) => {
      renderAt(DEV);
      const control = within(dialog()).getByRole(
        name === OPEN_INSTRUCTIONS ? 'link' : 'button',
        { name },
      );
      reach(control);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(name);
      expect(screen.getByRole('tooltip').textContent).toBe(name);
    });
  });
});

describe('AiSetupDialog copy buttons', () => {
  it.each([
    ['Copy link', `${DEV}/ai`],
    ['Copy prompt', `Follow the instructions at ${DEV}/ai`],
  ])('%s copies %s', async (name, text) => {
    const writeText = mockClipboard();
    renderAt(DEV);
    await clickToCopy(button(name));
    expect(writeText).toHaveBeenCalledWith(text);
  });

  it("Copy instructions copies this site's /ai.md in full", async () => {
    const writeText = mockClipboard();
    renderAt(DEV);
    fireEvent.click(button('Copy instructions'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(aiMd);
    }, WAIT);
    expect(aiMd).toMatch(/^# fooboard: set up a board, for AI assistants/);
  });

  it('turns the icon into a check, announces Copied with no visible text, then reverts', async () => {
    vi.useFakeTimers();
    mockClipboard();
    renderAt(DEV);
    await clickToCopy(button('Copy link'));
    expect(checked('Copy link')).toBe(true);
    // The green whose contrast theme.test.ts checks.
    expect(button('Copy link').querySelector('[data-copied]')).toHaveClass(
      'text-status-success',
    );
    expect(announced()).toEqual([COPIED]);
    expect(button('Copy link')).toHaveTextContent('');
    for (const status of within(dialog()).getAllByRole('status'))
      expect(status).toHaveClass('sr-only');
    act(() => {
      vi.advanceTimersByTime(COPIED_FEEDBACK_MS - 1);
    });
    expect(checked('Copy link')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(checked('Copy link')).toBe(false);
    expect(announced()).toEqual([]);
  });

  it('restarts the check when copied again before it reverts', async () => {
    vi.useFakeTimers();
    mockClipboard();
    renderAt(DEV);
    await clickToCopy(button('Copy prompt'));
    act(() => {
      vi.advanceTimersByTime(COPIED_FEEDBACK_MS - 1);
    });
    await clickToCopy(button('Copy prompt'));
    act(() => {
      vi.advanceTimersByTime(COPIED_FEEDBACK_MS - 1);
    });
    expect(checked('Copy prompt')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(checked('Copy prompt')).toBe(false);
  });

  it("keeps the icon and announces the failure when the browser won't copy", async () => {
    mockClipboard(true);
    renderAt(DEV);
    await clickToCopy(button('Copy link'));
    expect(checked('Copy link')).toBe(false);
    expect(announced()).toEqual([
      "Couldn't copy the link. Select it and copy it yourself.",
    ]);
  });

  it("says where to find the instructions when they can't be loaded", async () => {
    const writeText = mockClipboard();
    renderAt(DEV, () => Promise.reject(new Error('offline')));
    fireEvent.click(button('Copy instructions'));
    await waitFor(() => {
      expect(announced()).toEqual([
        `Couldn't copy the instructions. Open ${DEV}/ai and copy them yourself.`,
      ]);
    }, WAIT);
    expect(writeText).not.toHaveBeenCalled();
    expect(checked('Copy instructions')).toBe(false);
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
