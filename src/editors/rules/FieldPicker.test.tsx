/**
 * Tests for the field picker's limits: values are previewed up to
 * PREVIEW_LENGTH characters, and the tree opens MAX_DEPTH levels deep.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSONValue } from 'json-p3';
import { describe, expect, it, vi } from 'vitest';

import { FieldPicker, MAX_DEPTH, PREVIEW_LENGTH } from './FieldPicker';

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
    const shown = JSON.stringify(long).slice(0, PREVIEW_LENGTH);
    expect(screen.getByText(`${shown}...`)).toBeInTheDocument();
  });

  it('opens MAX_DEPTH levels and writes the picked path', () => {
    const onPick = vi.fn();
    render(
      <FieldPicker label="F" doc={nested(MAX_DEPTH + 1)} onPick={onPick} />,
    );
    const deepest = `k${String(MAX_DEPTH)}`;
    expect(screen.queryByText(`k${String(MAX_DEPTH + 1)}`)).toBeNull();
    fireEvent.click(screen.getByText(deepest));
    expect(onPick).toHaveBeenCalledWith(
      `$${Array.from({ length: MAX_DEPTH + 1 }, (_, i) => `.k${String(i)}`).join('')}`,
    );
  });
});
