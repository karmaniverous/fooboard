/**
 * An Amplify row's pinned apps in the row editor (spec.md §3.12 *Pinned
 * apps*): each pin's app and region, its AWS key edited in place (none:
 * it serves any cell whose key has no keyed pin), *Unpin* (asked first,
 * never a repo-less row's last pin), and *Pin* to add another. A pin's
 * region and app are changed by *Unpin* and then *Pin*.
 *
 * @module
 */
import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow, PinnedApp } from '@/domain/config/row';

import { CredentialSelect } from './CredentialSelect';
import type { Unset } from './dashboardDefault';

/** A pin without a key. */
const NO_KEY: Unset = { label: 'No key (serves any cell no keyed pin does)' };

export function PinnedApps({
  dashboard,
  row,
  onChange,
}: {
  dashboard: Dashboard;
  row: AmplifyRow;
  onChange: (row: AmplifyRow) => void;
}): React.JSX.Element {
  const setPins = (pinnedApps: PinnedApp[]) => {
    onChange({ ...row, pinnedApps });
  };
  const lastNeeded = row.repo === undefined && row.pinnedApps.length === 1;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold">Pinned apps</span>
      {row.pinnedApps.map((pin, i) => (
        <div
          // Not keyed by the pin's AWS key: editing it would remount the
          // row and lose focus.
          key={`${pin.region}-${pin.appId}-${String(i)}`}
          className="flex flex-wrap items-center gap-2"
        >
          <span>
            {pin.appId} in {pin.region}
          </span>
          <CredentialSelect
            dashboard={dashboard}
            kind="aws"
            value={pin.credentialId}
            unset={NO_KEY}
            label={`AWS key for ${row.displayName} pinned app ${pin.appId}`}
            onChange={(credentialId) => {
              setPins(
                row.pinnedApps.map((p, j) =>
                  j === i
                    ? {
                        region: p.region,
                        appId: p.appId,
                        ...(credentialId ? { credentialId } : {}),
                      }
                    : p,
                ),
              );
            }}
          />
          {!lastNeeded && (
            <ConfirmButton
              confirmLabel={`Unpin ${pin.appId}`}
              onConfirm={() => {
                setPins(row.pinnedApps.filter((_, j) => j !== i));
              }}
            >
              Unpin
            </ConfirmButton>
          )}
        </div>
      ))}
      <Pin
        dashboard={dashboard}
        name={row.displayName}
        onAdd={(pin) => {
          setPins([...row.pinnedApps, pin]);
        }}
      />
    </div>
  );
}

function Pin({
  dashboard,
  onAdd,
  name,
}: {
  dashboard: Dashboard;
  name: string;
  onAdd: (pin: PinnedApp) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [region, setRegion] = useState('');
  const [appId, setAppId] = useState('');
  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-1"
      aria-label={`Pin another app to ${name}`}
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({
          region: region.trim(),
          appId: appId.trim(),
          ...(credentialId ? { credentialId } : {}),
        });
        setRegion('');
        setAppId('');
      }}
    >
      <span className="w-full text-muted-foreground">Pin another app</span>
      <CredentialSelect
        dashboard={dashboard}
        kind="aws"
        value={credentialId}
        onChange={setCredentialId}
        unset={NO_KEY}
        label={`AWS key for a new ${name} pin`}
      />
      <Input
        aria-label={`Region for a new ${name} pin`}
        placeholder="Region"
        className="h-8 text-xs"
        value={region}
        onChange={(e) => {
          setRegion(e.target.value);
        }}
      />
      <Input
        aria-label={`App ID for a new ${name} pin`}
        placeholder="App ID"
        className="h-8 text-xs"
        value={appId}
        onChange={(e) => {
          setAppId(e.target.value);
        }}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!region.trim() || !appId.trim()}
      >
        Pin
      </Button>
    </form>
  );
}
