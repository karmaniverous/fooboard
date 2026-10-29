/**
 * The first run's note on the board (spec 0.2.0 §3.A): it names the
 * icon-only *Unmapped runs (N)* button with its icon inline before the
 * name (decorative), says where unmapped runs will go while there are
 * none, and names *Edit dashboard*.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FirstRunNote } from './FirstRunNote';

const renderNote = (unmapped: number): HTMLElement => {
  render(
    <FirstRunNote unmapped={unmapped} problems={0} onDone={() => undefined} />,
  );
  return screen.getByText(/^Cells fill in/);
};

describe('FirstRunNote', () => {
  it('names Unmapped runs (N) after its icon', () => {
    const note = renderNote(3);
    expect(note).toHaveTextContent(
      '3 runs land in no cell: Unmapped runs (3) lists them, with a fix for each.',
    );
    const icon = note.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    let after = '';
    for (let n = icon?.nextSibling; n; n = n.nextSibling)
      after += n.textContent ?? '';
    expect(after.trimStart()).toMatch(/^Unmapped runs \(3\)/);
  });

  it('says where unmapped runs will go while there are none, with no icon', () => {
    const note = renderNote(0);
    expect(note).toHaveTextContent(
      'Runs that land in no cell will be listed under Unmapped runs.',
    );
    expect(note.querySelector('svg')).toBeNull();
  });

  it('names Edit dashboard for changes', () => {
    expect(renderNote(0)).toHaveTextContent(
      'Change anything with Edit dashboard.',
    );
  });
});
