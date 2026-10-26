/**
 * A dashboard's credentials (spec.md C-1a, C-5, C-6, C-7): enter a GitHub
 * token or AWS key, keep it for the tab or remember it on this device,
 * forget it, choose the defaults, copy one from another dashboard, and
 * remove it. Lists credentials by name. States the worst case plainly
 * and links the credential guide (C-3a). Secrets go to the credential
 * store; the dashboard records only ids and labels.
 *
 * The credentials collapse (Decision 32), like the editors' lists
 * (`useAccordion`): one open at a time, all closed at first; a credential
 * just added or copied opens and scrolls into view, and one just added
 * takes focus on its header (the form it was added from clears).
 *
 * @module
 */
import { useId, useState } from 'react';

import { ActionError } from '@/components/ActionError';
import { Choice } from '@/components/Choice';
import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActionError } from '@/components/useActionError';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import { useAccordion } from '@/editors/useAccordion';
import { readmeSection } from '@/lib/site';
import { useStores } from '@/storage/storesContext';

import { CredentialItem } from './CredentialItem';
import { addWithSecret, copyCredential } from './credentialOps';
import { sortByCredential, sortCredentials } from './credentialOrder';
import { KIND_LABEL } from './kindLabel';
import { SecretFields } from './SecretFields';
import { useCredentialVersion } from './useCredentialVersion';

export function CredentialsPanel({
  dashboard,
  otherDashboards,
  onChange,
  keyApps,
}: {
  dashboard: Dashboard;
  otherDashboards: readonly Dashboard[];
  onChange: (dashboard: Dashboard) => void;
  /** The Amplify apps the board reads with an AWS key, once its app
   * search has finished (*Copy AWS policy*). */
  keyApps?: (
    id: string,
  ) => readonly { region: string; appId: string }[] | undefined;
}): React.JSX.Element {
  useCredentialVersion();
  const { credentials } = useStores();
  const [error, run] = useActionError();
  const [kind, setKind] = useState<CredentialKind>('github');
  const [label, setLabel] = useState('');
  /** The credential just added here, whose header takes focus. */
  const [added, setAdded] = useState<string>();
  const addHeading = useId();
  const listed = sortCredentials(dashboard.credentials);
  const accordion = useAccordion(
    listed.map((c) => ({ key: c.id, targets: [] })),
  );
  const copyable = sortByCredential(
    otherDashboards.flatMap((d) =>
      d.credentials
        .filter((c) => credentials.get(c.id) !== undefined)
        .map((c) => ({ dashboard: d.name, credential: c })),
    ),
    (item) => item.credential,
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Credentials stay in this browser and are sent only to GitHub and AWS.{' '}
        <ExternalLink href={readmeSection('credentials')}>
          The credentials guide
        </ExternalLink>
      </p>
      <ActionError error={error} />

      {listed.length > 0 && (
        <ul className="flex flex-col gap-2">
          {listed.map((c) => (
            <li key={c.id}>
              <CredentialItem
                {...accordion.itemProps(c.id)}
                focus={added === c.id}
                dashboard={dashboard}
                credential={c}
                onChange={onChange}
                keyApps={keyApps?.(c.id)}
                run={run}
              />
            </li>
          ))}
        </ul>
      )}

      <section
        aria-labelledby={addHeading}
        className="flex flex-col gap-2 rounded-md border p-3"
      >
        <h3 id={addHeading} className="font-semibold">
          Add a credential
        </h3>
        <div className="flex gap-2">
          <Choice
            label="Kind"
            value={kind}
            options={(['github', 'aws'] as const).map((k) => ({
              value: k,
              label: KIND_LABEL[k],
            }))}
            onValueChange={(v) => {
              setKind(v);
            }}
          />
          <Input
            aria-label="Name"
            placeholder="Name, e.g. acme-board"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
          />
        </div>
        <SecretFields
          key={kind}
          kind={kind}
          newKeyName={label.trim() || 'this key'}
          submitLabel="Add"
          onSubmit={(secret, remember) =>
            run(() => {
              setAdded(
                addWithSecret(
                  credentials,
                  onChange,
                  dashboard,
                  { kind, label: label.trim() || KIND_LABEL[kind] },
                  secret,
                  remember,
                ),
              );
              setLabel('');
            })
          }
        />
      </section>

      {copyable.length > 0 && (
        <section className="flex flex-col gap-2 rounded-md border p-3">
          <h3 className="font-semibold">Copy from another dashboard</h3>
          <p className="text-xs text-muted-foreground">
            The copy is independent: forgetting it here leaves the original.
          </p>
          <ul className="flex flex-col gap-1">
            {copyable.map(({ dashboard: from, credential }) => (
              <li key={credential.id} className="flex items-center gap-2">
                <span>
                  {credential.label}{' '}
                  <span className="text-xs text-muted-foreground">
                    ({KIND_LABEL[credential.kind]}, {from})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    run(() => {
                      copyCredential(
                        credentials,
                        onChange,
                        dashboard,
                        credential,
                      );
                    });
                  }}
                >
                  Copy
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
