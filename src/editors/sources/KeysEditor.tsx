/**
 * A source rule's keys (spec.md A§4.3.7): each key is the first of its
 * translations whose rule matches the raw data, giving a fixed value or
 * copying one from a path. Translation rules test the raw entry (`$` is
 * the raw run or job), so they get no record preview.
 *
 * @module
 */
import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import type { KeyDef, Translation } from '@/domain/model/sourceRule';
import { patchAt } from '@/lib/lists';

import { CommitInput } from '../fields';
import { RuleEditor } from '../rules/RuleEditor';

const MODES = [
  { value: 'value', label: 'gives' },
  { value: 'copy', label: 'copies' },
];

function TranslationRow({
  label,
  translation,
  onChange,
  onRemove,
}: {
  label: string;
  translation: Translation;
  onChange: (t: Translation) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const mode = 'copy' in translation ? 'copy' : 'value';
  const text = 'copy' in translation ? translation.copy : translation.value;
  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>When</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          aria-label={`Delete ${label}`}
          onClick={onRemove}
        >
          ×
        </Button>
      </div>
      <RuleEditor
        label={`${label} rule`}
        rule={translation.rule}
        newPath="$.run."
        onChange={(rule) => {
          onChange({ ...translation, rule });
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Choice
          label={`${label} mode`}
          value={mode}
          options={MODES}
          onValueChange={(next) => {
            onChange(
              next === 'copy'
                ? { rule: translation.rule, copy: text || '$.' }
                : { rule: translation.rule, value: text },
            );
          }}
        />
        <CommitInput
          label={`${label} ${mode === 'copy' ? 'path' : 'value'}`}
          className="h-9 w-56 font-mono"
          value={text}
          onCommit={(next) => {
            onChange(
              mode === 'copy'
                ? { rule: translation.rule, copy: next || '$.' }
                : { rule: translation.rule, value: next },
            );
          }}
        />
      </div>
    </div>
  );
}

export function KeysEditor({
  title,
  keys,
  onChange,
}: {
  title: string;
  keys: readonly KeyDef[];
  onChange: (keys: KeyDef[]) => void;
}): React.JSX.Element {
  return (
    <details className="rounded-md border px-2 py-1 text-xs">
      <summary className="cursor-pointer select-none">
        {title} ({keys.length})
      </summary>
      <div className="flex flex-col gap-2 py-1">
        {keys.map((key, i) => (
          <section
            key={i}
            aria-label={`${title}: ${key.name}`}
            className="flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <CommitInput
                label={`${title} key ${String(i + 1)} name`}
                className="h-9 w-40 font-mono"
                value={key.name}
                onCommit={(name) => {
                  if (name) onChange(patchAt(keys, i, { name }));
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete key ${key.name}`}
                onClick={() => {
                  onChange(keys.filter((_, j) => j !== i));
                }}
              >
                ×
              </Button>
            </div>
            {key.translations.map((t, j) => (
              <TranslationRow
                key={j}
                label={`${key.name} translation ${String(j + 1)}`}
                translation={t}
                onChange={(next) => {
                  onChange(
                    patchAt(keys, i, {
                      translations: key.translations.map((x, k) =>
                        k === j ? next : x,
                      ),
                    }),
                  );
                }}
                onRemove={() => {
                  onChange(
                    patchAt(keys, i, {
                      translations: key.translations.filter((_, k) => k !== j),
                    }),
                  );
                }}
              />
            ))}
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => {
                onChange(
                  patchAt(keys, i, {
                    translations: [
                      ...key.translations,
                      { rule: { combine: 'and', checks: [] }, value: '' },
                    ],
                  }),
                );
              }}
            >
              Add translation
            </Button>
          </section>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            onChange([
              ...keys,
              { name: `key${String(keys.length + 1)}`, translations: [] },
            ]);
          }}
        >
          Add key
        </Button>
      </div>
    </details>
  );
}
