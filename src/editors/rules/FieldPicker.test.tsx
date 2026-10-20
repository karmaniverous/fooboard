/**
 * Tests for the field picker's limits: values are previewed up to
 * PREVIEW_LENGTH characters, and the tree opens MAX_DEPTH levels deep.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSONValue } from 'json-p3';
import { describe, expect, it, vi } from 'vitest';

import {
  FieldPicker,
  MAX_DEPTH,
  PREVIEW_LENGTH,
  SHOW_FIELDS,
} from './FieldPicker';

const openPicker = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Pick field' }));
};

/** `{ k0: { k1: ... { k<depth>: 'leaf' } } }`. */
const nested = (depth: number) => {
  let doc: JSONValue = 'leaf';
  for (let i = depth; i >= 0; i--) doc = { [`k${String(i)}`]: doc };
  return doc;
};

describe('FieldPicker', () => {
  it('previews a long value up to PREVIEW_LENGTH characters', () => {
    const long = 'x'.repeat(PREVIEW_LENGTH * 2);
    render(<FieldPicker label="F" doc={{ long }} onPick={vi.fn()} />);
    openPicker();
    const shown = JSON.stringify(long).slice(0, PREVIEW_LENGTH);
    expect(screen.getByText(`${shown}...`)).toBeInTheDocument();
  });

  it('opens MAX_DEPTH levels and writes the picked path', () => {
    const onPick = vi.fn();
    render(
      <FieldPicker label="F" doc={nested(MAX_DEPTH + 1)} onPick={onPick} />,
    );
    openPicker();
    // The top level is open; open each level below it.
    for (let i = 1; i < MAX_DEPTH; i++)
      fireEvent.click(
        screen.getByRole('button', { name: `${SHOW_FIELDS} k${String(i)}` }),
      );
    const deepest = `k${String(MAX_DEPTH)}`;
    expect(screen.queryByText(`k${String(MAX_DEPTH + 1)}`)).toBeNull();
    fireEvent.click(screen.getByText(deepest));
    expect(onPick).toHaveBeenCalledWith(
      `$${Array.from({ length: MAX_DEPTH + 1 }, (_, i) => `.k${String(i)}`).join('')}`,
    );
  });
});
