/**
 * The column groups on the Stages tab (spec.md C-14b, C-21, §3.11): each
 * group collapses to its header (label and members), one open at a time;
 * its stage rules and settings show when it is open, and the editor opened on a
 * fix opens its group. Groups are started, labelled and deleted from
 * their stages (`GroupControl`).
 *
 * @module
 */
import { CollapsibleItem } from '@/components/CollapsibleItem';
import type { Dashboard } from '@/domain/config/dashboard';

import { targetKey } from './editTarget';
import { ProviderRules } from './rules/ProviderRules';
import { SettingsEditor } from './settings/SettingsEditor';
import { useAccordion } from './useAccordion';

export function ColumnGroupList({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element | null {
  const groups = dashboard.columnGroups;
  const target = (id: string) => targetKey({ kind: 'columnGroup', id });
  const accordion = useAccordion(
    groups.map((g) => ({
      key: g.id,
      targets: [target(g.id), `columnGroup:${g.id}`],
    })),
  );
  if (groups.length === 0) return null;
  const stageName = (id: string) =>
    dashboard.stages.find((s) => s.id === id)?.name ?? id;
  return (
    <section aria-label="Column groups" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">Column groups</h3>
      {groups.map((g) => {
        const name = g.label ?? g.id;
        return (
          <CollapsibleItem
            key={g.id}
            {...accordion.itemProps(g.id)}
            name={name}
            summary={g.memberIds.map(stageName).join(', ')}
            label={`Column group ${name}`}
            target={`columnGroup:${g.id}`}
          >
            <ProviderRules
              defaultOpen
              title={`Stage rules of group ${name}`}
              target={target(g.id)}
              rules={g.stageRules}
              onChange={(p, rule) => {
                onChange({
                  ...dashboard,
                  columnGroups: groups.map((x) =>
                    x.id === g.id
                      ? { ...x, stageRules: { ...x.stageRules, [p]: rule } }
                      : x,
                  ),
                });
              }}
            />
            <SettingsEditor
              dashboard={dashboard}
              place={{ level: 'columnGroup', groupId: g.id }}
              onChange={onChange}
            />
          </CollapsibleItem>
        );
      })}
    </section>
  );
}
