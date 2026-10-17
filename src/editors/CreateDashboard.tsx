/**
 * Create a dashboard (spec.md C-21): a name and a starting set of stages
 * (a branch preset, or none), saved and opened at once.
 *
 * @module
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionError } from '@/components/useActionError';
import { type BranchPresetId, createDashboard } from '@/domain/config/presets';
import { useStores } from '@/storage/storesContext';

/** Preset choices, described by the stages they create. */
const PRESET_CHOICES: { id: BranchPresetId; label: string }[] = [
  {
    id: 'env-branches',
    label: 'Environment branches: dev, staging, prod (main)',
  },
  { id: 'gitflow-ish', label: 'Gitflow: develop, release/**, main' },
  {
    id: 'previews-release-train',
    label: 'Release train: dev, release/**, main (add preview stages after)',
  },
  { id: 'custom', label: 'Blank: add stages yourself' },
];

export function CreateDashboard(): React.JSX.Element {
  const { config } = useStores();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<BranchPresetId>('env-branches');
  const [error, run] = useActionError();
  return (
    <form
      className="flex w-full flex-col gap-2 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => {
          const dashboard = createDashboard(name.trim(), preset);
          config.saveDashboard(dashboard);
          void navigate(`/d/${dashboard.id}`);
        });
      }}
    >
      <Input
        aria-label="Dashboard name"
        placeholder="Dashboard name, e.g. Acme platform"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <NativeSelect
        aria-label="Starting stages"
        className="h-9 px-2 text-sm"
        value={preset}
        onChange={(e) => {
          setPreset(e.target.value as BranchPresetId);
        }}
      >
        {PRESET_CHOICES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </NativeSelect>
      <ActionError error={error} />
      <Button type="submit" disabled={!name.trim()} className="self-start">
        Create a dashboard
      </Button>
    </form>
  );
}
