/**
 * An Amplify row's sources in the row editor (spec.md C-21): each source's
 * app and region, its AWS key (inherit, or one of the dashboard's keys:
 * the same choice as when adding it, editable at any time), deleting a
 * source (asked first, never the last one), and adding another source.
 *
 * @module
 */
import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Dashboard } from '@/domain/config/dashboard';
import { inheritedCredential } from '@/domain/config/inheritance';
import type { AmplifyRow, AmplifySource } from '@/domain/config/row';

import { CredentialSelect, type Inherited } from './CredentialSelect';

export function AmplifySources({
  dashboard,
  row,
  onChange,
}: {
  dashboard: Dashboard;
  row: AmplifyRow;
  onChange: (row: AmplifyRow) => void;
}): React.JSX.Element {
  const inherited = inheritedCredential(dashboard, row.id, 'aws');
  const setSources = (sources: AmplifySource[]) => {
    onChange({ ...row, sources });
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold">Sources</span>
      {row.sources.map((s, i) => (
        <div
          key={`${s.region}-${s.appId}`}
          className="flex flex-wrap items-center gap-2"
        >
          <span>
            {s.appId} in {s.region}
          </span>
          <CredentialSelect
            dashboard={dashboard}
            kind="aws"
            value={s.credentialId}
            onChange={(credentialId) => {
              setSources(
                row.sources.map((x, j) =>
                  j === i ? { ...x, credentialId } : x,
                ),
              );
            }}
            inherited={inherited}
            label={`AWS key for ${row.displayName} source ${s.appId}`}
          />
          {row.sources.length > 1 && (
            <ConfirmButton
              confirmLabel={`Delete source ${s.appId}`}
              onConfirm={() => {
                setSources(row.sources.filter((_, j) => j !== i));
              }}
            >
              Delete source
            </ConfirmButton>
          )}
        </div>
      ))}
      <AddSource
        dashboard={dashboard}
        name={row.displayName}
        inherited={inherited}
        onAdd={(source) => {
          setSources([...row.sources, source]);
        }}
      />
    </div>
  );
}

function AddSource({
  dashboard,
  onAdd,
  name,
  inherited,
}: {
  dashboard: Dashboard;
  name: string;
  /** What an unset key inherits: the row's group's or the dashboard's. */
  inherited: Inherited;
  onAdd: (source: AmplifySource) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [region, setRegion] = useState('');
  const [appId, setAppId] = useState('');
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ credentialId, region: region.trim(), appId: appId.trim() });
        setRegion('');
        setAppId('');
      }}
    >
      <CredentialSelect
        dashboard={dashboard}
        kind="aws"
        value={credentialId}
        onChange={setCredentialId}
        inherited={inherited}
        label={`AWS key for a new ${name} source`}
      />
      <Input
        aria-label={`Region for a new ${name} source`}
        placeholder="Region"
        className="h-8 text-xs"
        value={region}
        onChange={(e) => {
          setRegion(e.target.value);
        }}
      />
      <Input
        aria-label={`App ID for a new ${name} source`}
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
        Add source
      </Button>
    </form>
  );
}
