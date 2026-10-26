/**
 * The font size each piece of board text is drawn at, worked out the way
 * a browser would from what the board sets, since jsdom applies no
 * stylesheet: an element's size is its inline `font-size`, else an
 * arbitrary Tailwind size class (`text-[0.8em]`), else its parent's;
 * `em` is of the parent's size and `var(--x)` reads the nearest
 * ancestor's custom property. The board's root size is set inline
 * (`boardTextStyle`), so every size resolves within the board.
 *
 * @module
 */

/** Tailwind's arbitrary size class, as the board used before N5a. */
const SIZE_CLASS = /(?:^|\s)text-\[(\d*\.?\d+(?:px|em))\]/;
const VAR = /^var\((--[\w-]+)\)$/;
const LENGTH = /^(\d*\.?\d+)(px|em)$/;

/** The size an element sets for itself, if any, with variables read. */
function ownSize(el: HTMLElement): string | undefined {
  const set = el.style.fontSize || SIZE_CLASS.exec(el.className)?.[1];
  const name = set && VAR.exec(set)?.[1];
  if (!name) return set || undefined;
  for (let a: HTMLElement | null = el; a; a = a.parentElement) {
    const value = a.style.getPropertyValue(name);
    if (value) return value.trim();
  }
  throw new Error(`${name} is not set above the element`);
}

/** The font size `el` is drawn at, in px. */
function fontPx(el: HTMLElement): number {
  const size = ownSize(el);
  const parent = el.parentElement;
  if (!size) {
    if (!parent) throw new Error('no font size set on the board');
    return fontPx(parent);
  }
  const [, n, unit] = LENGTH.exec(size) ?? [];
  if (!n) throw new Error(`unreadable font size: ${size}`);
  if (unit === 'px') return Number(n);
  if (!parent) throw new Error('an em size with nothing above it');
  return Number(n) * fontPx(parent);
}

/** Every element inside `root` that shows text of its own, with its text
 * and the size it is drawn at. */
export function textSizes(
  root: HTMLElement,
): { text: string; px: number; el: HTMLElement }[] {
  return [...root.querySelectorAll<HTMLElement>('*')].flatMap((el) => {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    return text ? [{ text, px: fontPx(el), el }] : [];
  });
}
