/**
 * The full commit SHA in the cell detail sheet (spec.md C-13, Decision 21),
 * with *Copy*, which says whether it copied: an insecure page has no
 * clipboard, and the browser may refuse.
 *
 * @module
 */
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';

export function CommitSha({ sha }: { sha: string }): React.JSX.Element {
  const [said, setSaid] = useState('');
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="break-all font-mono">{sha}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Copy the commit SHA"
        className="h-6 gap-1 px-1.5 text-xs text-sky-400 hover:bg-slate-800 hover:text-sky-300"
        onClick={() => {
          copyText(sha, (ok) => {
            setSaid(ok ? 'Copied' : "Couldn't copy");
          });
        }}
      >
        <Copy aria-hidden className="size-3" />
        Copy
      </Button>
      <span role="status" className="text-slate-400">
        {said}
      </span>
    </span>
  );
}
