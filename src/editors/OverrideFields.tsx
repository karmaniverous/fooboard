/**
 * Branch-pattern overrides per stage (spec.md C-14c, C-21) for a row or a
 * row group: one field per stage, empty meaning the inherited pattern
 * (shown as the placeholder). *Find branches* reads the branches of the
 * repos the overrides apply to and offers them as suggestions in every
 * field (with how many repos have each, for a group).
 *
 * @module
 */
import { Fragment, useId } from 'react';

import { Disclosure } from '@/components/Disclosure';
import { ownOverride } from '@/domain/config/inheritance';

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
  const branches = byRepo ? branchCounts(byRepo) : [];
  const count = Object.keys(own).length;
  return (
    <Disclosure
      title="Branch overrides"
      count={count}
      contentClassName="flex flex-col gap-1"
    >
      <BranchFinder
        found={found}
        label="Find branches"
        showList={false}
        onFind={() => {
          load(loadBranches);
        }}
      />
      {byRepo && (
        <>
          <p role="status" className="text-muted-foreground">
            {branches.length === 0
              ? 'No branches found.'
              : `${String(branches.length)} branches found: type in a field to pick one.`}
          </p>
          {/* Suggestions as you type; with several repos, each says how
              many of them have it. */}
          <datalist id={listId}>
            {branches.map((b) => (
              <option
                key={b.name}
                value={b.name}
                label={
                  byRepo.size > 1
                    ? `in ${String(b.count)} of ${String(byRepo.size)} repos`
                    : undefined
                }
              />
            ))}
          </datalist>
        </>
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
              value={ownOverride(own, s.id) ?? ''}
              list={byRepo ? listId : undefined}
              onCommit={(pattern) => {
                onChange(s.id, pattern);
              }}
            />
          </Fragment>
        ))}
      </div>
    </Disclosure>
  );
}
