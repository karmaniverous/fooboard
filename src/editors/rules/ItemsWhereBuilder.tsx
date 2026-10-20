/**
 * The *only items where* builder (spec.md A§4.3.7): pick an item key,
 * type a glob, and add a check that some item matches, without writing
 * the JSONPath filter by hand.
 *
 * @module
 */
import { useState } from 'react';

import { CheckField } from '@/components/CheckField';
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BUILTIN_KEYS } from '@/domain/model/keys';
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
  const [key, setKey] = useState(itemKeys[0] ?? BUILTIN_KEYS.name);
  const [glob, setGlob] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(true);
  return (
    <div
      role="group"
      aria-label={`${label} only items where`}
      className="flex flex-wrap items-center gap-1 text-xs"
    >
      <span>Only items where</span>
      <Choice
        label={`${label} item key`}
        className="h-8 text-xs"
        value={key}
        options={itemKeys.map((k) => ({ value: k, label: k }))}
        onValueChange={setKey}
      />
      <span>matches</span>
      <Input
        aria-label={`${label} item glob`}
        className="h-8 w-32 px-1 font-mono text-xs"
        value={glob}
        onChange={(e) => {
          setGlob(e.target.value);
        }}
      />
      <CheckField
        label="Ignore case"
        checked={ignoreCase}
        onCheckedChange={setIgnoreCase}
      />
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
