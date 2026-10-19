/**
 * Tests for the Sources tab: a customised rule's keys (add a key and a
 * translation, give it a value), and the only items where builder adding
 * a filter check to its keep rule.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';

import { customiseSource } from './customSource';
import { SourcesEditor } from './SourcesEditor';

const start = customiseSource(
  DashboardSchema.parse({ id: 'd', name: 'd' }),
  'github',
);

function Harness({ saved }: { saved: Dashboard[] }) {
  const [d, setD] = useState(start);
  return (
    <SourcesEditor
      dashboard={d}
      onChange={(next) => {
        saved.push(next);
        setD(next);
      }}
    />
  );
}

const custom = (saved: Dashboard[]) => saved.at(-1)?.customSourceRules[0];

describe('SourcesEditor', () => {
  it('edits keys and translations', () => {
    const saved: Dashboard[] = [];
    render(<Harness saved={saved} />);
    const before = start.customSourceRules[0]?.keys.length ?? 0;
    fireEvent.click(screen.getAllByRole('button', { name: 'Add key' })[0]);
    expect(custom(saved)?.keys).toHaveLength(before + 1);
    const name = custom(saved)?.keys[before]?.name ?? '';
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Add translation' })[before],
    );
    expect(custom(saved)?.keys[before]?.translations).toEqual([
      { rule: { combine: 'and', checks: [] }, value: '' },
    ]);
    const value = screen.getByLabelText(`${name} translation 1 value`);
    fireEvent.change(value, { target: { value: 'x' } });
    fireEvent.blur(value);
    expect(custom(saved)?.keys[before]?.translations[0]).toMatchObject({
      value: 'x',
    });
  });

  it('adds an only-items-where check to the keep rule', () => {
    const saved: Dashboard[] = [];
    render(<Harness saved={saved} />);
    const label = 'GitHub (custom) keep rule';
    fireEvent.change(screen.getByLabelText(`${label} item glob`), {
      target: { value: 'deploy*' },
    });
    const group = screen.getByRole('group', {
      name: `${label} only items where`,
    });
    fireEvent.click(within(group).getByRole('button', { name: 'Add' }));
    expect(custom(saved)?.keep.checks.at(-1)).toMatchObject({
      path: "$.items[?match(@.name, '[Dd][Ee][Pp][Ll][Oo][Yy].*')]",
      operator: 'exists',
    });
  });
});
