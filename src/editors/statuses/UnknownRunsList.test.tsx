/**
 * Tests for the Unknown runs list: nothing when there are none; each run
 * with its set and document, and *Add status* for that run.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expand } from '@/test/openItem';

import type { UnknownCell } from './unknownRuns';
import { UnknownRunsList } from './UnknownRunsList';

const cell: UnknownCell = {
  rowId: 'api',
  rowName: 'api',
  stageId: 'prod',
  stageName: 'Prod',
  setName: 'GitHub single job',
  document: { workflow: 'Release' },
};

describe('UnknownRunsList', () => {
  it('renders nothing without Unknown runs', () => {
    const { container } = render(
      <UnknownRunsList unknown={[]} onAddStatus={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each run and adds a status for it', () => {
    const onAddStatus = vi.fn();
    render(<UnknownRunsList unknown={[cell]} onAddStatus={onAddStatus} />);
    expect(screen.getByText('Runs no status matches (1)')).toBeInTheDocument();
    // The document shows once the run is opened.
    expect(screen.queryByText(/"workflow": "Release"/)).toBeNull();
    expand('api · Prod');
    expect(screen.getByText(/"workflow": "Release"/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add status for api Prod' }),
    );
    expect(onAddStatus).toHaveBeenCalledWith(cell);
  });
});
