/**
 * *Copy AWS policy* on the AWS key form (spec.md C-3a): copies the
 * read-only IAM policy for the dashboard's Amplify apps, and says what it
 * copied.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { copyText } from '@/lib/clipboard';

import { amplifyPolicy, dashboardApps } from './iamPolicy';

export function CopyAwsPolicy({
  dashboard,
}: {
  dashboard: Dashboard;
}): React.JSX.Element {
  const apps = dashboardApps(dashboard);
  const [said, setSaid] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => {
          const json = JSON.stringify(amplifyPolicy(apps), null, 2);
          void copyText(json).then((ok) => {
            setSaid(
              !ok
                ? "Couldn't copy the policy. The README has it as a template."
                : apps.length
                  ? `Copied: read-only access to this dashboard's ${String(apps.length)} Amplify ${apps.length === 1 ? 'app' : 'apps'}.`
                  : 'Copied: listing apps only. Copy it again after adding Amplify rows, so the key can read them.',
            );
          });
        }}
      >
        <Copy aria-hidden className="size-4" />
        Copy AWS policy
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {said}
      </span>
    </div>
  );
}
