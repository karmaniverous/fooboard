/**
 * Tests for a source rule's keys: switching a translation between giving
 * a value and copying a path keeps its text (an empty copy starts from
 * the root), commits write the right kind (a cleared path reverts, a
 * cleared value gives empty text), a blank key name is refused,
 * and translations and keys are added and removed.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NEW_FIELD_PATH, RESERVED_KEYS } from '@/domain/model/keys';
import { copy, give } from '@/domain/model/ruleBuilders';
import type { KeyDef } from '@/domain/model/sourceRule';
import { always } from '@/domain/rules/always';
import { choose } from '@/test/choose';

import { KeysEditor } from './KeysEditor';

const TITLE = 'Record keys';
const KEY = RESERVED_KEYS.branch;
const HEAD_PATH = '$.head';
const HEAD = copy(HEAD_PATH);
const ROW = `${KEY} translation 1`;

const renderKeys = (keys: KeyDef[]) => {
  const onChange = vi.fn<(keys: KeyDef[]) => void>();
  render(<KeysEditor title={TITLE} keys={keys} onChange={onChange} />);
  fireEvent.click(screen.getByText(`${TITLE} (${String(keys.length)})`));
  return onChange;
};

const commit = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

const translationOf = (onChange: ReturnType<typeof renderKeys>) =>
  onChange.mock.lastCall?.[0][0]?.translations[0];

describe('KeysEditor translations', () => {
  it('switches a blank value to a copy from the root', () => {
    const onChange = renderKeys([{ name: KEY, translations: [give('')] }]);
    choose(screen.getByLabelText(`${ROW} mode`), 'copies');
    expect(translationOf(onChange)).toEqual({
      rule: always,
      copy: NEW_FIELD_PATH,
    });
  });

  it('keeps a copy path as the value when switched to gives', () => {
    const onChange = renderKeys([{ name: KEY, translations: [HEAD] }]);
    choose(screen.getByLabelText(`${ROW} mode`), 'gives');
    expect(translationOf(onChange)).toEqual({
      rule: HEAD.rule,
      value: HEAD_PATH,
    });
  });

  it('commits a copy path, reverting when cleared', () => {
    const onChange = renderKeys([{ name: KEY, translations: [HEAD] }]);
    commit(`${ROW} path`, '$.ref');
    expect(translationOf(onChange)).toEqual({ rule: HEAD.rule, copy: '$.ref' });
    commit(`${ROW} path`, '');
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByLabelText(`${ROW} path`)).toHaveValue(HEAD_PATH);
  });

  it('clears a value back to empty text', () => {
    const onChange = renderKeys([{ name: KEY, translations: [give('a')] }]);
    commit(`${ROW} value`, '');
    expect(translationOf(onChange)).toEqual(give(''));
  });

  it('commits a value, and adds and removes translations', () => {
    const onChange = renderKeys([{ name: KEY, translations: [give('a')] }]);
    commit(`${ROW} value`, 'b');
    expect(translationOf(onChange)).toEqual({ rule: always, value: 'b' });
    fireEvent.click(screen.getByRole('button', { name: 'Add translation' }));
    expect(onChange.mock.lastCall?.[0][0]?.translations).toEqual([
      give('a'),
      give(''),
    ]);
    fireEvent.click(screen.getByRole('button', { name: `Delete ${ROW}` }));
    expect(onChange.mock.lastCall?.[0][0]?.translations).toEqual([]);
  });
});

describe('KeysEditor keys', () => {
  it('renames a key but refuses a blank name, and deletes a key', () => {
    const onChange = renderKeys([{ name: KEY, translations: [] }]);
    commit(`${TITLE} key 1 name`, '');
    expect(onChange).not.toHaveBeenCalled();
    commit(`${TITLE} key 1 name`, RESERVED_KEYS.commit);
    expect(onChange.mock.lastCall?.[0][0]?.name).toBe(RESERVED_KEYS.commit);
    fireEvent.click(screen.getByRole('button', { name: `Delete key ${KEY}` }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
