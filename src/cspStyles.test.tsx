/**
 * The CSP allows the `<style>` elements the UI kit injects, and nothing
 * more (spec.md §3.10): `style-src 'self'` blocks inline style elements,
 * so each one a Radix primitive adds is allowed by the hash of its exact
 * text in `customHttp.yml`. This renders the app's modal (whose scroll lock
 * comes from react-remove-scroll-bar, as in every Dialog, Sheet,
 * AlertDialog, Popover and menu) with the app's Select open in it, collects
 * every `<style>` in the document and checks the policy's hashes are
 * exactly theirs, so a library upgrade that changes a text fails here
 * rather than in the browser.
 *
 * The scroll lock's text names the page's scroll-bar width; it is rendered
 * as on a page with no scroll bar (body margin 0 as in the app's
 * stylesheet, the viewport as wide as the document), the case a hash can
 * cover.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import customHttp from '../customHttp.yml?raw';
import { parseCustomHttp } from '../vite/hosting';
import { Choice } from './components/Choice';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import { cspDirectives } from './test/csp';

/** The CSP's `style-src` sources. */
const styleSrc =
  new Map(
    cspDirectives(parseCustomHttp(customHttp)['Content-Security-Policy']),
  ).get('style-src') ?? [];

/** The CSP source that allows a `<style>` with this text. */
const hashSource = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
};

/** The text of every `<style>` in the document. */
const styleTexts = (): string[] =>
  [...document.querySelectorAll('style')].map((s) => s.textContent);

describe('injected styles under the CSP', () => {
  beforeEach(() => {
    document.body.style.margin = '0';
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      window.innerWidth,
    );
  });
  afterEach(() => {
    document.body.style.margin = '';
    vi.restoreAllMocks();
  });

  it("allows exactly the modal's scroll lock and the Select's style", async () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
          <Choice
            label="Pick"
            value="a"
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
            onValueChange={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    );
    const texts = new Set(styleTexts());
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Pick' }), {
      key: 'Enter',
    });
    for (const text of styleTexts()) texts.add(text);
    fireEvent.keyDown(screen.getAllByRole('option')[0], { key: 'Escape' });
    expect(texts.size).toBe(2);
    const seen = new Set(await Promise.all([...texts].map(hashSource)));
    expect(new Set(styleSrc.filter((s) => s.startsWith("'sha256-")))).toEqual(
      seen,
    );
  });
});
