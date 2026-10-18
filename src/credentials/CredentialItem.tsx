/**
 * One of a dashboard's credentials in the panel (spec.md C-1a, C-5): its
 * label and kind, whether its secret is entered, its expiry warning, and
 * entering, forgetting, defaulting and removing it.
 *
 * @module
 */
import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { WithTooltip } from '@/components/ui/tooltip';
import type { CredentialRef } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import { useStores } from '@/storage/storesContext';

import { removeWithSecret } from './credentialOps';
import { setDefaultCredential } from './dashboardCredentials';
import { expiryWarning } from './expiry';
import { KIND_LABEL } from './kindLabel';
import { SecretFields } from './SecretFields';

export function CredentialItem({
  dashboard,
  credential,
  onChange,
  tokenExpiry,
  run,
}: {
  dashboard: Dashboard;
  credential: CredentialRef;
  onChange: (dashboard: Dashboard) => void;
  tokenExpiry?: (id: string) => string | undefined;
  run: (action: () => void) => boolean;
}): React.JSX.Element {
  const { credentials } = useStores();
  // Expiry is counted in days; the time the panel opened is precise enough.
  const [openedAt] = useState(() => Date.now());
  const { id, kind, label } = credential;
  const entered = credentials.get(id) !== undefined;
  const isDefault = dashboard.defaultCredentials[kind] === id;
  const warning =
    kind === 'github' ? expiryWarning(tokenExpiry?.(id), openedAt) : undefined;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {KIND_LABEL[kind]}
          {entered
            ? credentials.isRemembered(id)
              ? ' · remembered on this device'
              : ' · this tab only'
            : ' · not entered on this device'}
        </span>
        {warning && (
          <span className="rounded bg-badge-behind px-1.5 text-xs text-badge-behind-text">
            {warning}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {isDefault ? (
            <WithTooltip
              label={`Rows use this ${KIND_LABEL[kind]} unless they or their group choose another.`}
            >
              <span tabIndex={0} className="text-xs text-muted-foreground">
                {`Dashboard's default ${KIND_LABEL[kind]}`}
              </span>
            </WithTooltip>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                run(() => {
                  onChange(setDefaultCredential(dashboard, kind, id));
                });
              }}
            >
              Make dashboard default
            </Button>
          )}
          {entered && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                run(() => {
                  credentials.forget(id);
                });
              }}
            >
              Forget
            </Button>
          )}
          <ConfirmButton
            confirmLabel={`Remove ${label}`}
            onConfirm={() => {
              run(() => {
                removeWithSecret(credentials, onChange, dashboard, id);
              });
            }}
          >
            Remove
          </ConfirmButton>
        </div>
      </div>
      {!entered && (
        <SecretFields
          dashboard={dashboard}
          kind={kind}
          submitLabel="Save"
          onSubmit={(secret, remember) =>
            run(() => {
              credentials.set(id, secret, remember);
            })
          }
        />
      )}
    </li>
  );
}
