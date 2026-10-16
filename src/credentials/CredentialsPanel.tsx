/**
 * A dashboard's credentials (spec.md C-1a, C-5, C-6, C-7): enter a GitHub
 * token or AWS key, keep it for the tab or remember it on this device,
 * forget it, choose the defaults, copy one from another dashboard, and
 * remove it. States the worst case plainly and links the credential guide
 * (C-3a). Secrets go to the credential store; the dashboard records only
 * ids and labels.
 *
 * @module
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  CredentialKind,
  CredentialRef,
} from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { CredentialSecret } from '@/storage/credentialStore';
import { useStores } from '@/storage/storesContext';

import {
  addCredential,
  newCredentialId,
  removeCredential,
  setDefaultCredential,
} from './dashboardCredentials';
import { expiryWarning } from './expiry';
import { useCredentialVersion } from './useCredentialVersion';

const KIND_LABEL: Record<CredentialKind, string> = {
  github: 'GitHub token',
  aws: 'AWS key',
};

/** The worst case, stated plainly on the token screen (spec.md C-7). */
const WORST_CASE: Record<CredentialKind, string> = {
  github:
    'If this token leaks, someone can read the repos you selected, including their code. With the permissions in the guide, they can’t change anything.',
  aws: 'If this key leaks, someone can read app, branch and job details for the Amplify apps in its policy, and nothing else in your AWS account.',
};

const GUIDE = '/guide/credentials';

/** Secret fields for one kind; returns the secret once complete. */
function SecretFields({
  kind,
  onSubmit,
  submitLabel,
}: {
  kind: CredentialKind;
  onSubmit: (secret: CredentialSecret, remember: boolean) => void;
  submitLabel: string;
}): React.JSX.Element {
  const [token, setToken] = useState('');
  const [keyId, setKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [remember, setRemember] = useState(false);
  const secret: CredentialSecret | undefined =
    kind === 'github'
      ? token.trim()
        ? { kind, token: token.trim() }
        : undefined
      : keyId.trim() && secretKey.trim()
        ? {
            kind,
            accessKeyId: keyId.trim(),
            secretAccessKey: secretKey.trim(),
          }
        : undefined;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (secret) onSubmit(secret, remember);
      }}
    >
      {kind === 'github' ? (
        <Input
          type="password"
          aria-label="Token"
          placeholder="github_pat_…"
          autoComplete="off"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
          }}
        />
      ) : (
        <>
          <Input
            aria-label="Access key ID"
            placeholder="Access key ID"
            autoComplete="off"
            value={keyId}
            onChange={(e) => {
              setKeyId(e.target.value);
            }}
          />
          <Input
            type="password"
            aria-label="Secret access key"
            placeholder="Secret access key"
            autoComplete="off"
            value={secretKey}
            onChange={(e) => {
              setSecretKey(e.target.value);
            }}
          />
        </>
      )}
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
          }}
        />
        Remember on this device (otherwise kept only until this tab closes)
      </label>
      <p className="text-xs text-muted-foreground">
        {WORST_CASE[kind]}{' '}
        <Link to={`${GUIDE}#leaks`} className="underline underline-offset-2">
          What a leak exposes, and how to revoke
        </Link>
      </p>
      <Button type="submit" size="sm" disabled={!secret} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}

function CredentialItem({
  dashboard,
  credential,
  onChange,
  tokenExpiry,
}: {
  dashboard: Dashboard;
  credential: CredentialRef;
  onChange: (dashboard: Dashboard) => void;
  tokenExpiry?: (id: string) => string | undefined;
}): React.JSX.Element {
  const { credentials } = useStores();
  const [confirmRemove, setConfirmRemove] = useState(false);
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
            <span className="text-xs text-muted-foreground">Default</span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(setDefaultCredential(dashboard, kind, id));
              }}
            >
              Make default
            </Button>
          )}
          {entered && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                credentials.forget(id);
              }}
            >
              Forget
            </Button>
          )}
          {confirmRemove ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  credentials.forget(id);
                  onChange(removeCredential(dashboard, id));
                }}
              >
                Remove {label}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConfirmRemove(false);
                }}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setConfirmRemove(true);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {!entered && (
        <SecretFields
          kind={kind}
          submitLabel="Save"
          onSubmit={(secret, remember) => {
            credentials.set(id, secret, remember);
          }}
        />
      )}
    </li>
  );
}

export function CredentialsPanel({
  dashboard,
  otherDashboards,
  onChange,
  tokenExpiry,
}: {
  dashboard: Dashboard;
  otherDashboards: readonly Dashboard[];
  onChange: (dashboard: Dashboard) => void;
  /** A GitHub token's reported expiry, once the board has used it. */
  tokenExpiry?: (id: string) => string | undefined;
}): React.JSX.Element {
  useCredentialVersion();
  const { credentials } = useStores();
  const [kind, setKind] = useState<CredentialKind>('github');
  const [label, setLabel] = useState('');
  const copyable = otherDashboards.flatMap((d) =>
    d.credentials
      .filter((c) => credentials.get(c.id) !== undefined)
      .map((c) => ({ dashboard: d.name, credential: c })),
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Credentials stay in this browser and are sent only to GitHub and AWS.{' '}
        <Link to={GUIDE} className="underline underline-offset-2">
          How to create a read-only token or key
        </Link>
      </p>

      {dashboard.credentials.length > 0 && (
        <ul className="flex flex-col gap-2">
          {dashboard.credentials.map((c) => (
            <CredentialItem
              key={c.id}
              dashboard={dashboard}
              credential={c}
              onChange={onChange}
              tokenExpiry={tokenExpiry}
            />
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2 rounded-md border p-3">
        <h3 className="font-semibold">Add a credential</h3>
        <div className="flex gap-2">
          <select
            aria-label="Kind"
            className="rounded-md border bg-background px-2 text-sm"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as CredentialKind);
            }}
          >
            <option value="github">{KIND_LABEL.github}</option>
            <option value="aws">{KIND_LABEL.aws}</option>
          </select>
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
          submitLabel="Add"
          onSubmit={(secret, remember) => {
            const id = newCredentialId();
            credentials.set(id, secret, remember);
            onChange(
              addCredential(dashboard, {
                id,
                kind,
                label: label.trim() || KIND_LABEL[kind],
              }),
            );
            setLabel('');
          }}
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
                    const id = newCredentialId();
                    credentials.copy(credential.id, id);
                    onChange(addCredential(dashboard, { ...credential, id }));
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
