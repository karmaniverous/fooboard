/**
 * Tests for the Sources tab: a customised rule's keys (add a key and a
 * translation, give it a value), the only items where builder adding a
 * filter check to its keep rule, the Amplify reader's clamp, deleting a
 * key, and a chosen copy that can't be removed.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { give } from '@/domain/model/ruleBuilders';
import { MAX_AMPLIFY_JOBS_PER_BRANCH } from '@/domain/model/sourceRule';
import { expand } from '@/test/openItem';

import { itemsWherePath } from '../rules/itemsWhere';
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
    expand('GitHub (custom)');
    expect(screen.getByText(`Record keys (${String(before)})`)).toBeVisible();
    fireEvent.click(screen.getAllByText('Add key')[0]);
    expect(custom(saved)?.keys).toHaveLength(before + 1);
    const name = custom(saved)?.keys[before]?.name ?? '';
    // The new key opens on its own (the only one open).
    fireEvent.click(screen.getByText('Add translation'));
    expect(custom(saved)?.keys[before]?.translations).toEqual([give('')]);
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
    expand('GitHub (custom)');
    fireEvent.change(screen.getByLabelText(`${label} item glob`), {
      target: { value: 'deploy*' },
    });
    const group = screen.getByRole('group', {
      name: `${label} only items where`,
    });
    fireEvent.click(within(group).getByRole('button', { name: 'Add' }));
    expect(custom(saved)?.keep.checks.at(-1)).toMatchObject({
      path: itemsWherePath('name', 'deploy*', true),
      operator: 'exists',
    });
  });

  // Queries avoid getByRole over the whole tab: two customised rules make
  // a large DOM, and role queries over it ran past the timeout under
  // coverage. Translation editing is covered in KeysEditor.test.tsx.
  it("clamps Amplify's jobs per branch, deletes a key, and keeps a chosen copy", () => {
    const saved: Dashboard[] = [];
    render(<Harness saved={saved} />);
    fireEvent.click(screen.getAllByText('Customise')[1]);
    const amplify = () =>
      saved.at(-1)?.customSourceRules.find((r) => r.provider === 'amplify');
    const jobs = screen.getByLabelText('Jobs per branch');
    fireEvent.change(jobs, {
      target: { value: String(MAX_AMPLIFY_JOBS_PER_BRANCH + 1) },
    });
    fireEvent.blur(jobs);
    expect(amplify()?.reader).toMatchObject({
      jobsPerBranch: MAX_AMPLIFY_JOBS_PER_BRANCH,
    });
    const section = screen.getByLabelText('Source rule Amplify (custom)');
    fireEvent.click(within(section).getByText(/^Record keys/));
    fireEvent.click(within(section).getByText('Add key'));
    const added = amplify()?.keys.at(-1)?.name ?? '';
    expect(added).not.toBe('');
    fireEvent.click(within(section).getByLabelText(`Delete key ${added}`));
    expect(amplify()?.keys.some((k) => k.name === added)).toBe(false);
    // The first copy (GitHub) is still chosen, so it can't be removed.
    const github = screen.getByLabelText('Source rule GitHub (custom)');
    expect(within(github).getByText('Remove').closest('button')).toBeDisabled();
  });
});
