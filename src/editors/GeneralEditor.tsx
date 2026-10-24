/**
 * The editor's General tab (spec.md C-21): rename, the dashboard's
 * default row rules, its *Settings* (the shared settings editor, spec.md
 * §3.11), duplicate and delete (which also
 * drops the dashboard's device preferences and its credentials' secrets),
 * and requests in flight per platform (spec.md §3.2).
 *
 * @module
 */
import { useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { useActionError } from '@/components/useActionError';
import { deleteWithSecrets, saveDuplicate } from '@/credentials/credentialOps';
import type { Dashboard } from '@/domain/config/dashboard';
import { targetKey } from '@/editors/editTarget';
import { useStores } from '@/storage/storesContext';

import { duplicateDashboard } from './edit';
import { CommitInput } from './fields';
import { RequestsInFlight } from './RequestsInFlight';
import { setDashboardRowRule } from './rowRuleEdit';
import { ProviderRules } from './rules/ProviderRules';
import { SettingsEditor } from './settings/SettingsEditor';

export function GeneralEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const { config, credentials, preferences } = useStores();
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
      <ProviderRules
        title="Default row rules"
        target={targetKey({ kind: 'dashboard', part: 'rowRules' })}
        rules={{
          github: dashboard.rowRules.github?.record,
          amplify: dashboard.rowRules.amplify?.record,
        }}
        onChange={(p, record) => {
          onChange(setDashboardRowRule(dashboard, p, record));
        }}
      />
      <SettingsEditor
        dashboard={dashboard}
        place={{ level: 'dashboard' }}
        onChange={onChange}
      />
      <RequestsInFlight dashboard={dashboard} onChange={onChange} />
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
              navigate(`/d/${copy.id}`);
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
                  preferences.forget(id);
                },
                dashboard,
              );
              navigate('/');
            });
          }}
        >
          Delete dashboard
        </ConfirmButton>
      </div>
    </div>
  );
}
