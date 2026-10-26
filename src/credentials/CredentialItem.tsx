/**
 * One of a dashboard's credentials in the panel (spec.md §2.3, Decision
 * 32): a collapsing item (`CollapsibleItem`) whose header shows its name,
 * kind, whether its secret is remembered, kept for this tab only or not
 * entered, and whether it is the dashboard's default;
 * and whose body holds its secret (entering it, *Remember on this device*,
 * *Forget*), *Make dashboard default*, *Remove* and, for an AWS key, its
 * own *Copy AWS policy* (§3.12). Which item is open is the panel's.
 *
 * When the control just used goes (the secret's fields once it is saved,
 * *Forget* once it is forgotten, *Make dashboard default* once it is the
 * default), focus moves to the item's header, so it isn't lost.
 *
 * @module
 */
import { useEffect, useRef } from 'react';

import {
  CollapsibleItem,
  type ItemOpenState,
} from '@/components/CollapsibleItem';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { WithTooltip } from '@/components/ui/tooltip';
import type { CredentialRef } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import { useStores } from '@/storage/storesContext';

import { CopyAwsPolicy } from './CopyAwsPolicy';
import { removeWithSecret } from './credentialOps';
import { FIELD_OF, setDefaultCredential } from './dashboardCredentials';
import { KIND_LABEL } from './kindLabel';
import { RememberCheckbox } from './RememberCheckbox';
import { SecretFields } from './SecretFields';

export function CredentialItem({
  dashboard,
  credential,
  onChange,
  keyApps,
  run,
  focus = false,
  ...openState
}: ItemOpenState & {
  dashboard: Dashboard;
  credential: CredentialRef;
  onChange: (dashboard: Dashboard) => void;
  /** The apps the board reads with this AWS key, once searched. */
  keyApps?: readonly { region: string; appId: string }[];
  run: (action: () => void) => boolean;
  /** Take focus on its header (a credential just added). */
  focus?: boolean;
}): React.JSX.Element {
  const { credentials } = useStores();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus) trigger.current?.focus();
  }, [focus]);
  const { id, kind, label } = credential;
  const secret = credentials.get(id);
  const entered = secret !== undefined;
  const remembered = entered && credentials.isRemembered(id);
  const isDefault = dashboard.settings[FIELD_OF[kind]] === id;
  /** Run a change to the secret; if it entered or removed the secret,
   * the control used is gone, so focus moves to the header. */
  const runOnSecret = (action: () => void): boolean => {
    const done = run(action);
    if ((credentials.get(id) !== undefined) !== entered)
      trigger.current?.focus();
    return done;
  };
  // Short, so a phone's header shows it (the body says it in full).
  const state = entered
    ? remembered
      ? 'remembered'
      : 'this tab only'
    : 'not entered';
  return (
    <CollapsibleItem
      {...openState}
      triggerRef={trigger}
      name={label}
      label={`${label}, ${KIND_LABEL[kind]}`}
      summary={[
        KIND_LABEL[kind],
        state,
        ...(isDefault ? ['default'] : []),
      ].join(' · ')}
    >
      <div className="flex flex-col gap-2 pl-5">
        {entered ? (
          <RememberCheckbox
            checked={remembered}
            onCheckedChange={(remember) => {
              run(() => {
                credentials.set(id, secret, remember);
              });
            }}
          />
        ) : (
          <SecretFields
            kind={kind}
            submitLabel="Save"
            onSubmit={(next, remember) =>
              runOnSecret(() => {
                credentials.set(id, next, remember);
              })
            }
          />
        )}
        <div className="flex flex-wrap items-center gap-1">
          {isDefault ? (
            <WithTooltip
              label={`Cells use this ${KIND_LABEL[kind]} unless a group, row, column or cell sets another.`}
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
                if (
                  run(() => {
                    onChange(setDefaultCredential(dashboard, kind, id));
                  })
                )
                  trigger.current?.focus();
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
                runOnSecret(() => {
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
        {kind === 'aws' && <CopyAwsPolicy name={label} apps={keyApps} />}
      </div>
    </CollapsibleItem>
  );
}
