/**
 * First run, step 1 (spec.md §3.9, C-22): name the dashboard and add a
 * GitHub token, with the guide to creating one a click away
 * (`SecretFields`, C-3a). Adding it saves the new dashboard with the
 * token as its first credential, which becomes the dashboard's
 * `githubToken` (§3.11, `addCredential`), and goes on to the repos.
 * New dashboards use the built-in source rules and status sets.
 *
 * @module
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { Input } from '@/components/ui/input';
import { useActionError } from '@/components/useActionError';
import { addWithSecret } from '@/credentials/credentialOps';
import { KIND_LABEL } from '@/credentials/kindLabel';
import { SecretFields } from '@/credentials/SecretFields';
import { createDashboard } from '@/domain/config/presets';
import { useStores } from '@/storage/storesContext';

import { firstRunPath } from './paths';
import { StepFrame } from './StepFrame';

/** The name a dashboard gets when none is typed. */
const DEFAULT_DASHBOARD_NAME = 'My dashboard';

export function TokenStep(): React.JSX.Element {
  const { config, credentials } = useStores();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, run] = useActionError();
  return (
    <StepFrame step={1} title="Add a GitHub token">
      <p className="text-sm text-muted-foreground">
        fooboard reads your repos&apos; Actions runs with a read-only GitHub
        token. It stays in this browser and is sent only to GitHub.
      </p>
      <Input
        aria-label="Dashboard name"
        placeholder={`Dashboard name (${DEFAULT_DASHBOARD_NAME})`}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <ActionError error={error} />
      <SecretFields
        kind="github"
        submitLabel="Add the token"
        onSubmit={(secret, remember) =>
          run(() => {
            const dashboard = createDashboard(
              name.trim() || DEFAULT_DASHBOARD_NAME,
            );
            addWithSecret(
              credentials,
              (saved) => {
                config.saveDashboard(saved);
              },
              dashboard,
              { kind: 'github', label: KIND_LABEL.github },
              secret,
              remember,
            );
            navigate(firstRunPath(dashboard.id, 'repos'));
          })
        }
      />
    </StepFrame>
  );
}
