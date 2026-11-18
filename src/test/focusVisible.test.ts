/**
 * Tests for the `:focus-visible` support (`installFocusVisible`): focus
 * shows after a keypress or with no input, not after a press of the
 * pointer, except in a field that takes text; a modifier shortcut changes
 * nothing; other selectors and unfocused elements are untouched; the
 * restore puts jsdom's own matching back.
 *
 * @module
 */
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installFocusVisible, takesText } from './focusVisible';

let restore: () => void = () => undefined;

const visible = (el: Element) => el.matches(':focus-visible');

type Page = Record<'link' | 'other' | 'text' | 'box' | 'area', HTMLElement>;

function page(): Page {
  document.body.innerHTML = `
    <a href="#a" id="link">a</a>
    <a href="#b" id="other">b</a>
    <input id="text" type="text" />
    <input id="box" type="checkbox" />
    <textarea id="area"></textarea>`;
  const get = (id: string) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(id);
    return el;
  };
  return {
    link: get('link'),
    other: get('other'),
    text: get('text'),
    box: get('box'),
    area: get('area'),
  };
}

describe('installFocusVisible', () => {
  // The global setup installs one per test; these test a fresh one.
  beforeEach(() => {
    restore = installFocusVisible();
  });
  afterEach(() => {
    restore();
  });

  it('shows focus no input caused', () => {
    const { link, other } = page();
    link.focus();
    expect(visible(link)).toBe(true);
    expect(visible(other)).toBe(false);
  });

  it('hides focus a press of the pointer leaves behind', () => {
    const { link, other } = page();
    fireEvent.pointerDown(link);
    link.focus();
    expect(visible(link)).toBe(false);
    fireEvent.mouseDown(other);
    other.focus();
    expect(visible(other)).toBe(false);
  });

  it('shows focus again after a keypress, but not after a shortcut', () => {
    const { link, other } = page();
    fireEvent.mouseDown(link);
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    link.focus();
    expect(visible(link)).toBe(false);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    other.focus();
    expect(visible(other)).toBe(true);
  });

  it('always shows focus in a field that takes text', () => {
    const { text, box, area } = page();
    fireEvent.mouseDown(text);
    text.focus();
    expect(visible(text)).toBe(true);
    fireEvent.mouseDown(area);
    area.focus();
    expect(visible(area)).toBe(true);
    fireEvent.mouseDown(box);
    box.focus();
    expect(visible(box)).toBe(false);
    expect([text, area, box].map(takesText)).toEqual([true, true, false]);
  });

  it('leaves other selectors alone', () => {
    const { link } = page();
    fireEvent.mouseDown(link);
    link.focus();
    expect(link.matches(':focus')).toBe(true);
    expect(link.matches('a[href]')).toBe(true);
  });

  it('restores the matching it replaced, and stops listening', () => {
    const { link } = page();
    const method = (): unknown => Reflect.get(Element.prototype, 'matches');
    const before = method();
    const own = installFocusVisible();
    expect(method()).not.toBe(before);
    own();
    expect(method()).toBe(before);
    // The restored one's input no longer reaches the removed one: a fresh
    // install starts as a page does.
    fireEvent.mouseDown(link);
    link.focus();
    const fresh = installFocusVisible();
    expect(visible(link)).toBe(true);
    fresh();
  });
});
