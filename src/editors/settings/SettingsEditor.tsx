/**
 * The settings editor (spec.md §3.11, Decisions 51–53): the only
 * component that edits the settings fields, at every level. Given a
 * place, it lists every field settable there in the fixed order (GitHub
 * token, AWS key, then each source's status set and item rule), each an
 * entry showing its value, origin, shadows and marks. It reads the
 * place's object and what it inherits itself, so a caller passes only
 * where it is; each change hands the whole dashboard to `onChange`,
 * which validates and saves it (*Not saved* when refused).
 *
 * @module
 */
import { useContext } from 'react';

import { Disclosure } from '@/components/Disclosure';
import type { Dashboard } from '@/domain/config/dashboard';
import { settingsAt, type SettingsPlace } from '@/domain/settings/places';
import { settableEntries } from '@/domain/settings/reads';
import { countSet } from '@/domain/settings/schema';

import { settingsKey } from '../editTarget';
import { SourcesWithItemsContext } from '../rules/samples';
import { SettingEntry } from './SettingEntry';

export interface SettingsEditorProps {
  dashboard: Dashboard;
  place: SettingsPlace;
  /** The dashboard with the place's object replaced (`setSettings`, pure). */
  onChange: (dashboard: Dashboard) => void;
}

/** The entries alone, for a caller that frames them itself. */
export function SettingsEntries({
  dashboard,
  place,
  onChange,
}: SettingsEditorProps): React.JSX.Element {
  const withItems = useContext(SourcesWithItemsContext);
  return (
    <div className="flex flex-col gap-2 text-xs">
      {settableEntries(dashboard, place, withItems).map((entry) => (
        <SettingEntry
          key={`${entry.field}:${'source' in entry ? entry.source : ''}`}
          dashboard={dashboard}
          place={place}
          entry={entry}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

/** The entries in a *Settings* disclosure counting the fields set here. */
export function SettingsEditor({
  title = 'Settings',
  ...props
}: SettingsEditorProps & { title?: string }): React.JSX.Element {
  return (
    <Disclosure
      title={title}
      count={countSet(settingsAt(props.dashboard, props.place))}
      target={settingsKey(props.place)}
      contentClassName="flex flex-col gap-2"
    >
      <SettingsEntries {...props} />
    </Disclosure>
  );
}
