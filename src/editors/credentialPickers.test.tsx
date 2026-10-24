/**
 * Tests for the credential pickers (spec.md C-1a, C-21): the GitHub repo
 * picker lists with the chosen token, hides results when it changes, and
 * the new row keeps the token (or none, following the default); the
 * credential choice lists each credential once and always shows its
 * selection.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { choose, optionsOf } from '@/test/choose';
import { envRender } from '@/test/envRender';
import {
  fakeAmplifyReader,
  fakeGitHubApi,
  fetched,
  ghRepo,
} from '@/test/fakeReaders';
import { expand } from '@/test/openItem';

import { CredentialSelect } from './CredentialSelect';
import { dashboardDefault, type Unset } from './dashboardDefault';
import { RowsEditor } from './RowsEditor';

const board = (extra: object = {}) =>
  DashboardSchema.parse({
    id: 'd',
    name: 'Board',
    credentials: [
      { id: 'gh-b', kind: 'github', label: 'beta' },
      { id: 'gh-a', kind: 'github', label: 'alpha' },
    ],
    settings: { githubToken: 'gh-a' },
    ...extra,
  });

/** Each token sees one repo named after it. */
const render = envRender({
  github: (id) =>
    fakeGitHubApi({
      reposPage: () => Promise.resolve(fetched([ghRepo(`acme/${id}-repo`)])),
    }),
  amplify: () => fakeAmplifyReader({}),
});

/** The rows editor over a draft it updates; `onChange` sees each edit. */
function renderRows(dashboard: Dashboard) {
  const onChange = vi.fn<(next: Dashboard) => void>();
  function Harness(): React.JSX.Element {
    const [d, setD] = useState(dashboard);
    return (
      <RowsEditor
        dashboard={d}
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
      settings: { githubToken: 'gh-b' },
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
    expect(row?.settings).toEqual({});
    expand('gh-a-repo');
    fireEvent.click(screen.getAllByRole('button', { name: /^Settings/ })[0]);
    expect(
      shown(
        screen.getByRole('combobox', {
          name: 'GitHub token for Row gh-a-repo',
        }),
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
    renderRows(board({ settings: {} }));
    expect(screen.queryByText(/Add a GitHub token/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Add a GitHub row' }),
    ).toBeDisabled();
  });

  it('asks for a token when the dashboard has none', () => {
    renderRows(board({ credentials: [], settings: {} }));
    expect(screen.getByText(/Add a GitHub token/)).toBeInTheDocument();
  });
});

/** The selected label a choice shows (its first cell; the others only
 * size it). */
const shown = (trigger: HTMLElement) =>
  trigger.querySelector(':scope > span > span:first-child')?.textContent;

function renderChoice(value: string | undefined, unset: Unset) {
  render(
    <CredentialSelect
      dashboard={board()}
      kind="github"
      value={value}
      onChange={() => undefined}
      unset={unset}
      label="GitHub token for api"
    />,
  );
  return screen.getByRole('combobox', { name: 'GitHub token for api' });
}

describe('CredentialSelect', () => {
  it("lists the unset option's credential once, as the unset option", () => {
    expect(
      optionsOf(renderChoice(undefined, dashboardDefault(board(), 'github'))),
    ).toEqual(['Dashboard default (alpha)', 'beta']);
  });

  it('names no default when the dashboard sets none', () => {
    expect(
      optionsOf(
        renderChoice(
          undefined,
          dashboardDefault(board({ settings: {} }), 'github'),
        ),
      ),
    ).toEqual(['None (no default is set)', 'alpha', 'beta']);
  });

  it("still lists the unset option's credential when it is the value", () => {
    const trigger = renderChoice('gh-a', dashboardDefault(board(), 'github'));
    expect(shown(trigger)).toBe('alpha');
    expect(optionsOf(trigger)).toEqual([
      'Dashboard default (alpha)',
      'alpha',
      'beta',
    ]);
  });

  it('shows a value naming no credential instead of a blank choice', () => {
    expect(shown(renderChoice('gone', { label: 'None' }))).toBe(
      'gone (not on this dashboard)',
    );
  });
});
