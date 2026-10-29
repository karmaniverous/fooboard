/**
 * The *Dismiss…* form of an unmapped entry (spec 0.2.0 §3.I): inline in
 * the entry, below its reasons. A preset choice fills one field per
 * pattern part (*Repo or app*, *Workflow*, *Branch pattern*, and *Reason*
 * with *Any*); each can then be edited or cleared (cleared is "any"). It
 * says how many of the entries shown the pattern matches; *Dismiss* is
 * disabled while no field is set, saying why. Focus starts on the preset
 * choice (on the first field when no preset is offered); Escape cancels
 * without closing the panel around it.
 *
 * @module
 */
import { useEffect, useId, useRef, useState } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DISMISSAL_FIELD_LABELS,
  DISMISSAL_REASON_OPTIONS,
  DISMISSAL_TEXT_FIELDS,
  setsAnyField,
  type UnmappedReasonKind,
} from '@/domain/config/unmappedDismissals';
import type { UnmappedRun } from '@/engine';
import {
  type DismissalPattern,
  matchesDismissal,
  presetsFor,
} from '@/engine/unmappedDismissals';

import {
  CANCEL,
  DISMISS,
  matchesText,
  NEED_A_FIELD,
  PRESET_CHOICE,
} from './dismissWords';

/** The form's fields as typed: empty is "any". */
interface Fields {
  where: string;
  workflow: string;
  branch: string;
  reason: UnmappedReasonKind | '';
}

const fieldsOf = (pattern: DismissalPattern = {}): Fields => ({
  where: pattern.where ?? '',
  workflow: pattern.workflow ?? '',
  branch: pattern.branch ?? '',
  reason: pattern.reason ?? '',
});

/** The pattern the fields make: each empty field left out. */
const patternOf = (fields: Fields): DismissalPattern => {
  const pattern: DismissalPattern = {};
  for (const field of DISMISSAL_TEXT_FIELDS)
    if (fields[field] !== '') pattern[field] = fields[field];
  if (fields.reason !== '') pattern.reason = fields.reason;
  return pattern;
};

/** Cancel on Escape inside `form`, before the panel's dialog hears it
 * (Radix listens on the document; the window hears it first). */
function useEscapeWithin(
  form: React.RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!(e.target instanceof Node && form.current?.contains(e.target)))
        return;
      e.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [form]);
}

export function DismissForm({
  id,
  run,
  entries,
  onDismiss,
  onCancel,
  children,
}: {
  /** The form's id (its *Dismiss…* button controls it). */
  id: string;
  run: UnmappedRun;
  /** The entries shown (none dismissed), for the match count. */
  entries: readonly UnmappedRun[];
  onDismiss: (pattern: DismissalPattern) => void;
  onCancel: () => void;
  /** Below the buttons: why the last *Dismiss* wasn't saved. */
  children?: React.ReactNode;
}): React.JSX.Element {
  const presets = presetsFor(run);
  const [preset, setPreset] = useState(presets[0]?.id ?? '');
  const [fields, setFields] = useState(() => fieldsOf(presets[0]?.pattern));
  const form = useRef<HTMLFormElement>(null);
  const base = useId();
  const hintId = `${base}-hint`;
  useEscapeWithin(form, onCancel);

  useEffect(() => {
    const start =
      form.current?.querySelector<HTMLElement>(
        '[role="radio"][aria-checked="true"]',
      ) ?? form.current?.querySelector<HTMLElement>('input');
    start?.focus();
  }, []);

  const pattern = patternOf(fields);
  const ready = setsAnyField(pattern);
  const matches = entries.filter((e) => matchesDismissal(pattern, e)).length;
  const set = (field: keyof Fields, value: string) => {
    setFields((f) => ({ ...f, [field]: value }));
  };

  return (
    <form
      id={id}
      ref={form}
      aria-label={`${DISMISS} ${run.title}`}
      className="mt-1 flex flex-col gap-2 rounded-md bg-muted/50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onDismiss(pattern);
      }}
    >
      {presets.length > 0 && (
        <RadioGroup
          aria-label={PRESET_CHOICE}
          value={preset}
          onValueChange={(next) => {
            const chosen = presets.find((p) => p.id === next);
            if (!chosen) return;
            setPreset(chosen.id);
            setFields(fieldsOf(chosen.pattern));
          }}
        >
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <RadioGroupItem value={p.id} id={`${base}-preset-${p.id}`} />
              <Label htmlFor={`${base}-preset-${p.id}`}>{p.label}</Label>
            </div>
          ))}
        </RadioGroup>
      )}
      {DISMISSAL_TEXT_FIELDS.map((field) => (
        <div key={field} className="flex flex-col gap-1">
          <Label htmlFor={`${base}-field-${field}`}>
            {DISMISSAL_FIELD_LABELS[field]}
          </Label>
          <Input
            id={`${base}-field-${field}`}
            value={fields[field]}
            onChange={(e) => {
              set(field, e.target.value);
            }}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <Label id={`${base}-field-reason`}>
          {DISMISSAL_FIELD_LABELS.reason}
        </Label>
        <Choice
          label={DISMISSAL_FIELD_LABELS.reason}
          labelledBy={`${base}-field-reason`}
          value={fields.reason}
          options={DISMISSAL_REASON_OPTIONS}
          onValueChange={(value) => {
            set('reason', value);
          }}
        />
      </div>
      <p className="text-xs" aria-live="polite">
        {matchesText(matches, entries.length)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!ready}
          aria-describedby={ready ? undefined : hintId}
        >
          {DISMISS}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {CANCEL}
        </Button>
        {!ready && (
          <span id={hintId} className="text-xs text-muted-foreground">
            {NEED_A_FIELD}
          </span>
        )}
      </div>
      {children}
    </form>
  );
}
