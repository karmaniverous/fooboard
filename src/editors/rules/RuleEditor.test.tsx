/**
 * Tests for the rule editor's preview: with the board's records, each
 * check and the rule say how many records (or items) they match, and the
 * path field offers the records' paths.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { all, is } from '@/domain/model/ruleBuilders';

import { RuleEditor } from './RuleEditor';
import { RuleSamplesContext } from './samples';

const records = [
  { workflow: 'CI', items: [{ name: 'deploy' }, { name: 'lint' }] },
  { workflow: 'Release', items: [{ name: 'deploy' }] },
];

describe('RuleEditor preview', () => {
  it('counts matching records per check and for the rule', () => {
    render(
      <RuleSamplesContext value={{ github: records }}>
        <RuleEditor
          label="R"
          provider="github"
          rule={all(is('$.workflow', 'CI'))}
          onChange={vi.fn()}
        />
      </RuleSamplesContext>,
    );
    expect(screen.getByText('1 of 2 records')).toBeInTheDocument();
    expect(screen.getByText('Rule matches 1 of 2 records')).toBeInTheDocument();
    expect(screen.getByLabelText('R check 1 path')).toHaveAttribute(
      'list',
      'R-paths',
    );
  });

  it('counts items at item scope', () => {
    render(
      <RuleSamplesContext value={{ github: records }}>
        <RuleEditor
          label="I"
          provider="github"
          scope="item"
          rule={all(is('$.name', 'deploy'))}
          onChange={vi.fn()}
        />
      </RuleSamplesContext>,
    );
    expect(screen.getByText('Rule matches 2 of 3 items')).toBeInTheDocument();
  });

  it('shows no preview without records', () => {
    render(
      <RuleEditor
        label="N"
        provider="github"
        rule={all(is('$.workflow', 'CI'))}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Rule matches/)).toBeNull();
  });
});
