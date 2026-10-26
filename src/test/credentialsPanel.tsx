/**
 * Test helpers for the credentials panel: a dashboard's panel rendered
 * with its stores, saving every change as the app does, and adding a
 * GitHub token from its form as a user does.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { CredentialsPanel } from '@/credentials/CredentialsPanel';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import { type AppStores, createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

const blank = DashboardSchema.parse({ id: 'd', name: 'D' });

export function setupPanel({
  initial = blank,
  others = [],
  expiry,
  seed,
  keyApps,
  device = memoryStorage(),
}: {
  initial?: Dashboard;
  others?: Dashboard[];
  expiry?: string;
  seed?: (stores: AppStores) => void;
  keyApps?: Record<string, { region: string; appId: string }[]>;
  /** The device store, e.g. one that refuses removals. */
  device?: KeyValueStore;
} = {}): { stores: AppStores; latest: { current: Dashboard } } {
  const stores = createAppStores(device);
  seed?.(stores);
  const latest = { current: initial };
  function Harness(): React.JSX.Element {
    const [dashboard, setDashboard] = useState(initial);
    return (
      <CredentialsPanel
        dashboard={dashboard}
        otherDashboards={others}
        tokenExpiry={() => expiry}
        keyApps={(id) => keyApps?.[id]}
        onChange={(next) => {
          latest.current = DashboardSchema.parse(next);
          setDashboard(next);
        }}
      />
    );
  }
  render(
    <StoresContext value={stores}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </StoresContext>,
  );
  return { stores, latest };
}

/** The panel's *Add a credential* form. */
export const addForm = (): HTMLElement =>
  screen.getByRole('region', { name: 'Add a credential' });

/** Add a GitHub token from the form, remembered if `remember`. */
export const addToken = (
  name: string,
  token: string,
  remember = false,
): void => {
  const form = within(addForm());
  fireEvent.change(form.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(form.getByLabelText('Token'), {
    target: { value: token },
  });
  if (remember) fireEvent.click(form.getByLabelText(/Remember on this device/));
  fireEvent.click(form.getByRole('button', { name: 'Add' }));
};
