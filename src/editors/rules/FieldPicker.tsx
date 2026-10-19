/**
 * The field picker (spec.md A§4.3.7 *Editing rules*): a tree over a real
 * record (an Unknown one when there is one), raw data included, where
 * choosing a field writes its path into the check. Arrays show their
 * first element under `[*]`.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

const MAX_DEPTH = 6;
const PREVIEW = 40;

const step = (key: string): string =>
  /^[A-Za-z_]\w*$/.test(key) ? `.${key}` : `['${key.replace(/'/g, "\\'")}']`;

const preview = (v: JSONValue): string => {
  const text = JSON.stringify(v);
  return text.length > PREVIEW ? `${text.slice(0, PREVIEW)}...` : text;
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
      ? [['[*]', `${path}[*]`, value[0]]]
      : []
    : typeof value === 'object' && value !== null
      ? Object.entries(value).map(([k, v]) => [k, `${path}${step(k)}`, v])
      : [];
  if (children.length === 0 || depth >= MAX_DEPTH)
    return (
      <li>
        {pick} <span className="text-muted-foreground">{preview(value)}</span>
      </li>
    );
  return (
    <li>
      <details open={depth < 1 && name !== '_raw'}>
        <summary className="cursor-pointer">
          {pick}
          {Array.isArray(value) && (
            <span className="text-muted-foreground">
              {' '}
              ({String(value.length)})
            </span>
          )}
        </summary>
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
      </details>
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
  const entries =
    typeof doc === 'object' && doc !== null && !Array.isArray(doc)
      ? Object.entries(doc)
      : [];
  return (
    <details className="text-xs" aria-label={`${label} field picker`}>
      <summary className="cursor-pointer select-none text-muted-foreground">
        Pick field
      </summary>
      <ul className="max-h-64 overflow-auto rounded border p-1">
        {entries.map(([k, v]) => (
          <Node
            key={k}
            name={k}
            path={`$${step(k)}`}
            value={v}
            depth={0}
            onPick={onPick}
          />
        ))}
      </ul>
    </details>
  );
}
