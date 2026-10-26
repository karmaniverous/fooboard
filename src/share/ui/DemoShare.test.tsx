/**
 * Tests for sharing the demo (spec.md C-19, kept beside board sharing by
 * §3.8): the system share sheet only where the browser has one, *Copy
 * link* and its outcome, *Post on X* as a plain outbound link, and a
 * closed sheet left unsaid.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoUrl, postUrl } from '@/lib/share';

import { DemoShare } from './DemoShare';

const stubbed: string[] = [];
/** Give `navigator` a property for one test. */
const stub = (name: string, value: unknown) => {
  Object.defineProperty(navigator, name, { value, configurable: true });
  stubbed.push(name);
};
afterEach(() => {
  for (const name of stubbed.splice(0)) Reflect.deleteProperty(navigator, name);
});

const show = () => render(<DemoShare />);
/** Click a button and let its promise chain settle. */
const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('DemoShare', () => {
  it('copies the demo link and offers a pre-filled X post', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stub('clipboard', { writeText });
    show();
    expect(screen.queryByRole('button', { name: 'Share…' })).toBeNull();
    expect(screen.getByLabelText('Demo link')).toHaveValue(demoUrl());
    expect(screen.getByRole('link', { name: 'Post on X' })).toHaveAttribute(
      'href',
      postUrl(demoUrl()),
    );
    await press('Copy link');
    expect(writeText).toHaveBeenCalledWith(demoUrl());
    expect(screen.getByRole('status')).toHaveTextContent('Link copied.');
  });

  it('says so when the link could not be copied', async () => {
    stub('clipboard', { writeText: () => Promise.reject(new Error('denied')) });
    show();
    await press('Copy link');
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't copy");
  });

  const shareFails = async (error: DOMException) => {
    const share = vi.fn(() => Promise.reject(error));
    stub('share', share);
    show();
    await press('Share…');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: demoUrl() }),
    );
  };

  it('stays quiet when the share sheet is closed', async () => {
    await shareFails(new DOMException('x', 'AbortError'));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says so when sharing fails', async () => {
    await shareFails(new DOMException('x', 'NotAllowedError'));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't share");
  });
});
