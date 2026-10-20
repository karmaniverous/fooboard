/**
 * Tests for the field picker and previews over real data (spec.md
 * A§4.3.7 *Editing rules*): the picker is a tree over a real record (an
 * Unknown one first), raw data included, writing the picked path into the
 * check; translation rules preview over the records' raw data, the Amplify
 * branch rule over the branch lists read; raw samples and Unknown-first
 * board samples.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UNKNOWN_STATUS_ID } from '@/domain/config/statusSets';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { all, exists, is } from '@/domain/model/ruleBuilders';

import { CustomSourceEditor } from '../sources/CustomSourceEditor';
import { KeysEditor } from '../sources/KeysEditor';
import { SHOW_FIELDS } from './FieldPicker';
import { RuleEditor } from './RuleEditor';
import {
  BranchSamplesContext,
  rawSamples,
  ruleSamples,
  RuleSamplesContext,
} from './samples';

const record = {
  workflow: 'CI',
  items: [{ name: 'deploy' }],
  _raw: { run: { event: 'push' }, jobs: [{ name: 'deploy', steps: [] }] },
};

describe('the field picker', () => {
  it('picks a path from a tree over a real record, raw data included', () => {
    const onChange = vi.fn();
    render(
      <RuleSamplesContext value={{ github: [record] }}>
        <RuleEditor
          label="R"
          provider="github"
          rule={all(exists('$.x'))}
          onChange={onChange}
        />
      </RuleSamplesContext>,
    );
    const picker = screen.getByLabelText('R check 1 field picker');
    fireEvent.click(within(picker).getByText('Pick field'));
    // Raw data starts closed: open it, then the run.
    for (const name of ['_raw', 'run'])
      fireEvent.click(
        within(picker).getByRole('button', { name: `${SHOW_FIELDS} ${name}` }),
      );
    fireEvent.click(within(picker).getByRole('button', { name: 'event' }));
    expect(onChange).toHaveBeenCalledWith(all(exists('$._raw.run.event')));
    fireEvent.click(within(picker).getAllByRole('button', { name: '[*]' })[0]);
    expect(onChange).toHaveBeenLastCalledWith(all(exists('$.items[*]')));
  });
});

describe('previews over real data', () => {
  it('previews translation rules over the raw data', () => {
    const raw = rawSamples([
      record,
      { ...record, _raw: { run: { event: 'pr' } } },
    ]);
    render(
      <KeysEditor
        title="Record keys"
        samples={raw.records}
        noun="raw runs"
        keys={[
          {
            name: 'event',
            translations: [
              { rule: all(is('$.run.event', 'push')), value: 'x' },
            ],
          },
        ]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Record keys (1)'));
    expect(
      screen.getByText('Rule matches 1 of 2 raw runs'),
    ).toBeInTheDocument();
  });

  it('previews the Amplify branch rule over the branches read', () => {
    const amplify = BUILTIN_SOURCES[1];
    if (amplify.provider !== 'amplify') throw new Error('not Amplify');
    render(
      <BranchSamplesContext
        value={[{ branchName: 'main' }, { branchName: 'feature/x' }]}
      >
        <CustomSourceEditor
          chosen
          rule={{
            ...amplify,
            reader: {
              ...amplify.reader,
              branches: all(is('$.branchName', 'main')),
            },
          }}
          onChange={vi.fn()}
          onRemove={undefined}
        />
      </BranchSamplesContext>,
    );
    expect(
      screen.getByText('Rule matches 1 of 2 branches'),
    ).toBeInTheDocument();
  });
});

describe('samples', () => {
  it('gives raw records and the raw items the items path finds', () => {
    expect(rawSamples([record], '$.jobs[*]')).toEqual({
      records: [record._raw],
      items: [{ name: 'deploy', steps: [] }],
    });
    expect(rawSamples([{ workflow: 'x' }]).records).toEqual([]);
  });

  it('puts Unknown cells first', () => {
    const ok = { kind: 'ok', document: { n: 1 }, status: { id: 'ok' } };
    const unknown = {
      kind: 'ok',
      document: { n: 2 },
      status: { id: UNKNOWN_STATUS_ID },
    };
    expect(
      ruleSamples([{ id: 'r', type: 'github' }], {
        a: { rowId: 'r', derivation: ok },
        b: { rowId: 'r', derivation: unknown },
      }).github,
    ).toEqual([{ n: 2 }, { n: 1 }]);
  });
});
