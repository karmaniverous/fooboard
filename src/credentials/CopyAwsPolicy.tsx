/**
 * *Copy AWS policy* on the AWS key form (spec.md C-3a): copies the
 * read-only IAM policy for the dashboard's Amplify apps (account-wide
 * while it has none), and says what it copied.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import { copyText } from '@/lib/clipboard';

import { amplifyPolicy, dashboardApps } from './iamPolicy';

const nApps = (n: number) => `${String(n)} Amplify ${n === 1 ? 'app' : 'apps'}`;

/** What the button says after copying `count` apps, `skipped` invalid. */
function copiedMessage(ok: boolean, count: number, skipped: number): string {
  if (!ok) return "Couldn't copy the policy. The README has it as a template.";
  const copied = count
    ? `Copied: read-only access to this dashboard's ${nApps(count)}.`
    : "Copied: read access to every Amplify app in the AWS account. Copy it again after adding Amplify rows to narrow it to this dashboard's apps.";
  return skipped
    ? `${copied} Left out ${nApps(skipped)} with an invalid region or app ID: fix them in the editor.`
    : copied;
}

export function CopyAwsPolicy({
  dashboard,
}: {
  dashboard: Dashboard;
}): React.JSX.Element {
  const { apps, skipped } = dashboardApps(dashboard);
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
          copyText(json, (ok) => {
            setSaid(copiedMessage(ok, apps.length, skipped));
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
