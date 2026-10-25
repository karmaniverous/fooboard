/**
 * One entry of the settings editor (spec.md §3.11 *The settings editor*,
 * Decisions 52 and 53): the field's name and description; its effective
 * value as the control's value, and its origin when inherited; a *Set
 * here* mark and *Reset to inherited* (naming the value it falls back to)
 * when set at this place; the places that win over it; and *nothing here
 * reads it yet* when no row under the place reads it. Choosing a value
 * sets it here, even one equal to the inherited value.
 *
 * @module
 */
import { use } from 'react';

import { Choice } from '@/components/Choice';
import { Button } from '@/components/ui/button';
import { sortCredentials } from '@/credentials/credentialOrder';
import type { Dashboard } from '@/domain/config/dashboard';
import { ITEM_NAME_PATH } from '@/domain/model/keys';
import type { SettingsPlace } from '@/domain/settings/places';
import { readsAt, type SettingEntry as Entry } from '@/domain/settings/reads';
import { inheritedAt } from '@/domain/settings/resolve';

import { settingKey } from '../editTarget';
import { RuleEditor } from '../rules/RuleEditor';
import { setOptions } from '../statuses/statusSetOptions';
import { OpenPlaceContext } from './openPlace';
import {
  entryDescription,
  entryName,
  fromWords,
  inheritedWords,
  placeLabel,
  shadowWords,
  unlabelledGroup,
} from './origins';
import {
  type EntryValue,
  inheritedValue,
  ownValue,
  setEntry,
  shadowsOf,
} from './settingEdit';

/** The mark on a field no row under the place reads (Decision 53). */
export const NOTHING_READS = 'nothing here reads it yet';

/** The choices for a credential or status-set entry. */
function optionsFor(d: Dashboard, entry: Entry) {
  if (entry.field === 'statusSets') return setOptions(d, entry.source);
  const kind = entry.field === 'githubToken' ? 'github' : 'aws';
  return sortCredentials(d.credentials.filter((c) => c.kind === kind)).map(
    (c) => ({ value: c.id, label: c.label }),
  );
}

export function SettingEntry({
  dashboard: d,
  place,
  entry,
  onChange,
}: {
  dashboard: Dashboard;
  place: SettingsPlace;
  entry: Entry;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const own = ownValue(d, place, entry);
  const inherited = inheritedValue(d, place, entry);
  const fallback = inheritedWords(d, entry, inherited.origin, inherited.value);
  const from = own === undefined ? fromWords(d, inherited.origin) : undefined;
  const openPlace = use(OpenPlaceContext);
  // An unlabelled group has no gear: its origin opens the dashboard
  // editor at its settings, where there is one (spec.md §3.11).
  const group = unlabelledGroup(d, inherited.origin);
  const openGroup =
    openPlace && group
      ? () => {
          openPlace(group);
        }
      : undefined;
  const shadows =
    own === undefined
      ? undefined
      : shadowWords(d, entry, shadowsOf(d, place, entry));
  const name = entryName(entry);
  const label = `${name} for ${placeLabel(d, place)}`;
  const key = settingKey(
    place,
    entry.field,
    'source' in entry ? entry.source : undefined,
  );
  const set = (value: EntryValue | undefined) => {
    onChange(setEntry(d, place, entry, value));
  };
  return (
    <div
      className="flex flex-col gap-1 rounded-md border p-2"
      data-edit-target={key}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{name}</span>
        {own !== undefined && (
          <span className="rounded bg-muted px-1.5 text-muted-foreground">
            Set here
          </span>
        )}
        {!readsAt(d, place, entry) && (
          <span className="italic text-muted-foreground">{NOTHING_READS}</span>
        )}
      </div>
      <span className="text-muted-foreground">{entryDescription(entry)}</span>
      <div className="flex flex-wrap items-center gap-2">
        {entry.field === 'itemRules' ? (
          own !== undefined && typeof own !== 'string' ? (
            <RuleEditor
              label={label}
              rule={own}
              newPath={ITEM_NAME_PATH}
              provider={entry.source}
              scope="item"
              target={key}
              onChange={set}
            />
          ) : (
            <>
              <span>{fallback}</span>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Set here: ${label}`}
                onClick={() => {
                  // A copy of the rule it inherits, to edit here.
                  set(inheritedAt(d, place, 'itemRules', entry.source).value);
                }}
              >
                Set here
              </Button>
            </>
          )
        ) : (
          <Choice
            label={label}
            className="h-8 text-xs"
            value={typeof own === 'string' ? own : ''}
            options={[
              ...(own === undefined ? [{ value: '', label: fallback }] : []),
              ...optionsFor(d, entry),
              ...(typeof own === 'string' &&
              !optionsFor(d, entry).some((o) => o.value === own)
                ? [{ value: own, label: `${own} (not on this dashboard)` }]
                : []),
            ]}
            onValueChange={(v) => {
              if (v !== '') set(v);
            }}
          />
        )}
        {from &&
          (openGroup ? (
            <Button
              variant="link"
              className="h-auto p-0 text-xs text-sky-600 underline dark:text-sky-400"
              aria-label={`${from}: open ${placeLabel(d, inherited.origin)} in dashboard settings`}
              onClick={openGroup}
            >
              {from}
            </Button>
          ) : (
            <span className="text-muted-foreground">{from}</span>
          ))}
      </div>
      {own !== undefined && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`Reset to inherited: ${label}`}
            onClick={() => {
              set(undefined);
            }}
          >
            Reset to inherited
          </Button>
          <span className="text-muted-foreground">
            falls back to {fallback}
          </span>
        </div>
      )}
      {shadows && <span className="text-muted-foreground">{shadows}</span>}
    </div>
  );
}
