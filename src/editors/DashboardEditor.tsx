/**
 * The dashboard editor (spec.md C-21): general settings (rename,
 * duplicate, delete), rows, stages, mapping rules and colours. Every
 * change is validated against the dashboard schema before it is saved, so
 * an edit can never leave a dashboard that won't load.
 *
 * @module
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { ConfirmButton } from '@/components/ConfirmButton';
import { ToggleButton } from '@/components/ToggleButton';
import { Button } from '@/components/ui/button';
import { useActionError } from '@/components/useActionError';
import { deleteWithSecrets, saveDuplicate } from '@/credentials/credentialOps';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { EngineProviders } from '@/engine';
import { describeError } from '@/lib/errors';
import { useStores } from '@/storage/storesContext';

import type { EditorDraft } from './draft';
import { duplicateDashboard } from './edit';
import { CommitInput } from './fields';
import { RowsEditor } from './RowsEditor';
import { ColorsEditor, MappingEditor } from './SettingsEditors';
import { StagesEditor } from './StagesEditor';

const TABS = ['General', 'Rows', 'Stages', 'Mapping', 'Colours'] as const;
type Tab = (typeof TABS)[number];

function GeneralEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const { config, credentials } = useStores();
  const navigate = useNavigate();
  const [error, run] = useActionError();
  return (
    <div className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Name</span>
        <CommitInput
          label="Dashboard name"
          value={dashboard.name}
          onCommit={(name) => {
            onChange({ ...dashboard, name });
          }}
        />
      </label>
      <ActionError error={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            run(() => {
              const copy = saveDuplicate(
                credentials,
                (d) => {
                  config.saveDashboard(d);
                },
                (rekey) =>
                  duplicateDashboard(
                    dashboard,
                    crypto.randomUUID(),
                    `${dashboard.name} (copy)`,
                    rekey,
                  ),
              );
              void navigate(`/d/${copy.id}`);
            });
          }}
        >
          Duplicate
        </Button>
        <ConfirmButton
          confirmLabel={`Delete ${dashboard.name}`}
          onConfirm={() => {
            run(() => {
              deleteWithSecrets(
                credentials,
                (id) => {
                  config.removeDashboard(id);
                },
                dashboard,
              );
              void navigate('/');
            });
          }}
        >
          Delete dashboard
        </ConfirmButton>
      </div>
    </div>
  );
}

export function DashboardEditor({
  dashboard,
  providers,
  onChange,
  draft,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onChange: (dashboard: Dashboard) => void;
  /** Open on a pre-filled fix (*Add test* from an unmapped run). */
  draft?: EditorDraft;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(draft?.tab ?? 'General');
  const [error, setError] = useState<string | null>(null);
  const update = (next: Dashboard) => {
    const parsed = DashboardSchema.safeParse(next);
    if (parsed.success) {
      try {
        onChange(parsed.data);
        setError(null);
      } catch (err) {
        setError(describeError(err));
      }
    } else {
      setError(parsed.error.issues.map((i) => i.message).join('; '));
    }
  };
  const props = { dashboard, providers, onChange: update };
  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Editor section"
        className="flex flex-wrap gap-1"
      >
        {TABS.map((t) => (
          <ToggleButton
            key={t}
            pressed={tab === t}
            className="rounded-md border px-2 py-1"
            onClick={() => {
              setTab(t);
            }}
          >
            {t}
          </ToggleButton>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-status-failure">
          Not saved: {error}
        </p>
      )}
      {tab === 'General' && <GeneralEditor {...props} />}
      {tab === 'Rows' && (
        <RowsEditor
          {...props}
          draft={draft?.tab === 'Rows' ? draft : undefined}
        />
      )}
      {tab === 'Stages' && (
        <StagesEditor
          {...props}
          draftPattern={draft?.tab === 'Stages' ? draft.pattern : undefined}
        />
      )}
      {tab === 'Mapping' && <MappingEditor {...props} />}
      {tab === 'Colours' && <ColorsEditor {...props} />}
    </div>
  );
}
