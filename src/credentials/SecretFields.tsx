/**
 * The secret fields for one credential kind (spec.md C-5, C-6, C-7): the
 * token or key, how to create it (a README link), *Copy AWS policy* for a
 * new AWS key (account-wide, since nothing has been read with it yet),
 * the worst case stated plainly, and *Remember on this device*.
 *
 * @module
 */
import { useId, useState } from 'react';

import { ExternalLink } from '@/components/ExternalLink';
import { SecretInput } from '@/components/SecretInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CredentialKind } from '@/domain/config/credentials';
import { readmeSection } from '@/lib/site';
import type { CredentialSecret } from '@/storage/credentialStore';

import { CopyAwsPolicy } from './CopyAwsPolicy';

/** The worst case, stated plainly on the token screen (spec.md C-7). */
const WORST_CASE: Record<CredentialKind, string> = {
  github:
    'If this token leaks, someone can read the repos you selected, including their code. With the permissions in the guide, they can’t change anything.',
  aws: 'If this key leaks, someone can list the names of every Amplify app in the account (AWS allows no narrower listing) and read branch and job details for the apps in its policy, and nothing else in your AWS account.',
};

/** How to create each kind, in the README. */
const HOW_TO: Record<CredentialKind, string> = {
  github: 'How to create a read-only token',
  aws: 'How to create a read-only key',
};

/** Secret fields for one kind; returns the secret once complete. */
export function SecretFields({
  kind,
  onSubmit,
  submitLabel,
  newKeyName,
}: {
  kind: CredentialKind;
  /** A new AWS key's name: offers its *Copy AWS policy*. */
  newKeyName?: string;
  /** Returns whether it was stored; the fields clear only then. */
  onSubmit: (secret: CredentialSecret, remember: boolean) => boolean;
  submitLabel: string;
}): React.JSX.Element {
  const [token, setToken] = useState('');
  const [keyId, setKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [remember, setRemember] = useState(false);
  const rememberId = useId();
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
        if (secret && onSubmit(secret, remember)) {
          setToken('');
          setKeyId('');
          setSecretKey('');
        }
      }}
    >
      {kind === 'github' ? (
        <SecretInput
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
          <SecretInput
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
      <div className="flex items-center gap-2">
        <Checkbox
          id={rememberId}
          checked={remember}
          onCheckedChange={(checked) => {
            setRemember(checked === true);
          }}
        />
        <Label htmlFor={rememberId}>
          Remember on this device (otherwise kept only until this tab closes)
        </Label>
      </div>
      <ExternalLink href={readmeSection(kind)} className="self-start text-xs">
        {HOW_TO[kind]}
      </ExternalLink>
      {kind === 'aws' && newKeyName !== undefined && (
        <CopyAwsPolicy name={newKeyName} />
      )}
      <p className="text-xs text-muted-foreground">
        {WORST_CASE[kind]}{' '}
        <ExternalLink href={readmeSection('leaks')}>
          What a leak exposes, and how to revoke
        </ExternalLink>
      </p>
      <Button type="submit" size="sm" disabled={!secret} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
