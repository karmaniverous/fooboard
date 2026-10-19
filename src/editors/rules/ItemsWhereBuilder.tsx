/**
 * The *only items where* builder (spec.md A§4.3.7): pick an item key,
 * type a glob, and add a check that some item matches, without writing
 * the JSONPath filter by hand.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Check } from '@/domain/rules/schema';

import { itemsWhere } from './itemsWhere';

export function ItemsWhereBuilder({
  label,
  itemKeys,
  onAdd,
}: {
  label: string;
  /** Item keys to choose from. */
  itemKeys: readonly string[];
  onAdd: (check: Check) => void;
}): React.JSX.Element {
  const [key, setKey] = useState(itemKeys[0] ?? 'name');
  const [glob, setGlob] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(true);
  return (
    <div
      role="group"
      aria-label={`${label} only items where`}
      className="flex flex-wrap items-center gap-1 text-xs"
    >
      <span>Only items where</span>
      <select
        aria-label={`${label} item key`}
        className="h-8 rounded-md border bg-background px-1"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
        }}
      >
        {itemKeys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <span>matches</span>
      <input
        aria-label={`${label} item glob`}
        className="h-8 w-32 rounded-md border bg-background px-1 font-mono"
        value={glob}
        onChange={(e) => {
          setGlob(e.target.value);
        }}
      />
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={ignoreCase}
          onChange={(e) => {
            setIgnoreCase(e.target.checked);
          }}
        />
        Ignore case
      </label>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={glob.trim() === ''}
        onClick={() => {
          onAdd(itemsWhere(key, glob.trim(), ignoreCase));
          setGlob('');
        }}
      >
        Add
      </Button>
    </div>
  );
}
