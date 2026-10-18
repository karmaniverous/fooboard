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
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <Tabs
      className="flex flex-col gap-3"
      value={tab}
      onValueChange={(v) => {
        const next = TABS.find((t) => t === v);
        if (next) setTab(next);
      }}
    >
      <TabsList aria-label="Editor section">
        {TABS.map((t) => (
          <TabsTrigger key={t} value={t}>
            {t}
          </TabsTrigger>
        ))}
      </TabsList>
      {error && (
        <p role="alert" className="text-xs text-status-failure">
          Not saved: {error}
        </p>
      )}
      {/* Only the open tab's panel is mounted (Radix's default). */}
      <TabsContent value="General">
        <GeneralEditor {...props} />
      </TabsContent>
      <TabsContent value="Rows">
        <RowsEditor
          {...props}
          draft={draft?.tab === 'Rows' ? draft : undefined}
        />
      </TabsContent>
      <TabsContent value="Stages">
        <StagesEditor
          {...props}
          draftPattern={draft?.tab === 'Stages' ? draft.pattern : undefined}
        />
      </TabsContent>
      <TabsContent value="Mapping">
        <MappingEditor {...props} />
      </TabsContent>
      <TabsContent value="Colours">
        <ColorsEditor {...props} />
      </TabsContent>
    </Tabs>
  );
}
