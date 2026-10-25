/**
 * Tests for *Copy AWS policy* on one AWS key (spec.md C-3a, §3.12 *IAM*):
 * before the board has read with the key it copies the account-wide
 * policy and says so; after, a policy narrowed to the apps the board reads
 * with it (only `ListApps` when that is none); it leaves out an invalid
 * app and counts it, and points to the README when the browser won't
 * copy.
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CopyAwsPolicy } from './CopyAwsPolicy';
import { accountPolicy, amplifyPolicy } from './iamPolicy';

type Apps = { region: string; appId: string }[];

function clipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

/** Click the button for key `prod` with `apps`; what was copied. */
async function copy(apps?: Apps): Promise<unknown> {
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  clipboard(writeText);
  render(<CopyAwsPolicy name="prod" apps={apps} />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy AWS policy' }));
    await Promise.resolve();
    await Promise.resolve();
  });
  return JSON.parse(writeText.mock.calls[0]?.[0] ?? 'null');
}

const status = () => screen.getByRole('status');

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('CopyAwsPolicy', () => {
  it('copies the account-wide policy before anything is read with the key', async () => {
    expect(await copy()).toEqual(accountPolicy());
    expect(status()).toHaveTextContent(
      'Nothing has been read with prod yet, so this policy covers every Amplify app in the account. Copy again after the board first loads to narrow it.',
    );
  });

  it('narrows to the apps the board reads with the key, and says so', async () => {
    const apps = [
      { region: 'us-east-1', appId: 'd1' },
      { region: 'eu-west-1', appId: 'd2' },
    ];
    const copied = await copy(apps);
    expect(copied).toEqual(amplifyPolicy(apps));
    expect(JSON.stringify(copied)).not.toContain('apps/*');
    expect(status()).toHaveTextContent(
      'This policy covers the 2 apps the board reads with prod. Copy again after adding Amplify rows or columns that use this key.',
    );
  });

  it('says app for one app', async () => {
    await copy([{ region: 'us-east-1', appId: 'd1' }]);
    expect(status()).toHaveTextContent('covers the 1 app the board reads');
  });

  it('grants only ListApps when the board reads no app with the key', async () => {
    const copied = await copy([]);
    expect(copied).toEqual(amplifyPolicy([], true));
    expect(JSON.stringify(copied)).not.toContain('ListJobs');
    expect(JSON.stringify(copied)).toContain('ListApps');
    expect(status()).toHaveTextContent(
      'covers the 0 apps the board reads with prod',
    );
  });

  it('leaves out an app with an invalid app id, and says so', async () => {
    expect(
      await copy([
        { region: 'us-east-1', appId: 'd1' },
        { region: 'us-east-1', appId: '*' },
        { region: 'nowhere', appId: 'd9' },
      ]),
    ).toEqual(amplifyPolicy([{ region: 'us-east-1', appId: 'd1' }]));
    expect(status()).toHaveTextContent(
      'covers the 1 app the board reads with prod. Copy again after adding Amplify rows or columns that use this key. Left out 2 Amplify apps with an invalid region or app ID: fix them in the editor.',
    );
  });

  it('points to the README template when the browser refuses to copy', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    render(<CopyAwsPolicy name="prod" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy AWS policy' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(status()).toHaveTextContent(
      "Couldn't copy the policy. The README has it as a template.",
    );
  });
});
