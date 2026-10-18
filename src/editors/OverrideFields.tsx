/**
 * Branch-pattern overrides per stage (spec.md C-14c, C-21) for a row or a
 * row group: one field per stage, empty meaning the inherited pattern
 * (shown as the placeholder). *Find branches* lists the branches of the
 * repos the overrides apply to, with counts, and offers them in every
 * field.
 *
 * @module
 */
import { Fragment, useId } from 'react';

import { branchCounts } from './branches';
import { BranchFinder } from './BranchFinder';
import { CommitInput } from './fields';
import { useLoad } from './useLoad';

export function OverrideFields({
  name,
  stages,
  own,
  loadBranches,
  onChange,
}: {
  /** The row or group name, for labels. */
  name: string;
  /** Each stage with the pattern it inherits at this level. */
  stages: readonly { id: string; name: string; inherited: string }[];
  own: Readonly<Record<string, string>>;
  /** The branches of the repos these overrides apply to. */
  loadBranches: () => Promise<Map<string, string[]>>;
  /** `''` clears a stage's override. */
  onChange: (stageId: string, pattern: string) => void;
}): React.JSX.Element {
  const [found, load] = useLoad<Map<string, string[]>>();
  const listId = useId();
  const byRepo = found.kind === 'done' ? found.value : undefined;
  const count = Object.keys(own).length;
  return (
    <details className="flex flex-col gap-1 text-xs">
      <summary className="cursor-pointer">
        Branch overrides{count > 0 ? ` (${String(count)})` : ''}
      </summary>
      <BranchFinder
        found={found}
        label="Find branches"
        onFind={() => {
          load(loadBranches);
        }}
      />
      {byRepo && (
        <datalist id={listId}>
          {branchCounts(byRepo).map((b) => (
            <option key={b.name} value={b.name} />
          ))}
        </datalist>
      )}
      <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-1">
        {stages.map((s) => (
          <Fragment key={s.id}>
            <span>{s.name}</span>
            <CommitInput
              optional
              label={`${s.name} branch override for ${name}`}
              placeholder={`${s.inherited} (inherited)`}
              className="h-7 text-xs"
              value={own[s.id] ?? ''}
              list={byRepo ? listId : undefined}
              onCommit={(pattern) => {
                onChange(s.id, pattern);
              }}
            />
          </Fragment>
        ))}
      </div>
    </details>
  );
}
