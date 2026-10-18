/**
 * Tests for the Share button (spec.md C-19): the system share sheet only
 * where the browser has one, *Copy link* and its outcome, and *Post on X*
 * as a plain outbound link.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoUrl, postUrl } from '@/lib/share';
import { site } from '@/lib/site';

import { ShareButton } from './ShareButton';

const stubbed: string[] = [];
/** Give `navigator` a property for one test. */
const stub = (name: string, value: unknown) => {
  Object.defineProperty(navigator, name, { value, configurable: true });
  stubbed.push(name);
};
afterEach(() => {
  for (const name of stubbed.splice(0)) Reflect.deleteProperty(navigator, name);
});

const open = () => {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Share' }), {
    key: 'Enter',
  });
};
const copy = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('ShareButton', () => {
  it('copies the demo link and offers a pre-filled X post', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stub('clipboard', { writeText });
    render(<ShareButton />);
    open();
    expect(screen.queryByRole('menuitem', { name: 'Share…' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Post on X' })).toHaveAttribute(
      'href',
      postUrl(demoUrl()),
    );
    await copy();
    expect(writeText).toHaveBeenCalledWith(demoUrl());
    expect(
      screen.getByRole('button', { name: 'Link copied' }),
    ).toBeInTheDocument();
  });

  it('says so when the link could not be copied', async () => {
    stub('clipboard', { writeText: () => Promise.reject(new Error('denied')) });
    render(<ShareButton />);
    open();
    await copy();
    expect(
      screen.getByRole('button', { name: "Couldn't copy" }),
    ).toBeInTheDocument();
  });

  it('opens the system share sheet where there is one', () => {
    const share = vi.fn(() => Promise.resolve());
    stub('share', share);
    render(<ShareButton />);
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share…' }));
    expect(share).toHaveBeenCalledWith({
      title: site.name,
      text: site.tagline,
      url: demoUrl(),
    });
  });
});
