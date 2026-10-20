/**
 * Tests for the Stages tab: a stage's name, its branch pattern written as
 * its stage rules, and its source stage, never one that would make a
 * cycle.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import type { EngineProviders } from '@/engine';
import { choose, optionsOf } from '@/test/choose';

import { StagesEditor } from './StagesEditor';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  stages: [
    { id: 'dev', name: 'dev', rules: branchRules('dev') },
    {
      id: 'prod',
      name: 'prod',
      rules: branchRules('main'),
      sourceStageId: 'dev',
    },
  ],
});
const providers: EngineProviders = {
  github: () => undefined,
  amplify: () => undefined,
};

function setup() {
  const latest = { current: start };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(start);
    return (
      <StagesEditor
        dashboard={d}
        providers={providers}
        onChange={(next) => {
          latest.current = next;
          setD(next);
        }}
      />
    );
  }
  render(<Harness />);
  return latest;
}

const commit = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe('StagesEditor', () => {
  it('renames a stage and writes its branch pattern as its stage rules', () => {
    const latest = setup();
    commit('Name of dev', 'develop');
    expect(latest.current.stages[0]?.name).toBe('develop');
    commit('Branch pattern of develop', 'release/*');
    expect(latest.current.stages[0]?.rules).toEqual(branchRules('release/*'));
    expect(screen.getByLabelText('Branch pattern of develop')).toHaveValue(
      'release/*',
    );
  });

  it('offers only source stages that make no cycle, and clears one', () => {
    const latest = setup();
    const devSource = screen.getByLabelText('Source stage of dev');
    expect(optionsOf(devSource)).toEqual(['No source stage']);
    choose(screen.getByLabelText('Source stage of prod'), 'No source stage');
    expect(latest.current.stages[1]?.sourceStageId).toBeUndefined();
    choose(screen.getByLabelText('Source stage of dev'), 'Source: prod');
    expect(latest.current.stages[0]?.sourceStageId).toBe('prod');
  });
});
