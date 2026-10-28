/**
 * Where the import dialog's share comes from when no link opened it
 * (spec.md §3.8, §3.9 *Import from link or file*): a fooboard file the
 * user chooses, or a share link pasted in, with the same effect as
 * opening it (Decision 69). Each read is handed to `onRead` with its
 * origin, so the dialog's refusals name a link or a file; clearing the
 * link field clears it.
 *
 * @module
 */
import { Input } from '@/components/ui/input';

import { readShare, type ShareRead } from '../envelope';
import { pastedLink } from '../link';
import { readLink } from '../readLink';
import type { ShareOrigin } from './shareWords';

export function ShareInputs({
  onRead,
}: {
  /** A share read from a file or a pasted link; `null`: the link cleared. */
  onRead: (read: ShareRead | null, origin: ShareOrigin) => void;
}): React.JSX.Element {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        A fooboard file
        <input
          type="file"
          accept="application/json,.json"
          className="text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2 file:py-1"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (!chosen) return;
            chosen.text().then(
              (text) => {
                onRead(readShare(text), 'file');
              },
              () => {
                onRead({ ok: false, reason: 'damaged' }, 'file');
              },
            );
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Or a fooboard link
        <Input
          type="url"
          autoComplete="off"
          placeholder="https://fooboard.dev/#b=…"
          onChange={(e) => {
            const text = e.target.value.trim();
            onRead(text ? readLink(pastedLink(text)) : null, 'link');
          }}
        />
      </label>
    </>
  );
}
