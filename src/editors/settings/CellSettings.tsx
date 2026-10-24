/**
 * A row's *Cell settings* (spec.md §3.11 *Where each level is edited*):
 * the row's stages, collapsing, one open at a time, each holding the
 * settings editor for that cell. The disclosure counts the fields set in
 * all of them.
 *
 * @module
 */
import { CollapsibleItem } from '@/components/CollapsibleItem';
import { Disclosure } from '@/components/Disclosure';
import type { Dashboard } from '@/domain/config/dashboard';
import { ownOverride } from '@/domain/config/ownOverride';
import type { Row } from '@/domain/config/row';
import type { SettingsPlace } from '@/domain/settings/places';
import { countSet } from '@/domain/settings/schema';

import { placeKey } from '../editTarget';
import { useAccordion } from '../useAccordion';
import { SettingsEntries } from './SettingsEditor';

export function CellSettings({
  dashboard,
  row,
  onChange,
}: {
  dashboard: Dashboard;
  row: Row;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const cell = (stageId: string): SettingsPlace => ({
    level: 'cell',
    rowId: row.id,
    stageId,
  });
  const accordion = useAccordion(
    dashboard.stages.map((s) => ({
      key: s.id,
      targets: [placeKey(cell(s.id))],
    })),
  );
  const count = (stageId: string) =>
    countSet(ownOverride(row.cellSettings, stageId));
  return (
    <Disclosure
      title="Cell settings"
      count={dashboard.stages.reduce((n, s) => n + count(s.id), 0)}
      target={`row:${row.id}:cells`}
      contentClassName="flex flex-col gap-2"
    >
      {dashboard.stages.map((s) => (
        <CollapsibleItem
          key={s.id}
          {...accordion.itemProps(s.id)}
          name={s.name}
          summary={count(s.id) > 0 ? `${String(count(s.id))} set` : undefined}
          label={`Cell settings for ${row.displayName}, ${s.name}`}
          target={placeKey(cell(s.id))}
        >
          <SettingsEntries
            dashboard={dashboard}
            place={cell(s.id)}
            onChange={onChange}
          />
        </CollapsibleItem>
      ))}
    </Disclosure>
  );
}
