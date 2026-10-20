/**
 * The editor's General tab (spec.md C-21): rename, the dashboard's
 * default row rules and item rules (item rules only for sources whose
 * source rule reads items, A§4.3.7), duplicate and delete.
 *
 * @module
 */
import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { useActionError } from '@/components/useActionError';
import { deleteWithSecrets, saveDuplicate } from '@/credentials/credentialOps';
import type { Dashboard } from '@/domain/config/dashboard';
import { ITEM_NAME_PATH } from '@/domain/model/keys';
import { targetKey } from '@/editors/editTarget';
import { useStores } from '@/storage/storesContext';

import { duplicateDashboard } from './edit';
import { CommitInput } from './fields';
import { setDashboardRowRule } from './rowRuleEdit';
import { ProviderRules } from './rules/ProviderRules';
import { SourcesWithItemsContext } from './rules/samples';

export function GeneralEditor({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const { config, credentials } = useStores();
  const navigate = useNavigate();
  const [error, run] = useActionError();
  const withItems = useContext(SourcesWithItemsContext);
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
          onChange(setDashboardRowRule(dashboard, p, 'record', record));
        }}
      />
      <ProviderRules
        title="Default item rules"
        scope="item"
        newPath={ITEM_NAME_PATH}
        target={targetKey({ kind: 'dashboard', part: 'itemRules' })}
        providers={withItems}
        rules={{
          github: dashboard.rowRules.github?.items,
          amplify: dashboard.rowRules.amplify?.items,
        }}
        onChange={(p, items) => {
          onChange(setDashboardRowRule(dashboard, p, 'items', items));
        }}
      />
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
