/**
 * *Dismissed unmapped runs* on the editor's *General* tab (spec 0.2.0
 * §3.I, Decision 32): the dashboard's patterns hiding entries from the
 * *Unmapped runs* panel, one collapsing item each, its fields editable
 * (a cleared field is "any" and is removed; a pattern left with no field
 * is refused, *Not saved*) and *Remove*. It is where the patterns are
 * reached when every entry is dismissed and the panel's button is gone.
 *
 * @module
 */
import { omit } from 'radash';

import { Choice } from '@/components/Choice';
import { CollapsibleItem } from '@/components/CollapsibleItem';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  describeDismissal,
  DISMISSAL_FIELD_LABELS,
  DISMISSAL_REASON_OPTIONS,
  DISMISSAL_TEXT_FIELDS,
  type UnmappedDismissal,
  UnmappedReasonKindSchema,
} from '@/domain/config/unmappedDismissals';

import { CommitInput } from './fields';
import { useAccordion } from './useAccordion';

/** The section's title. */
const DISMISSED_UNMAPPED_RUNS = 'Dismissed unmapped runs';

/** `dismissal` with `field` set to `value`, or without it when empty. */
function withField(
  dismissal: UnmappedDismissal,
  field: (typeof DISMISSAL_TEXT_FIELDS)[number] | 'reason',
  value: string,
): UnmappedDismissal {
  const rest = omit(dismissal, [field]);
  if (value === '') return rest;
  if (field !== 'reason') return { ...rest, [field]: value };
  const reason = UnmappedReasonKindSchema.safeParse(value);
  return reason.success ? { ...rest, reason: reason.data } : dismissal;
}

export function DismissalList({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const dismissals = dashboard.unmappedDismissals;
  const accordion = useAccordion(
    dismissals.map((d) => ({ key: d.id, targets: [] })),
  );
  const save = (next: UnmappedDismissal[]) => {
    onChange({ ...dashboard, unmappedDismissals: next });
  };
  const replace = (next: UnmappedDismissal) => {
    save(dismissals.map((d) => (d.id === next.id ? next : d)));
  };
  return (
    <section
      aria-label={DISMISSED_UNMAPPED_RUNS}
      className="flex flex-col gap-2"
    >
      <h3 className="text-xs font-semibold">{DISMISSED_UNMAPPED_RUNS}</h3>
      {dismissals.length === 0 && (
        <p className="text-xs text-muted-foreground">
          None. Dismiss… on an entry in Unmapped runs adds one.
        </p>
      )}
      {dismissals.map((d) => {
        const name = describeDismissal(d);
        return (
          <CollapsibleItem
            key={d.id}
            {...accordion.itemProps(d.id)}
            name={name}
            label={`Dismissal ${name}`}
            actions={
              <Button
                size="sm"
                variant="outline"
                aria-label={`Remove ${name}`}
                onClick={() => {
                  save(dismissals.filter((x) => x.id !== d.id));
                }}
              >
                Remove
              </Button>
            }
          >
            {DISMISSAL_TEXT_FIELDS.map((field) => (
              <label key={field} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {DISMISSAL_FIELD_LABELS[field]}
                </span>
                <CommitInput
                  optional
                  label={DISMISSAL_FIELD_LABELS[field]}
                  value={d[field] ?? ''}
                  onCommit={(value) => {
                    replace(withField(d, field, value));
                  }}
                />
              </label>
            ))}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {DISMISSAL_FIELD_LABELS.reason}
              </span>
              <Choice
                label={DISMISSAL_FIELD_LABELS.reason}
                value={d.reason ?? ''}
                options={DISMISSAL_REASON_OPTIONS}
                onValueChange={(value) => {
                  replace(withField(d, 'reason', value));
                }}
              />
            </div>
          </CollapsibleItem>
        );
      })}
    </section>
  );
}
