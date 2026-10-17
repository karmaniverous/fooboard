/**
 * Small editor fields shared by every editor section.
 *
 * @module
 */
import { Fragment, useId, useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { branchCounts } from './edit';
import { useLoad } from './useLoad';

/**
 * A text field that commits on blur or Enter, and only a non-empty value
 * (names and patterns are required). An emptied field reverts.
 */
export function CommitInput({
  value,
  onCommit,
  label,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  className?: string;
}): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    // The saved value changed underneath (e.g. reordering): follow it.
    setSeen(value);
    setDraft(value);
  }
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <Input
      aria-label={label}
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

/** A text field committed on blur (or Enter), keyed so it resets when
 * the value it edits changes identity. */
function BlurInput({
  label,
  value,
  placeholder,
  list,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  /** A datalist id offering suggestions. */
  list?: string;
  onCommit: (value: string | undefined) => void;
}): React.JSX.Element {
  const [text, setText] = useState(value);
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      list={list}
      className="h-7 text-xs"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
      }}
      onBlur={() => {
        if (text.trim() !== value) onCommit(text.trim() || undefined);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/** A row's or stage's group (spec.md C-14b): none, an existing group, or
 * a new group started from it; the group's label; delete the group. */
export function GroupControl({
  name,
  groups,
  groupId,
  warning,
  onChange,
  onRename,
  onDelete,
}: {
  /** The row or stage name, for labels. */
  name: string;
  groups: readonly { id: string; label?: string }[];
  groupId: string | undefined;
  /** Shown when leaving would delete the group and its overrides. */
  warning?: string;
  onChange: (target: string | null) => void;
  onRename: (groupId: string, label: string | undefined) => void;
  onDelete: (groupId: string) => void;
}): React.JSX.Element {
  const current = groups.find((g) => g.id === groupId);
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <NativeSelect
        aria-label={`Group of ${name}`}
        className="h-7 px-1"
        value={groupId ?? ''}
        onChange={(e) => {
          onChange(e.target.value === '' ? null : e.target.value);
        }}
      >
        <option value="">No group</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            Group: {g.label ?? '(no label)'}
          </option>
        ))}
        <option value="new">New group from {name}</option>
      </NativeSelect>
      {current && (
        <>
          <BlurInput
            key={current.id}
            label={`Label of the group of ${name}`}
            placeholder="Group label (optional)"
            value={current.label ?? ''}
            onCommit={(label) => {
              onRename(current.id, label);
            }}
          />
          <ConfirmButton
            confirmLabel={`Delete the group ${current.label ?? ''} (its members stay, ungrouped)`}
            onConfirm={() => {
              onDelete(current.id);
            }}
          >
            Delete group
          </ConfirmButton>
        </>
      )}
      {warning && <span className="text-status-failure">{warning}</span>}
    </div>
  );
}

/** Branch-pattern overrides per stage (spec.md C-14c): empty means the
 * inherited pattern, shown as the placeholder. */
export function OverrideFields({
  name,
  stages,
  own,
  inherited,
  loadBranches,
  onChange,
}: {
  name: string;
  stages: readonly { id: string; name: string; branchPattern: string }[];
  own: Readonly<Record<string, string>>;
  inherited: (stageId: string) => string;
  /** The branches of the repos these overrides apply to (C-21). */
  loadBranches?: () => Promise<Map<string, string[]>>;
  onChange: (stageId: string, pattern: string | undefined) => void;
}): React.JSX.Element {
  const count = Object.keys(own).length;
  const [found, load] = useLoad<Map<string, string[]>>();
  const listId = useId();
  const byRepo = found.kind === 'done' ? found.value : undefined;
  const branches = byRepo ? branchCounts(byRepo) : [];
  return (
    <details className="text-xs">
      <summary className="cursor-pointer">
        Branch overrides{count > 0 ? ` (${String(count)})` : ''}
      </summary>
      {loadBranches && found.kind !== 'done' && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1 h-6 text-xs"
          disabled={found.kind === 'loading'}
          onClick={() => {
            load(loadBranches);
          }}
        >
          {found.kind === 'loading' ? 'Finding branches…' : 'Find branches'}
        </Button>
      )}
      {found.kind === 'error' && (
        <p className="text-status-failure">{found.message}</p>
      )}
      {byRepo && (
        <>
          {/* Suggestions for every field, and the same list visible with
              counts: repos with the branch / repos read. */}
          <datalist id={listId}>
            {branches.map((b) => (
              <option
                key={b.name}
                value={b.name}
                label={`${String(b.count)}/${String(byRepo.size)}`}
              />
            ))}
          </datalist>
          <p
            aria-label={`Branches for ${name}`}
            className="mt-1 text-muted-foreground"
          >
            {branches.length === 0
              ? 'No branches found.'
              : branches
                  .map(
                    (b) =>
                      `${b.name} ${String(b.count)}/${String(byRepo.size)}`,
                  )
                  .join(' · ')}
          </p>
        </>
      )}
      <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-1">
        {stages.map((s) => (
          <Fragment key={s.id}>
            <span>{s.name}</span>
            <BlurInput
              key={`${s.id}:${own[s.id] ?? ''}`}
              label={`${s.name} branch override for ${name}`}
              placeholder={`${inherited(s.id)} (inherited)`}
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
