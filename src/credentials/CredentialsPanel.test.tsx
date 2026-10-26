/**
 * Tests for the credentials panel: adding a token keeps the secret in the
 * store (tab-only unless remembered) and only its id and label in the
 * dashboard; forgetting asks for the secret again; removal is confirmed;
 * copying from another dashboard makes an independent credential; and an
 * approaching expiry is flagged.
 *
 * @module
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { choose } from '@/test/choose';
import { addToken, setupPanel as setup } from '@/test/credentialsPanel';
import { expand, isOpen } from '@/test/openItem';

describe('CredentialsPanel', () => {
  it('stores the secret apart from the dashboard, as the default', () => {
    const { stores, latest } = setup();
    expect(screen.getByText(/If this token leaks/)).toBeInTheDocument();
    addToken('acme', 'github_pat_1');
    const [ref] = latest.current.credentials;
    expect(ref).toMatchObject({ kind: 'github', label: 'acme' });
    expect(latest.current.settings.githubToken).toBe(ref.id);
    expect(
      screen.getByText("Dashboard's default GitHub token"),
    ).toBeInTheDocument();
    expect(JSON.stringify(latest.current)).not.toContain('github_pat_1');
    expect(stores.credentials.get(ref.id)).toEqual({
      kind: 'github',
      token: 'github_pat_1',
    });
    expect(screen.getByText(/this tab only/)).toBeInTheDocument();
  });

  it('asks for the secret again after Forget, and confirms removal', () => {
    const { latest } = setup();
    addToken('acme', 'github_pat_1', true);
    expect(screen.getByText(/· remembered/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    expect(screen.getByText(/· not entered/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(latest.current.credentials).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove acme' }));
    expect(latest.current.credentials).toHaveLength(0);
    expect(latest.current.settings.githubToken).toBeUndefined();
  });

  it('copies a credential from another dashboard as an independent one', () => {
    const other = DashboardSchema.parse({
      id: 'o',
      name: 'Other',
      credentials: [{ id: 'src', kind: 'github', label: 'shared' }],
      settings: { githubToken: 'src' },
    });
    const { stores, latest } = setup({
      others: [other],
      seed: (st) => {
        st.credentials.set('src', { kind: 'github', token: 't' }, false);
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    const copy = latest.current.credentials[0];
    // The copy, just added, is the one open.
    expect(isOpen('shared')).toBe(true);
    expect(copy.id).not.toBe('src');
    act(() => {
      stores.credentials.forget('src');
    });
    expect(stores.credentials.get(copy.id)).toEqual({
      kind: 'github',
      token: 't',
    });
  });

  it('flags a token close to expiry', () => {
    setup({ expiry: new Date(Date.now() + 3 * 864e5).toISOString() });
    addToken('acme', 'github_pat_1');
    expect(screen.getByText(/Expires in 3 days/)).toBeInTheDocument();
  });
});

describe('CredentialsPanel failures and form hygiene', () => {
  it('clears the secret field after adding, so Forget leaves no secret in the form', () => {
    setup();
    addToken('acme', 'github_pat_1');
    for (const field of screen.getAllByLabelText('Token')) {
      expect(field).toHaveValue('');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    for (const field of screen.getAllByLabelText('Token')) {
      expect(field).toHaveValue('');
    }
  });

  it('reports a refused write, keeps the input for retry, and stores nothing', () => {
    const { stores, latest } = setup({
      seed: (st) => {
        st.credentials.set = () => {
          throw new Error('storage refused the write');
        };
      },
    });
    addToken('acme', 'github_pat_1');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'storage refused the write',
    );
    expect(screen.getByLabelText('Token')).toHaveValue('github_pat_1');
    expect(latest.current.credentials).toEqual([]);
    expect(stores.config.load()).toMatchObject({ kind: 'ok' });
  });

  it('links each kind to its README section', () => {
    setup();
    expect(
      screen.getByRole('link', { name: /The credentials guide/ }),
    ).toHaveAttribute('href', expect.stringMatching(/#credentials$/));
    expect(
      screen.getByRole('link', { name: 'How to create a read-only token' }),
    ).toHaveAttribute('href', expect.stringMatching(/#github-token$/));
    expect(
      screen.getByRole('link', { name: /What a leak exposes/ }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(/#what-a-leaked-credential-exposes$/),
    );
    choose(screen.getByRole('combobox', { name: 'Kind' }), 'AWS key');
    expect(
      screen.getByRole('link', { name: 'How to create a read-only key' }),
    ).toHaveAttribute('href', expect.stringMatching(/#aws-key$/));
  });

  it('copies the AWS policy per key: account-wide for a new key, narrowed for one the board read with', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const click = async (button: HTMLElement) => {
      await act(async () => {
        fireEvent.click(button);
        await Promise.resolve();
        await Promise.resolve();
      });
    };
    setup({
      initial: DashboardSchema.parse({
        id: 'd',
        name: 'D',
        credentials: [{ id: 'prod', kind: 'aws', label: 'prod' }],
      }),
      keyApps: { prod: [{ region: 'eu-west-1', appId: 'd2' }] },
    });
    expand('prod');
    const [onKey] = screen.getAllByRole('button', { name: 'Copy AWS policy' });
    await click(onKey);
    expect(writeText.mock.calls[0]?.[0]).toContain(
      '"arn:aws:amplify:eu-west-1:*:apps/d2"',
    );
    expect(screen.getByText(/This policy covers the 1 app/)).toHaveTextContent(
      'the board reads with prod.',
    );

    choose(screen.getByRole('combobox', { name: 'Kind' }), 'AWS key');
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'staging' },
    });
    await click(
      screen.getAllByRole('button', { name: 'Copy AWS policy' }).at(-1) ??
        onKey,
    );
    expect(writeText.mock.calls[1]?.[0]).toContain('apps/*');
    expect(
      screen.getByText(/Nothing has been read with staging yet/),
    ).toBeInTheDocument();
    Reflect.deleteProperty(navigator, 'clipboard');
  });
});
