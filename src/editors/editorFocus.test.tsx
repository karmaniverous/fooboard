/**
 * Tests for opening the editor at an item (spec.md A§4.3.7): a row's stage
 * override opened and marked; a check drafted from a record offered on the
 * rule and added; stage-rule overrides edited as general rules on a row
 * and a row group (the branch-pattern shortcut kept); item rules offered
 * for a source whose source rule reads items; and the Sources tab listing
 * the problems fixed there.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { all, is } from '@/domain/model/ruleBuilders';
import { problem } from '@/domain/problems/problem';
import type { EngineProviders } from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { DashboardEditor } from './DashboardEditor';
import type { EditorDraft } from './draft';

const start = DashboardSchema.parse({
  id: 'd',
  name: 'Board',
  rows: [
    {
      type: 'github',
      id: 'web',
      repo: 'acme/web',
      displayName: 'web',
      stageRules: { dev: all(is('$.workflow', 'Deploy')) },
    },
  ],
  rowGroups: [{ id: 'g', label: 'Front', memberIds: ['web'] }],
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
});
const providers: EngineProviders = {
  github: () => undefined,
  amplify: () => undefined,
};

function setup(
  initial: Dashboard,
  draft?: EditorDraft,
  extra: Partial<React.ComponentProps<typeof DashboardEditor>> = {},
) {
  const latest = { current: initial };
  function Harness(): React.JSX.Element {
    const [d, setD] = useState<Dashboard>(initial);
    return (
      <DashboardEditor
        dashboard={d}
        providers={providers}
        draft={draft}
        onChange={(next) => {
          latest.current = next;
          setD(next);
        }}
        {...extra}
      />
    );
  }
  render(
    <StoresContext value={createAppStores(memoryStorage())}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return latest;
}

describe('opening the editor at an item', () => {
  it("opens a row's stage override as a rule, and marks it", () => {
    setup(start, {
      tab: 'Rows',
      focus: ['row:web:stage:dev', 'row:web'],
    });
    const rule = screen.getByRole('group', {
      name: 'dev stage rule for web',
    });
    const details = rule.closest('details');
    expect(details?.open).toBe(true);
    expect(details?.className).toContain('ring-2');
    expect(
      screen.getByLabelText('Dev branch override for web'),
    ).toHaveAttribute('placeholder', 'a rule (below)');
  });

  it('offers a check drafted from the record on the focused rule', () => {
    const latest = setup(start, {
      tab: 'Rows',
      focus: ['row:web:record', 'row:web'],
      check: is('$.workflow', 'Nightly'),
    });
    const rule = screen.getByRole('group', { name: 'Record rule for web' });
    expect(
      within(rule).getByText('$.workflow matches Nightly'),
    ).toBeInTheDocument();
    fireEvent.click(
      within(rule).getByRole('button', { name: 'Add drafted check' }),
    );
    expect(latest.current.rows[0]?.recordRule).toEqual(
      all(is('$.workflow', 'Nightly')),
    );
    expect(
      within(rule).queryByRole('button', { name: 'Add drafted check' }),
    ).toBeNull();
  });
});

describe('overrides as general rules', () => {
  it("edits a row's stage override as a rule, keeping the pattern field", () => {
    const latest = setup(start, { tab: 'Rows', focus: ['row:web:stage:dev'] });
    const rule = screen.getByRole('group', { name: 'dev stage rule for web' });
    fireEvent.click(
      within(rule).getByRole('button', {
        name: 'Delete dev stage rule for web check 1',
      }),
    );
    expect(latest.current.rows[0]?.stageRules).toEqual({});
    const field = screen.getByLabelText('Dev branch override for web');
    fireEvent.change(field, { target: { value: 'rc/*' } });
    fireEvent.blur(field);
    expect(latest.current.rows[0]?.stageRules.dev?.checks[0]?.path).toBe(
      '$.branch',
    );
  });

  it("edits a row group's stage override per source", () => {
    const latest = setup(start, {
      tab: 'Rows',
      focus: ['rowGroup:g:stage:dev', 'rowGroup:g'],
    });
    const rules = screen.getByRole('group', {
      name: 'dev stage rules of Front: GitHub',
    });
    fireEvent.click(within(rules).getByRole('button', { name: 'Add check' }));
    expect(latest.current.rowGroups[0]?.stageRules.dev).toEqual({
      github: {
        combine: 'and',
        checks: [expect.objectContaining({ path: '$.' })],
      },
    });
  });
});

describe('item rules follow the source rule', () => {
  it('offers item rules and Only items where for a source with items', () => {
    const amplify = BUILTIN_SOURCES[1];
    const withItems = DashboardSchema.parse({
      ...start,
      rows: [
        {
          type: 'amplify',
          id: 'site',
          repo: 'acme/site',
          displayName: 'site',
          sources: [{ region: 'us-east-1', appId: 'a' }],
        },
      ],
      rowGroups: [],
      customSourceRules: [
        {
          ...amplify,
          id: 'mine',
          name: 'Mine',
          items: { path: '$.job.steps[*]', keys: [] },
        },
      ],
      sourceRules: { github: 'github', amplify: 'mine' },
    });
    setup(withItems, { tab: 'Rows' });
    expect(
      screen.getByRole('group', { name: 'Item rule for site' }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', { name: 'Record rule for site' }),
      ).getByText('Only items where'),
    ).toBeInTheDocument();
  });
});

describe('the Sources tab', () => {
  it('lists the problems fixed there', () => {
    setup(
      start,
      { tab: 'Sources' },
      {
        problems: [
          problem(
            { kind: 'cell', rowId: 'web', stageId: 'dev' },
            'read 100 runs',
            true,
            {
              target: { kind: 'source', provider: 'github' },
            },
          ),
          problem({ kind: 'stage', id: 'dev' }, 'elsewhere'),
        ],
      },
    );
    const list = screen.getByRole('list', { name: 'Source problems' });
    expect(within(list).getByText('read 100 runs')).toBeInTheDocument();
    expect(screen.queryByText('elsewhere')).toBeNull();
  });
});
