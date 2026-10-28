/**
 * Tests for the rule editor's preview: with the board's records, each
 * check and the rule say how many records (or items) they match, and the
 * path field offers the records' paths; a glob or regex check whose path
 * finds an object or array in them says to test a field inside it.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { all, is } from '@/domain/model/ruleBuilders';
import { OBJECT_OR_ARRAY_HINT } from '@/domain/rules/check';
import type { Check } from '@/domain/rules/schema';

import { RuleEditor } from './RuleEditor';
import { RuleSamplesContext } from './samples';

const records = [
  {
    workflow: 'CI',
    head: { sha: 'abc' },
    items: [{ name: 'deploy' }, { name: 'lint' }],
  },
  { workflow: 'Release', items: [{ name: 'deploy' }] },
];

const renderCheck = (check: Check) =>
  render(
    <RuleSamplesContext value={{ github: records }}>
      <RuleEditor
        label="H"
        provider="github"
        rule={all(check)}
        onChange={vi.fn()}
      />
    </RuleSamplesContext>,
  );

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

describe('RuleEditor object or array hint', () => {
  it.each([
    ['an object', '$.head'],
    ['an array', '$.items'],
  ])('says to test a field inside when the path finds %s', (_, path) => {
    renderCheck(is(path, 'x'));
    expect(screen.getByLabelText('H check 1 path')).toHaveAccessibleDescription(
      OBJECT_OR_ARRAY_HINT,
    );
  });

  it('shows no hint when the path finds a scalar', () => {
    renderCheck(is('$.head.sha', 'abc'));
    expect(screen.queryByText(OBJECT_OR_ARRAY_HINT)).toBeNull();
  });

  it('shows no hint for exists, which can test an object', () => {
    renderCheck({ ...is('$.head', 'x'), operator: 'exists' });
    expect(screen.queryByText(OBJECT_OR_ARRAY_HINT)).toBeNull();
  });
});
