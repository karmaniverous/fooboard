/**
 * *Find branches* (spec.md C-21): reads the branches of some repos on
 * request and lists them with how many repos have each. Used to seed new
 * stages and to fill in branch-pattern overrides (which offer them as
 * suggestions instead of a list).
 *
 * @module
 */
import { Button } from '@/components/ui/button';

import { branchCounts } from './branches';
import { LoadStatus } from './LoadStatus';
import type { LoadState } from './useLoad';

export function BranchFinder({
  found,
  onFind,
  label,
  disabled = false,
  onPick,
  showList = true,
}: {
  found: LoadState<ReadonlyMap<string, readonly string[]>>;
  onFind: () => void;
  /** The button's text before branches are found. */
  label: string;
  disabled?: boolean;
  /** When given, each branch is a button that picks it. */
  onPick?: (branch: string) => void;
  /** List the branches; off where they are offered another way. */
  showList?: boolean;
}): React.JSX.Element {
  const byRepo = found.kind === 'done' ? found.value : undefined;
  const counts = byRepo ? branchCounts(byRepo) : [];
  return (
    <>
      {!byRepo && (
        <Button
          size="sm"
          variant="outline"
          className="self-start text-xs"
          disabled={disabled || found.kind === 'loading'}
          onClick={onFind}
        >
          {found.kind === 'loading' ? 'Finding branches…' : label}
        </Button>
      )}
      <LoadStatus state={found} loading="" />
      {byRepo && showList && (
        <ul
          aria-label="Branches found"
          className="flex max-h-40 flex-wrap gap-1 overflow-y-auto text-xs"
        >
          {counts.map((b) => {
            const text = (
              <>
                {b.name}{' '}
                <span className="text-muted-foreground">
                  {b.count}/{byRepo.size}
                </span>
              </>
            );
            return (
              <li key={b.name}>
                {onPick ? (
                  <button
                    type="button"
                    className="rounded-full border px-2 py-0.5 hover:bg-muted"
                    onClick={() => {
                      onPick(b.name);
                    }}
                  >
                    {text}
                  </button>
                ) : (
                  <span className="rounded-full border px-2 py-0.5">
                    {text}
                  </span>
                )}
              </li>
            );
          })}
          {counts.length === 0 && <li>No branches found.</li>}
        </ul>
      )}
    </>
  );
}
