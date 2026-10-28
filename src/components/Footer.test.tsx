/**
 * Tests for the footer (spec.md C-19): the copyright at the left, every
 * item as text while it fits, then icons dropping out from the left, with
 * Privacy and Terms always kept.
 *
 * @module
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeLayout } from '@/test/layout';
import { renderShell } from '@/test/renderShell';

import { Footer } from './Footer';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Lay the footer out `width` px wide: copyright 120 px, text 600 px,
 * icons 32 px every 36 px. */
const layOut = (width: number) => {
  fakeLayout({ tag: 'FOOTER', width }, (el) => {
    const name = el.getAttribute('data-measure');
    if (name === 'copyright') return { width: 120 };
    if (name === 'text') return { width: 600 };
    if (el.hasAttribute('data-icon-row')) return { width: 9 * 36 + 32 };
    const row = el.parentElement;
    if (row?.hasAttribute('data-icon-row'))
      return { left: [...row.children].indexOf(el) * 36, width: 32 };
    return {};
  });
};

const shown = () =>
  [
    ...screen
      .getByRole('navigation', { name: 'Footer' })
      .querySelectorAll('a, button'),
  ].map((e) => e.getAttribute('aria-label') ?? e.textContent);

describe('Footer', () => {
  it('shows the copyright and every item as text when there is room', () => {
    layOut(1000);
    renderShell(<Footer />);
    expect(screen.getByRole('link', { name: 'karmaniverous' })).toHaveAttribute(
      'href',
      'https://github.com/karmaniverous',
    );
    expect(shown()).toEqual([
      'News & support',
      'README',
      'Try the demo',
      'Theme: System',
      'Share / Export',
      'Import',
      'GitHub',
      'Report an issue',
      'Privacy',
      'Terms',
    ]);
  });

  it('drops icons from the left as it narrows', () => {
    // 120 px copyright + the row without its first three icons.
    layOut(120 + 9 * 36 + 32 - 3 * 36);
    renderShell(<Footer />);
    expect(shown()).toEqual([
      'Theme: System',
      'Share / Export',
      'Import',
      'GitHub',
      'Report an issue',
      'Privacy',
      'Terms',
    ]);
  });

  it('keeps Privacy and Terms at the narrowest', () => {
    layOut(130);
    renderShell(<Footer />);
    expect(shown()).toEqual(['Privacy', 'Terms']);
  });
});
