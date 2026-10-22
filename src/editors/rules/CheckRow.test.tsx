/**
 * Tests for one check of a rule: each control reports just its change,
 * *Ignore case* hides for `exists`, the match count gives way to a
 * problem, the field picker writes the path, and the object or array hint
 * describes the path field.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSONValue } from 'json-p3';
import { describe, expect, it, vi } from 'vitest';

import { is } from '@/domain/model/ruleBuilders';
import { checkProblem, OBJECT_OR_ARRAY_HINT } from '@/domain/rules/check';
import type { Check } from '@/domain/rules/schema';
import { choose } from '@/test/choose';

import { CheckRow } from './CheckRow';

const LABEL = 'Check 1';

const renderRow = (
  check: Check,
  extra: { pickFrom?: JSONValue; findsObjectOrArray?: boolean } = {},
) => {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  render(
    <CheckRow
      label={LABEL}
      check={check}
      listId={undefined}
      matched="2 of 3"
      findsObjectOrArray={false}
      onChange={onChange}
      onRemove={onRemove}
      {...extra}
    />,
  );
  return { onChange, onRemove };
};

describe('CheckRow', () => {
  it('reports operator, quantifier, flag and delete changes', () => {
    const { onChange, onRemove } = renderRow(is('$.branch', 'main'));
    choose(screen.getByLabelText(`${LABEL} operator`), 'matches regex');
    expect(onChange).toHaveBeenLastCalledWith({ operator: 'regex' });
    choose(screen.getByLabelText(`${LABEL} values`), 'every value');
    expect(onChange).toHaveBeenLastCalledWith({ quantifier: 'every' });
    fireEvent.click(screen.getByLabelText('NOT'));
    expect(onChange).toHaveBeenLastCalledWith({ not: true });
    fireEvent.click(screen.getByLabelText('Ignore case'));
    expect(onChange).toHaveBeenLastCalledWith({ ignoreCase: false });
    fireEvent.click(screen.getByRole('button', { name: `Delete ${LABEL}` }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByText('2 of 3')).toBeVisible();
  });

  it('hides the value and Ignore case for exists', () => {
    renderRow({ ...is('$.branch', 'main'), operator: 'exists' });
    expect(screen.queryByLabelText(`${LABEL} value`)).toBeNull();
    expect(screen.queryByLabelText('Ignore case')).toBeNull();
  });

  it('shows the problem instead of the match count', () => {
    const bad = { ...is('$.branch', 'main'), path: '$[' };
    const problem = checkProblem(bad);
    if (problem === undefined) throw new Error('expected a problem');
    renderRow(bad);
    expect(screen.getByRole('alert')).toHaveTextContent(problem);
    expect(screen.queryByText('2 of 3')).toBeNull();
  });

  it('describes the path field with the object or array hint', () => {
    renderRow(is('$.head', 'main'), { findsObjectOrArray: true });
    expect(screen.getByLabelText(`${LABEL} path`)).toHaveAccessibleDescription(
      OBJECT_OR_ARRAY_HINT,
    );
  });

  it('shows no hint, and no description, otherwise', () => {
    renderRow(is('$.branch', 'main'));
    expect(screen.queryByText(OBJECT_OR_ARRAY_HINT)).toBeNull();
    expect(screen.getByLabelText(`${LABEL} path`)).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('writes a path picked from a real record', () => {
    const { onChange } = renderRow(is('$.', ''), {
      pickFrom: { branch: 'main' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pick field' }));
    fireEvent.click(screen.getByRole('button', { name: /branch/ }));
    expect(onChange).toHaveBeenLastCalledWith({ path: '$.branch' });
  });
});
