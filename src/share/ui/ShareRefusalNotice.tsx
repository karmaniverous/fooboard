/**
 * The import dialog's error state for a refused share (spec.md §3.8; spec
 * 0.2.0 §3.J *Field-level errors*): what is wrong, then, for a share with
 * issues, the first `IMPORT_ISSUES_SHOWN` of them as a flat list of lines
 * (path, then message), "and N more" beyond, and *Copy errors for your
 * assistant*, which copies every one after a preamble; for a share with
 * none (a damaged link or file), who to ask for a new one.
 *
 * @module
 */
import { CopyForAssistant } from '@/components/CopyForAssistant';

import type { ShareRefused } from '../envelope';
import { issueLine } from '../issues';
import {
  COPY_ERRORS,
  IMPORT_ISSUES_SHOWN,
  ISSUES_PREAMBLE,
  moreIssues,
  refusalHint,
  refusalMessage,
  type ShareOrigin,
} from './shareWords';

export function ShareRefusalNotice({
  refusal,
  origin,
}: {
  refusal: ShareRefused;
  origin: ShareOrigin;
}): React.JSX.Element {
  const lines = refusal.issues.map(issueLine);
  const more = lines.length - IMPORT_ISSUES_SHOWN;
  return (
    <>
      <p
        role="alert"
        // The failure red is too dark on the dark dialog (axe, 4.5:1), and
        // the light destructive red too pale on the light one: each
        // theme's own token that passes.
        className="text-sm text-status-failure dark:text-destructive"
      >
        {refusalMessage(refusal, origin)}
      </p>
      {lines.length > 0 ? (
        <>
          <ul
            aria-label="Import errors"
            className="flex flex-col gap-1 break-words font-mono text-xs"
          >
            {lines.slice(0, IMPORT_ISSUES_SHOWN).map((line, i) => (
              // Lines may repeat (two issues at one path with one message).
              <li key={`${String(i)}:${line}`}>{line}</li>
            ))}
          </ul>
          {more > 0 && (
            <p className="text-xs text-muted-foreground">{moreIssues(more)}</p>
          )}
          <CopyForAssistant
            label={COPY_ERRORS}
            preamble={ISSUES_PREAMBLE}
            lines={lines}
          />
        </>
      ) : (
        refusal.reason !== 'newer' && (
          <p className="text-sm text-muted-foreground">{refusalHint(origin)}</p>
        )
      )}
    </>
  );
}
