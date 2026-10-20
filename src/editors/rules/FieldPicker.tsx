/**
 * The field picker (spec.md A§4.3.7 *Editing rules*): a tree over a real
 * record (an Unknown one when there is one), raw data included, where
 * choosing a field writes its path into the check. Arrays show their
 * first element under `[*]`.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { ChevronRight } from 'lucide-react';

import { Disclosure } from '@/components/Disclosure';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { isJsonObject } from '@/domain/model/json';
import { keyPath, RECORD_KEYS, WILDCARD_STEP } from '@/domain/model/keys';
import { pathStep } from '@/domain/rules/path';

/** The deepest the tree opens; deeper values show as a preview. */
export const MAX_DEPTH = 6;
/** The most characters of a value the tree previews. */
export const PREVIEW_LENGTH = 40;
/** The start of the accessible name of a field's expand toggle. */
export const SHOW_FIELDS = 'Show fields of';

const step = pathStep;

const preview = (v: JSONValue): string => {
  const text = JSON.stringify(v);
  return text.length > PREVIEW_LENGTH
    ? `${text.slice(0, PREVIEW_LENGTH)}...`
    : text;
};

function Node({
  name,
  path,
  value,
  depth,
  onPick,
}: {
  name: string;
  path: string;
  value: JSONValue;
  depth: number;
  onPick: (path: string) => void;
}): React.JSX.Element {
  const pick = (
    <button
      type="button"
      className="font-mono text-left underline-offset-2 hover:underline"
      title={path}
      onClick={() => {
        onPick(path);
      }}
    >
      {name}
    </button>
  );
  const children: [string, string, JSONValue][] = Array.isArray(value)
    ? value.length > 0
      ? [[WILDCARD_STEP, `${path}${WILDCARD_STEP}`, value[0]]]
      : []
    : typeof value === 'object' && value !== null
      ? Object.entries(value).map(([k, v]) => [k, `${path}${step(k)}`, v])
      : [];
  if (children.length === 0 || depth >= MAX_DEPTH)
    return (
      <li className="pl-4">
        {pick} <span className="text-muted-foreground">{preview(value)}</span>
      </li>
    );
  // The library's Collapsible, with the chevron as its trigger: the
  // field's name beside it is a button of its own (it picks the field).
  return (
    <li>
      <Collapsible defaultOpen={depth === 0 && name !== RECORD_KEYS.raw}>
        <span className="flex items-center gap-1">
          <CollapsibleTrigger
            aria-label={`${SHOW_FIELDS} ${name}`}
            className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-90"
          >
            <ChevronRight aria-hidden className="size-3 transition-transform" />
          </CollapsibleTrigger>
          {pick}
          {Array.isArray(value) && (
            <span className="text-muted-foreground">
              ({String(value.length)})
            </span>
          )}
        </span>
        <CollapsibleContent asChild>
          <ul className="ml-4">
            {children.map(([k, p, v]) => (
              <Node
                key={k}
                name={k}
                path={p}
                value={v}
                depth={depth + 1}
                onPick={onPick}
              />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

export function FieldPicker({
  label,
  doc,
  onPick,
}: {
  label: string;
  /** The real record (or raw data) to pick from. */
  doc: JSONValue;
  onPick: (path: string) => void;
}): React.JSX.Element {
  const entries = isJsonObject(doc) ? Object.entries(doc) : [];
  return (
    <div role="group" aria-label={`${label} field picker`}>
      <Disclosure
        title="Pick field"
        count={0}
        className="text-muted-foreground"
        contentClassName="max-h-64 overflow-auto rounded border p-1 text-foreground"
      >
        <ul>
          {entries.map(([k, v]) => (
            <Node
              key={k}
              name={k}
              path={keyPath(k)}
              value={v}
              depth={0}
              onPick={onPick}
            />
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
