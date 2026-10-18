/**
 * Tests for *Copy AWS policy* (spec.md C-3a): what it copies and says when
 * the dashboard has no Amplify apps yet, when a source is invalid, and
 * when the browser won't copy.
 * (Copying a dashboard's apps is tested through the credentials panel.)
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import { CopyAwsPolicy } from './CopyAwsPolicy';
import { amplifyPolicy } from './iamPolicy';

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
  it('copies a list-only policy before there are Amplify rows, and says to copy again', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    clipboard(writeText);
    await copy();
    const copied: unknown = JSON.parse(writeText.mock.calls[0]?.[0] ?? 'null');
    expect(copied).toEqual(amplifyPolicy([]));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copy it again after adding Amplify rows',
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
            sources: [
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
