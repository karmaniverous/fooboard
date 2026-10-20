/**
 * Tests for a dashboard's own source rule: its name, items path and what
 * the GitHub reader asks for, clamped to the reader's limits, with the
 * request cost it implies.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { builtinSourceFor } from '@/domain/model/builtinSources';
import {
  DEFAULT_GITHUB_RUNS,
  MAX_GITHUB_RUNS,
  MIN_READ,
  type SourceRule,
} from '@/domain/model/sourceRule';
import { GITHUB_PER_PAGE } from '@/lib/github';
import { OPEN_ITEM } from '@/test/openItem';

import { CustomSourceEditor } from './CustomSourceEditor';

const github = builtinSourceFor('github');

const setup = (rule: SourceRule = github) => {
  const onChange = vi.fn();
  render(
    <CustomSourceEditor
      item={OPEN_ITEM}
      rule={rule}
      chosen
      onChange={onChange}
      onRemove={undefined}
    />,
  );
  return onChange;
};

const commit = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe('CustomSourceEditor', () => {
  it('clamps runs per repo to the reader limits and ignores non-numbers', () => {
    const onChange = setup();
    commit('Runs per repo', String(MAX_GITHUB_RUNS + 1));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reader: { ...github.reader, runs: MAX_GITHUB_RUNS },
      }),
    );
    commit('Runs per repo', '0');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reader: { ...github.reader, runs: MIN_READ },
      }),
    );
    onChange.mockClear();
    commit('Runs per repo', 'lots');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says how many requests a poll makes per repo', () => {
    setup();
    expect(screen.getByText('1 request per repo per poll')).toBeInTheDocument();
  });

  it('counts a page of requests per GITHUB_PER_PAGE runs', () => {
    const runs = GITHUB_PER_PAGE * 2 + 1;
    setup({ ...github, reader: { ...github.reader, runs } });
    expect(
      screen.getByText('3 requests per repo per poll'),
    ).toBeInTheDocument();
  });

  it('toggles pull-request runs, renames, and ignores an empty items path', () => {
    const onChange = setup();
    fireEvent.click(screen.getByLabelText('Skip pull-request runs'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reader: { excludePullRequests: false, runs: DEFAULT_GITHUB_RUNS },
      }),
    );
    commit('Source rule name', 'Mine');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'Mine' }),
    );
    onChange.mockClear();
    commit('Items path', '');
    expect(onChange).not.toHaveBeenCalled();
    commit('Items path', '$.steps');
    const { items } = github;
    if (!items) throw new Error('the built-in GitHub rule has items');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ items: { ...items, path: '$.steps' } }),
    );
  });
});
