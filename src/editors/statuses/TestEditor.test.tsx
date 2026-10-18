/**
 * Tests for the test editor: conditions write JSON Schema (on the run, or
 * any or every job where there are jobs); JSON saves only an object, and
 * says why when it doesn't; a test the form can't express stays JSON.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { textPattern } from '@/domain/statuses/pattern';
import { choose } from '@/test/choose';

import { TestEditor } from './TestEditor';

type Schema = Record<string, unknown>;

function setup(initial: Schema, jobsScope = true) {
  const latest = { current: initial };
  function Harness() {
    const [test, setTest] = useState(initial);
    latest.current = test;
    return (
      <TestEditor
        label="T"
        test={test}
        jobsScope={jobsScope}
        onChange={setTest}
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

describe('TestEditor', () => {
  it('writes conditions on jobs, and removes them', () => {
    const latest = setup({});
    expect(screen.getByText('Matches everything.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    commit('T condition 1 value', 'failure');
    choose(screen.getByLabelText('T condition 1 scope'), 'every job');
    expect(latest.current).toEqual({
      type: 'object',
      properties: {
        jobs: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              conclusion: {
                type: 'string',
                pattern: textPattern('is', 'failure'),
              },
            },
            required: ['conclusion'],
          },
        },
      },
      required: ['jobs'],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete T condition 1' }),
    );
    expect(latest.current).toEqual({});
  });

  it('tests the document itself where there are no jobs', () => {
    const latest = setup({}, false);
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    expect(screen.queryByLabelText('T condition 1 scope')).toBeNull();
    choose(screen.getByLabelText('T condition 1 operator'), 'is one of');
    commit('T condition 1 value', 'FAILED, CANCELLED');
    expect(latest.current).toEqual({
      type: 'object',
      properties: { status: { enum: ['FAILED', 'CANCELLED'] } },
      required: ['status'],
    });
  });

  it('saves JSON only when it is an object, and keeps what the form cannot express as JSON', () => {
    const latest = setup({});
    fireEvent.click(screen.getByRole('button', { name: 'Edit as JSON' }));
    commit('T JSON', '{');
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
    commit('T JSON', '[]');
    expect(screen.getByRole('alert')).toHaveTextContent('expected an object');
    expect(latest.current).toEqual({});
    commit('T JSON', '{ "not": {} }');
    expect(latest.current).toEqual({ not: {} });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Edit as conditions' }),
    ).toBeNull();
  });
});
