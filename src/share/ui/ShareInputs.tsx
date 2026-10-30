/**
 * Where the import dialog's share comes from when no link opened it
 * (spec.md §3.8, §3.9 *Import from link or file*): a fooboard file the
 * user chooses, or a share link pasted in, with the same effect as
 * opening it (Decision 69), or the share's JSON text pasted in (text
 * starting with `{`, as an assistant gives it; spec 0.2.0 §3.J), with the
 * same effect as a file. Each read is handed to `onRead` with its
 * origin, so the dialog's refusals name a link or a file; clearing the
 * paste field clears it.
 *
 * @module
 */
import { Input } from '@/components/ui/input';

import { readShare, refused, type ShareRead } from '../envelope';
import { pastedLink } from '../link';
import { readLink } from '../readLink';
import type { ShareOrigin } from './shareWords';

/** The paste field's label. */
export const PASTE_LABEL = 'Or a fooboard link, or its JSON';

/** What pasted text holds: a share's JSON when it starts with `{`, else
 * a link; `null` when it is empty. */
function readPasted(text: string): ShareRead | null {
  if (text === '') return null;
  return text.startsWith('{') ? readShare(text) : readLink(pastedLink(text));
}

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
                onRead(refused('damaged'), 'file');
              },
            );
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {PASTE_LABEL}
        <Input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.fooboard.dev/#b=…"
          onChange={(e) => {
            onRead(readPasted(e.target.value.trim()), 'link');
          }}
        />
      </label>
    </>
  );
}
