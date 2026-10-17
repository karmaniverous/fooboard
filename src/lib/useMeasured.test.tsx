/**
 * Tests for measured layout: the value follows the measure function and
 * re-measures on render.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { measuredWidth, useMeasured } from './useMeasured';

function Probe({ limit }: { limit: number }): React.JSX.Element {
  const [ref, fits] = useMeasured<HTMLDivElement, boolean>(
    (el) => measuredWidth(el, 'x') <= limit,
    false,
  );
  return (
    <div ref={ref}>
      <span data-measure="x" />
      <output>{fits ? 'fits' : 'no'}</output>
    </div>
  );
}

describe('useMeasured', () => {
  it('measures after render and follows the measure function', () => {
    const { rerender } = render(<Probe limit={10} />);
    expect(screen.getByRole('status').textContent).toBe('fits');
    rerender(<Probe limit={-1} />);
    expect(screen.getByRole('status').textContent).toBe('no');
  });

  it('reads 0 for a missing element', () => {
    expect(measuredWidth(document.createElement('div'), 'none')).toBe(0);
  });
});
