/**
 * *Copy AWS policy* for one AWS key (spec.md C-3a, §3.12 *IAM*): once the
 * board has read with the key, the read-only IAM policy narrowed to the
 * apps the board reads with it (its pins and the apps its search finds);
 * until then (a key just created for its IAM user), the account-wide
 * policy. Says what it copied, and when to copy again.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';

import { amplifyPolicy, policyApps } from './iamPolicy';

const nApps = (n: number) => `${String(n)} Amplify ${n === 1 ? 'app' : 'apps'}`;

/** What the button says after copying for `name`: `count` apps read
 * with it (`undefined`: nothing read with it yet), `skipped` invalid. */
function copiedMessage(
  ok: boolean,
  name: string,
  count: number | undefined,
  skipped: number,
): string {
  if (!ok) return "Couldn't copy the policy. The README has it as a template.";
  const copied =
    count === undefined
      ? `Nothing has been read with ${name} yet, so this policy covers every Amplify app in the account. Copy again after the board first loads to narrow it.`
      : `This policy covers the ${String(count)} ${count === 1 ? 'app' : 'apps'} the board reads with ${name}. Copy again after adding Amplify rows or columns that use this key.`;
  return skipped
    ? `${copied} Left out ${nApps(skipped)} with an invalid region or app ID: fix them in the editor.`
    : copied;
}

export function CopyAwsPolicy({
  name,
  apps,
}: {
  /** The key, as the message names it. */
  name: string;
  /** The apps the board reads with the key; `undefined` until its app
   * search has finished. */
  apps?: readonly { region: string; appId: string }[];
}): React.JSX.Element {
  const [said, setSaid] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => {
          const valid = policyApps(apps ?? []);
          const json = JSON.stringify(
            amplifyPolicy(valid.apps, apps !== undefined),
            null,
            2,
          );
          copyText(json, (ok) => {
            setSaid(
              copiedMessage(ok, name, apps && valid.apps.length, valid.skipped),
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
