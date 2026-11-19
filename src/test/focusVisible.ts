/**
 * Test support: `:focus-visible` as browsers match it. jsdom 31's selector
 * engine matches `:focus-visible` wherever `:focus` matches, so it can't
 * tell focus a click leaves behind from the keyboard's, which the board
 * relies on (the cell gear and the dwell boost, spec.md §3.10, §3.H).
 * Browsers decide by the last input: after a keypress, focus is visible;
 * after a press of the pointer, it is not, except in a field you type
 * into; focus no input caused (a script's) is visible. `installFocusVisible`
 * makes `Element.matches(':focus-visible')`, the form the app uses, follow
 * that rule.
 *
 * @module
 */

/** Which kind of input last happened. */
type Modality = 'keyboard' | 'pointer';

/** Fields that show their focus however they were focused. */
const TYPED = 'textarea, [contenteditable=""], [contenteditable="true"]';

/** Input types that take no typed text, so follow the last input. */
const UNTYPED_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Whether `element` takes typed text, so always shows its focus. */
export const takesText = (element: Element): boolean =>
  element instanceof HTMLInputElement
    ? !UNTYPED_INPUTS.has(element.type)
    : element.matches(TYPED);

/** Make `:focus-visible` follow the last input, as in browsers; returns
 * the restore. */
export function installFocusVisible(doc: Document = document): () => void {
  let modality: Modality = 'keyboard';
  const onKey = (event: KeyboardEvent) => {
    // A shortcut held with a modifier doesn't make focus visible.
    if (!event.metaKey && !event.ctrlKey && !event.altKey)
      modality = 'keyboard';
  };
  const onPointer = () => {
    modality = 'pointer';
  };
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('mousedown', onPointer, true);

  const proto = Element.prototype;
  // The matching this replaces, kept as its property so the restore puts
  // back exactly that.
  const replaced = Object.getOwnPropertyDescriptor(proto, 'matches');
  const original: unknown = replaced?.value;
  if (!replaced || !(original instanceof Function))
    throw new Error('Element.prototype.matches is not a method');
  const match = (el: Element, selectors: string): boolean =>
    Boolean(Reflect.apply(original, el, [selectors]));
  Object.defineProperty(proto, 'matches', {
    ...replaced,
    value(this: Element, selectors: string): boolean {
      if (selectors !== ':focus-visible') return match(this, selectors);
      return (
        match(this, ':focus') && (modality === 'keyboard' || takesText(this))
      );
    },
  });
  return () => {
    Object.defineProperty(proto, 'matches', replaced);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('pointerdown', onPointer, true);
    doc.removeEventListener('mousedown', onPointer, true);
  };
}
