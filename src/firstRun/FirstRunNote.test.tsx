/**
 * The first run's note on the board (spec 0.2.0 §3.A, *First-run note
 * icons*): it names each icon-only button it mentions (*Unmapped runs
 * (N)*, *Problems (N)*, *Edit dashboard*) with the button's icon inline
 * before the name (decorative), and says where unmapped runs and rule
 * problems will go while there are none, with no icon (there's no button
 * yet).
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FirstRunNote } from './FirstRunNote';

const renderNote = (unmapped: number, problems = 0): HTMLElement => {
  render(
    <FirstRunNote
      unmapped={unmapped}
      problems={problems}
      onDone={() => undefined}
    />,
  );
  return screen.getByText(/^Cells fill in/);
};

/** The decorative icons in `note`, each as the lucide icon it is and the
 * text that follows it up to the next icon. */
function iconsIn(note: HTMLElement): { icon: string; before: string }[] {
  return [...note.querySelectorAll('svg')].map((svg) => {
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    let text = '';
    for (let n = svg.nextSibling; n && n.nodeName !== 'svg'; n = n.nextSibling)
      text += n.textContent ?? '';
    const icon =
      [...svg.classList].find((c) => c.startsWith('lucide-')) ?? 'none';
    return { icon, before: text.trimStart() };
  });
}

describe('FirstRunNote', () => {
  it('names Unmapped runs (N), Problems (N) and Edit dashboard after their icons', () => {
    const note = renderNote(3, 2);
    expect(note).toHaveTextContent(
      '3 runs land in no cell: Unmapped runs (3) lists them, with a fix for each. ' +
        '2 rule problems are marked ! on the board and listed under Problems (2). ' +
        'Change anything with Edit dashboard.',
    );
    const icons = iconsIn(note);
    expect(icons.map((i) => i.icon)).toEqual([
      'lucide-unlink',
      'lucide-triangle-alert',
      'lucide-pencil',
    ]);
    expect(icons[0]?.before).toMatch(/^Unmapped runs \(3\)/);
    expect(icons[1]?.before).toMatch(/^Problems \(2\)/);
    expect(icons[2]?.before).toMatch(/^Edit dashboard/);
  });

  it('says where unmapped runs and problems will go while there are none, with only Edit dashboard’s icon', () => {
    const note = renderNote(0);
    expect(note).toHaveTextContent(
      'Runs that land in no cell will be listed under Unmapped runs.',
    );
    expect(note).toHaveTextContent(
      'No rule problems so far; any would be marked ! and listed under Problems.',
    );
    expect(iconsIn(note).map((i) => i.icon)).toEqual(['lucide-pencil']);
  });
});
