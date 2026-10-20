/**
 * Tests for the credential pickers (spec.md C-1a, C-21): the GitHub repo
 * picker lists with the chosen token, hides results when it changes, and
 * the new row keeps the token (or none, following the default); the
 * credential choice lists each credential once and always shows its
 * selection.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { EngineProviders } from '@/engine';
import { choose, optionsOf } from '@/test/choose';
import { fakeAmplifyReader, fakeGitHubReader } from '@/test/fakeReaders';

import { CredentialSelect } from './CredentialSelect';
import { RowsEditor } from './RowsEditor';

const board = (extra: object = {}) =>
  DashboardSchema.parse({
    id: 'd',
    name: 'Board',
    credentials: [
      { id: 'gh-b', kind: 'github', label: 'beta' },
      { id: 'gh-a', kind: 'github', label: 'alpha' },
    ],
    defaultCredentials: { github: 'gh-a' },
    ...extra,
  });

/** Each token sees one repo named after it. */
const providers: EngineProviders = {
  github: (id) =>
    fakeGitHubReader({
      listRepos: () =>
        Promise.resolve([
          {
            full_name: `acme/${id}-repo`,
            name: `${id}-repo`,
            private: false,
            html_url: '',
            owner: { login: 'acme' },
          },
        ]),
    }),
  amplify: () => () => fakeAmplifyReader({}),
};

/** The rows editor over a draft it updates; `onChange` sees each edit. */
function renderRows(dashboard: Dashboard) {
  const onChange = vi.fn<(next: Dashboard) => void>();
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(dashboard);
    return (
      <RowsEditor
        dashboard={d}
        providers={providers}
        onChange={(next) => {
          onChange(next);
          setD(next);
        }}
      />
    );
  }
  render(<Harness />);
  return onChange;
}

const tokenChoice = () =>
  screen.getByRole('combobox', { name: 'GitHub token for the new row' });
const list = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add a GitHub row' }));
};

describe('RepoPicker', () => {
  it('lists repos with the chosen token, and the new row keeps it', async () => {
    const onChange = renderRows(board());
    choose(tokenChoice(), 'beta');
    list();
    fireEvent.click(
      await screen.findByRole('button', { name: 'acme/gh-b-repo' }),
    );
    expect(screen.queryByRole('button', { name: 'acme/gh-a-repo' })).toBeNull();
    expect(onChange.mock.lastCall?.[0].rows.at(-1)).toMatchObject({
      repo: 'acme/gh-b-repo',
      credentialId: 'gh-b',
    });
  });

  it('leaves the token unset on the new row when none is chosen', async () => {
    const onChange = renderRows(board());
    list();
    fireEvent.click(
      await screen.findByRole('button', { name: 'acme/gh-a-repo' }),
    );
    const row = onChange.mock.lastCall?.[0].rows.at(-1);
    expect(row).toMatchObject({ repo: 'acme/gh-a-repo' });
    expect(row).not.toHaveProperty('credentialId');
    expect(
      shown(
        screen.getByRole('combobox', { name: 'GitHub token for gh-a-repo' }),
      ),
    ).toBe('Dashboard default (alpha)');
  });

  it('hides the results when the token changes', async () => {
    renderRows(board());
    list();
    expect(
      await screen.findByRole('button', { name: 'acme/gh-a-repo' }),
    ).toBeInTheDocument();
    choose(tokenChoice(), 'beta');
    expect(screen.queryByRole('button', { name: 'acme/gh-a-repo' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add a GitHub row' }),
    ).toBeInTheDocument();
  });

  it('offers a token choice when tokens exist but no default is set', () => {
    renderRows(board({ defaultCredentials: {} }));
    expect(screen.queryByText(/Add a GitHub token/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add a GitHub row' }),
    ).toBeDisabled();
  });

  it('asks for a token when the dashboard has none', () => {
    renderRows(board({ credentials: [], defaultCredentials: {} }));
    expect(screen.getByText(/Add a GitHub token/)).toBeInTheDocument();
  });
});

/** The selected label a choice shows (its first cell; the others only
 * size it). */
const shown = (trigger: HTMLElement) =>
  trigger.querySelector(':scope > span > span:first-child')?.textContent;

function renderChoice(
  value: string | undefined,
  inherited?: { from: 'group' | 'dashboard'; id?: string },
) {
  render(
    <CredentialSelect
      dashboard={board()}
      kind="github"
      value={value}
      onChange={() => undefined}
      inherited={inherited}
      label="GitHub token for api"
    />,
  );
  return screen.getByRole('combobox', { name: 'GitHub token for api' });
}

describe('CredentialSelect', () => {
  it('lists the inherited default once, named after its level', () => {
    expect(optionsOf(renderChoice(undefined))).toEqual([
      'Dashboard default (alpha)',
      'beta',
    ]);
  });

  it('names a group default', () => {
    expect(
      optionsOf(renderChoice(undefined, { from: 'group', id: 'gh-b' })),
    ).toEqual(['Group default (beta)', 'alpha']);
  });

  it('still shows a row pinned to the token that is now the default', () => {
    const trigger = renderChoice('gh-a');
    expect(shown(trigger)).toBe('alpha');
    expect(optionsOf(trigger)).toEqual([
      'Dashboard default (alpha)',
      'alpha',
      'beta',
    ]);
  });

  it('shows a value naming no credential instead of a blank choice', () => {
    expect(shown(renderChoice('gone'))).toBe('gone (not on this dashboard)');
  });
});
