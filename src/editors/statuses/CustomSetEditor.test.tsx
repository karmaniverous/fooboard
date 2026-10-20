/**
 * Tests for the custom-set editor: summary and cell statuses edit in
 * place; GitHub sets show their job test, Amplify sets don't; the last
 * status can't be deleted; a set in use can't be removed.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { StatusSet } from '@/domain/config/statusSets';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { PRESET_SUMMARY_IDS } from '@/domain/statuses/presetRules';
import { presetById } from '@/domain/statuses/presets';
import { choose } from '@/test/choose';
import { OPEN_ITEM } from '@/test/openItem';
import { expand } from '@/test/openItem';

import { CustomSetEditor } from './CustomSetEditor';

function setup(initial: StatusSet, onRemove?: () => void) {
  const latest = { current: initial };
  function Harness() {
    const [set, setSet] = useState(initial);
    latest.current = set;
    return (
      <CustomSetEditor
        item={OPEN_ITEM}
        set={set}
        onChange={setSet}
        onRemove={onRemove}
      />
    );
  }
  render(<Harness />);
  return latest;
}

describe('CustomSetEditor', () => {
  it('edits summary statuses and a cell status in place', () => {
    const latest = setup(presetById(PRESET_IDS.githubSingleJob));
    const name = screen.getByLabelText('Summary status 1 name');
    fireEvent.change(name, { target: { value: 'Broken' } });
    fireEvent.blur(name);
    fireEvent.change(screen.getByLabelText('Broken colour'), {
      target: { value: '#000000' },
    });
    expect(latest.current.summary[0]).toMatchObject({
      name: 'Broken',
      color: '#000000',
    });

    const [first] = latest.current.cell;
    expand(first.name);
    const status = screen.getByRole('region', {
      name: `Cell status ${first.name}`,
    });
    fireEvent.click(within(status).getByRole('checkbox', { name: 'Outlined' }));
    choose(within(status).getByLabelText(`${first.name} counts toward`), 'OK');
    expect(latest.current.cell[0]).toMatchObject({
      outlined: true,
      summary: PRESET_SUMMARY_IDS.ok,
    });
    expect(screen.getByText('Items that count')).toBeInTheDocument();
  });

  it('sets icons, in-progress, the set name and status order', () => {
    const latest = setup(presetById(PRESET_IDS.githubSingleJob));
    const [summary] = latest.current.summary;
    choose(screen.getByLabelText(`${summary.name} icon`), '\u2298 cancelled');
    fireEvent.click(
      screen.getAllByRole('checkbox', { name: 'In progress' })[0],
    );
    expect(latest.current.summary[0]).toMatchObject({
      icon: 'cancelled',
      inProgress: !summary.inProgress,
    });

    const [a, b] = latest.current.cell;
    expand(a.name);
    choose(screen.getByLabelText(`${a.name} icon`), '? unknown');
    expect(latest.current.cell[0].icon).toBe('unknown');
    choose(screen.getByLabelText(`${a.name} icon`), 'Summary icon');
    expect(latest.current.cell[0].icon).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: `Move ${b.name} up` }));
    expect(latest.current.cell.slice(0, 2).map((c) => c.id)).toEqual([
      b.id,
      a.id,
    ]);
    const name = screen.getByLabelText('Status set name');
    fireEvent.change(name, { target: { value: 'Mine' } });
    fireEvent.blur(name);
    expect(latest.current.name).toBe('Mine');
  });

  it('deletes statuses down to the last, and removes only when allowed', () => {
    const onRemove = vi.fn();
    const amplify = presetById(PRESET_IDS.amplify);
    const latest = setup(
      { ...amplify, cell: amplify.cell.slice(0, 2) },
      onRemove,
    );
    expect(screen.queryByText('Items that count')).toBeNull();
    const [a, b] = latest.current.cell;
    fireEvent.click(screen.getByRole('button', { name: `Delete ${a.name}` }));
    expect(latest.current.cell.map((c) => c.id)).toEqual([b.id]);
    expect(
      screen.getByRole('button', { name: `Delete ${b.name}` }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("can't remove a set in use", () => {
    setup(presetById(PRESET_IDS.amplify));
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
});
