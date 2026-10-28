/**
 * Tests for the stages step's preview: each stage's name, branch pattern
 * and how many repos have a branch it matches; a stage without a GitHub
 * branch rule matches no branch; no stages, no list.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchRules } from '@/domain/config/placement';

import { StagePreview } from './StagePreview';

const byRepo = new Map([
  ['acme/api', ['dev', 'main']],
  ['acme/web', ['main']],
]);

describe('StagePreview', () => {
  it('counts the repos with a matching branch, and none without a branch rule', () => {
    render(
      <StagePreview
        byRepo={byRepo}
        stages={[
          { id: 'dev', name: 'dev', rules: branchRules('dev'), settings: {} },
          { id: 'site', name: 'site', rules: {}, settings: {} },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      [
        'dev, branch dev, in 1 of 2 repos',
        'site, branch , no branch matches yet',
      ],
    );
  });

  it('shows nothing for no stages', () => {
    const { container } = render(<StagePreview byRepo={byRepo} stages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
