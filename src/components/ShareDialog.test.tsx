/**
 * Tests for the *Share / Export* dialog (spec.md C-19, §3.8): the saved
 * dashboards' sharing beside the demo's link; with none saved (or none
 * readable), only the demo, with a note.
 *
 * @module
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { renderShell } from '@/test/renderShell';
import { shareBoard } from '@/test/shareBoard';

import { ShareDialog } from './ShareDialog';

const show = (setUp: (stores: ReturnType<typeof createAppStores>) => void) => {
  const device = memoryStorage();
  const stores = createAppStores(device);
  setUp(stores);
  renderShell(
    <ShareDialog open onOpenChange={() => undefined} />,
    undefined,
    stores,
  );
};

describe('ShareDialog', () => {
  it('offers the saved dashboards beside the demo link', () => {
    show((stores) => {
      stores.config.saveDashboard(shareBoard());
    });
    expect(
      screen.getByRole('region', { name: 'Your dashboards' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'The demo' }),
    ).toBeInTheDocument();
  });

  it('shares only the demo when no dashboard is saved', () => {
    show(() => undefined);
    expect(
      screen.queryByRole('region', { name: 'Your dashboards' }),
    ).toBeNull();
    expect(screen.getByText(/Create or import a dashboard/)).toBeVisible();
    expect(screen.getByLabelText('Demo link')).toBeInTheDocument();
  });
});
