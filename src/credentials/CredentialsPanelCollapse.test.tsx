/**
 * Tests for the collapsing credentials panel (spec.md Decision 32, row
 * N4a): each credential a header (name, kind, remembered and default
 * marks) over its controls, one open at a time and all closed at first,
 * headers operable from the keyboard; a credential just added opens,
 * scrolls into view and takes focus; focus moves to the header when the
 * control used goes; *Remember* switches a secret between this device and
 * this tab; and a switch to this tab only that the device won't finish is
 * shown as it is, with how to clear what was left (fooboard#21).
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import type { AppStores } from '@/storage';
import type { KeyValueStore } from '@/storage/keyValue';
import { addForm, addToken, setupPanel } from '@/test/credentialsPanel';
import { focusElement } from '@/test/focus';
import { expand, isOpen, itemTrigger } from '@/test/openItem';
import { CLEAR_EVERYTHING_STEPS, refusingDevice } from '@/test/refusingDevice';

const token = { kind: 'github' as const, token: 'github_pat_1' };

/** A dashboard with a GitHub token (its default) and an AWS key. */
const twoCredentials = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  credentials: [
    { id: 'gh', kind: 'github', label: 'acme' },
    { id: 'key', kind: 'aws', label: 'prod' },
  ],
  settings: { githubToken: 'gh' },
});

/** The panel over \`twoCredentials\`, \`acme\`'s token remembered. */
const setup = (device?: KeyValueStore) =>
  setupPanel({
    initial: twoCredentials,
    device,
    seed: (stores: AppStores) => {
      stores.credentials.set('gh', token, true);
    },
  });

/** `acme`'s *Remember on this device*. */
const rememberBox = () =>
  within(screen.getByRole('region', { name: 'acme, GitHub token' })).getByRole(
    'checkbox',
    { name: /Remember/ },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the credentials panel', () => {
  it('shows each credential as its header, all closed at first, one open at a time', () => {
    setup();
    expect(itemTrigger('acme')).toHaveAccessibleName(
      'acme GitHub token · remembered · default',
    );
    expect(itemTrigger('prod')).toHaveAccessibleName(
      'prod AWS key · not entered',
    );
    expect([isOpen('acme'), isOpen('prod')]).toEqual([false, false]);
    expect(screen.queryByRole('button', { name: 'Forget' })).toBeNull();

    expand('acme');
    expect(screen.getByRole('button', { name: 'Forget' })).toBeVisible();
    expand('prod');
    expect([isOpen('acme'), isOpen('prod')]).toEqual([false, true]);
    expect(screen.queryByRole('button', { name: 'Forget' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Copy AWS policy' }),
    ).toBeVisible();
  });

  it('has headers that are buttons, reachable and operable from the keyboard', () => {
    setup();
    const trigger = itemTrigger('acme');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).not.toHaveAttribute('tabindex', '-1');
    // A native button: Enter and Space click it.
    focusElement(trigger);
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls');
  });

  it('opens a credential just added, scrolled into view, with focus on its header', () => {
    const scrolled = vi.fn();
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
      this: Element,
    ) {
      scrolled(this);
    });
    setup();
    expand('acme');
    addToken('beta', 'github_pat_2');
    expect([isOpen('acme'), isOpen('beta')]).toEqual([false, true]);
    expect(itemTrigger('beta')).toHaveFocus();
    expect(scrolled).toHaveBeenCalledWith(
      screen.getByRole('region', { name: 'beta, GitHub token' }),
    );
    expect(within(addForm()).getByLabelText('Name')).toHaveValue('');
  });

  it.each<[string, () => void]>([
    [
      'saving its secret',
      () => {
        expand('prod');
        fireEvent.change(screen.getByLabelText('Access key ID'), {
          target: { value: 'AKIA1' },
        });
        fireEvent.change(screen.getByLabelText('Secret access key'), {
          target: { value: 's' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      },
    ],
    [
      'Forget',
      () => {
        expand('acme');
        fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
      },
    ],
    [
      'Make dashboard default',
      () => {
        expand('prod');
        fireEvent.click(
          screen.getByRole('button', { name: 'Make dashboard default' }),
        );
      },
    ],
  ])('moves focus to the header after %s, whose control goes', (_, use) => {
    setup();
    use();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      [itemTrigger('acme'), itemTrigger('prod')].find(
        (t) => t.getAttribute('aria-expanded') === 'true',
      ),
    ).toHaveFocus();
  });
});

describe('Remember on an entered secret', () => {
  it('keeps the secret for this tab only when unticked, and on the device again when ticked', () => {
    const device = refusingDevice().device;
    const { stores } = setup(device);
    expand('acme');
    expect(rememberBox()).toBeChecked();
    fireEvent.click(rememberBox());
    expect(rememberBox()).not.toBeChecked();
    expect(itemTrigger('acme')).toHaveAccessibleName(/· this tab only ·/);
    expect(device.getItem('fooboard:credential:gh')).toBeNull();
    expect(stores.credentials.get('gh')).toEqual(token);
    fireEvent.click(rememberBox());
    expect(stores.credentials.isRemembered('gh')).toBe(true);
  });

  it('shows a secret as this tab’s when the device refuses to remove its copy, and says how to clear it (fooboard#21)', () => {
    const { device, refuse } = refusingDevice();
    const { stores } = setup(device);
    const heard = vi.fn();
    stores.credentials.subscribe(heard);
    expand('acme');
    refuse();
    fireEvent.click(rememberBox());
    expect(screen.getByRole('alert')).toHaveTextContent(CLEAR_EVERYTHING_STEPS);
    expect(heard).toHaveBeenCalledWith('gh', true);
    expect(rememberBox()).not.toBeChecked();
    expect(itemTrigger('acme')).toHaveAccessibleName(/· this tab only ·/);
  });
});
