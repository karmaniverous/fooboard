/**
 * Tests for *Copy AWS policy* (spec.md C-3a): what it copies and says when
 * the dashboard has no Amplify apps yet (account-wide), when it has apps
 * (narrowed to them), when a source is invalid, and when the browser won't
 * copy.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import { CopyAwsPolicy } from './CopyAwsPolicy';
import { accountPolicy, amplifyPolicy } from './iamPolicy';

const noApps = DashboardSchema.parse({ id: 'd', name: 'D' });

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

async function copy(dashboard = noApps) {
  render(<CopyAwsPolicy dashboard={dashboard} />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy AWS policy' }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('CopyAwsPolicy', () => {
  it('copies an account-wide policy before there are Amplify rows, and says copying again narrows it', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    clipboard(writeText);
    await copy();
    const copied: unknown = JSON.parse(writeText.mock.calls[0]?.[0] ?? 'null');
    expect(copied).toEqual(accountPolicy());
    expect(screen.getByRole('status')).toHaveTextContent(
      "Copied: read access to every Amplify app in the AWS account. Copy it again after adding Amplify rows to narrow it to this dashboard's apps.",
    );
  });

  it("copies a policy narrowed to the dashboard's apps, and says so", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    clipboard(writeText);
    await copy(
      DashboardSchema.parse({
        id: 'd',
        name: 'D',
        rows: [
          {
            type: 'amplify',
            id: 'web',
            displayName: 'web',
            repo: 'acme/web',
            pinnedApps: [
              { region: 'us-east-1', appId: 'd1' },
              { region: 'eu-west-1', appId: 'd2' },
            ],
          },
        ],
      }),
    );
    const copied = writeText.mock.calls[0]?.[0] ?? '';
    expect(JSON.parse(copied)).toEqual(
      amplifyPolicy([
        { region: 'us-east-1', appId: 'd1' },
        { region: 'eu-west-1', appId: 'd2' },
      ]),
    );
    expect(copied).not.toContain('GetJob');
    expect(copied).not.toContain('apps/*');
    expect(screen.getByRole('status')).toHaveTextContent(
      "Copied: read-only access to this dashboard's 2 Amplify apps.",
    );
  });

  it('points to the README template when the browser refuses to copy', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    await copy();
    expect(screen.getByRole('status')).toHaveTextContent(
      "Couldn't copy the policy. The README has it as a template.",
    );
  });

  it('leaves out a source with an invalid app id, and says so', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    clipboard(writeText);
    await copy(
      DashboardSchema.parse({
        id: 'd',
        name: 'D',
        rows: [
          {
            type: 'amplify',
            id: 'web',
            displayName: 'web',
            repo: 'acme/web',
            pinnedApps: [
              { region: 'us-east-1', appId: 'd1' },
              { region: 'us-east-1', appId: '*' },
            ],
          },
        ],
      }),
    );
    const copied: unknown = JSON.parse(writeText.mock.calls[0]?.[0] ?? 'null');
    expect(copied).toEqual(
      amplifyPolicy([{ region: 'us-east-1', appId: 'd1' }]),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Left out 1 Amplify app with an invalid region or app ID',
    );
  });
});
