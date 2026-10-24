/**
 * A row's group and overrides in the row editor (spec.md C-14b, C-14c,
 * C-15, §3.11): its group; its group's settings (the shared settings
 * editor), row rules and stage-rule overrides (shown on each member,
 * since a group has no editor of its own); *Add override* from an unmapped
 * record; and the row's own overrides, as branch patterns or general
 * rules (A§4.3.7).
 *
 * @module
 */
import { Disclosure } from '@/components/Disclosure';
import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf, type RowGroup } from '@/domain/config/groups';
import { ownOverride } from '@/domain/config/ownOverride';
import type { Row } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { always } from '@/domain/rules/always';
import { branchOf } from '@/domain/rules/branch';
import { countSet } from '@/domain/settings/schema';
import { targetKey } from '@/editors/editTarget';
import { useQueryEnv } from '@/query/queryEnvContext';

import { discoverBranches } from './branches';
import { GroupControl } from './GroupControl';
import {
  groupOverridePattern,
  rowOverridePattern,
  setRowGroupOverride,
  setRowGroupStageRule,
  setRowOverride,
  setRowStageRule,
} from './overrideEdit';
import { OverrideFields } from './OverrideFields';
import { OverrideFix } from './OverrideFix';
import { setGroupRowRule } from './rowRuleEdit';
import { ProviderRules } from './rules/ProviderRules';
import { RuleEditor } from './rules/RuleEditor';
import { SettingsEntries } from './settings/SettingsEditor';

interface Props {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}

/** How many of a group's settings are set (shown on its closed
 * section): its settings fields, row rules and overrides. */
const groupSettingsCount = (g: RowGroup): number =>
  countSet(g.settings) +
  Object.values(g.rowRules).filter(Boolean).length +
  Object.keys(g.stageRules).length;

/** A stage's own branch pattern, if its rules are one. */
const stagePattern = (s: Stage): string =>
  branchOf(s.rules.github) ?? branchOf(s.rules.amplify) ?? 'its stage rule';

/** Each stage with the pattern it inherits below `group` (or the stage's
 * own pattern for the group itself). */
const inheritedStages = (d: Dashboard, group: RowGroup | undefined) =>
  d.stages.map((s) => ({
    id: s.id,
    name: s.name,
    inherited: (group && groupOverridePattern(group, s.id)) || stagePattern(s),
  }));

/** The overrides a level holds that are branch patterns, by stage id. */
const patterns = (
  stages: readonly Stage[],
  patternOf: (stageId: string) => string | undefined,
): Record<string, string> =>
  Object.fromEntries(
    stages.flatMap((s) => {
      const pattern = patternOf(s.id);
      return pattern === '' || pattern === undefined ? [] : [[s.id, pattern]];
    }),
  );

/** Stages whose override is a rule no branch pattern says. */
const customStages = (
  stages: readonly Stage[],
  patternOf: (stageId: string) => string | undefined,
): Set<string> =>
  new Set(stages.filter((s) => patternOf(s.id) === undefined).map((s) => s.id));

export function RowGrouping({
  row,
  override,
  ...props
}: Props & {
  row: Row;
  /** A branch from an unmapped record to offer as an override, on the
   * rows reading its repo or app (shown on the first). */
  override?: { branch: string; rowIds: readonly string[] };
}): React.JSX.Element {
  const { dashboard, onChange } = props;
  const env = useQueryEnv();
  const group = groupOf(dashboard.rowGroups, row.id);
  return (
    <>
      <GroupControl
        dashboard={dashboard}
        axis="rows"
        itemId={row.id}
        name={row.displayName}
        onChange={onChange}
      />
      {group && <RowGroupSettings {...props} group={group} />}
      {override?.rowIds[0] === row.id && (
        <OverrideFix
          dashboard={dashboard}
          onChange={onChange}
          rowIds={override.rowIds}
          branch={override.branch}
        />
      )}
      <OverrideFields
        name={row.displayName}
        target={targetKey({ kind: 'row', id: row.id })}
        stages={inheritedStages(dashboard, group)}
        own={patterns(dashboard.stages, (id) => rowOverridePattern(row, id))}
        custom={customStages(dashboard.stages, (id) =>
          rowOverridePattern(row, id),
        )}
        renderRule={(stageId) => (
          <RuleEditor
            label={`${stageId} stage rule for ${row.displayName}`}
            provider={row.type}
            rule={ownOverride(row.stageRules, stageId) ?? always}
            onChange={(rule) => {
              onChange(setRowStageRule(dashboard, row.id, stageId, rule));
            }}
          />
        )}
        loadBranches={() => discoverBranches(dashboard, env, [row])}
        onChange={(stageId, pattern) => {
          onChange(setRowOverride(dashboard, row.id, stageId, pattern));
        }}
      />
    </>
  );
}

function RowGroupSettings({
  dashboard,
  onChange,
  group,
}: Props & { group: RowGroup }): React.JSX.Element {
  const env = useQueryEnv();
  const name = group.label ?? 'this group';
  return (
    // Shared by every member and edited less often than the row's own
    // fields: closed until opened, or opened by a fix inside it.
    <Disclosure
      title={`Group settings: ${name}`}
      count={groupSettingsCount(group)}
      target={targetKey({ kind: 'rowGroup', id: group.id })}
      className="rounded border border-dashed px-1 py-0.5"
      contentClassName="flex flex-col gap-1 py-1"
    >
      <SettingsEntries
        dashboard={dashboard}
        place={{ level: 'rowGroup', groupId: group.id }}
        onChange={onChange}
      />
      <ProviderRules
        title={`Row rules of ${name}`}
        target={targetKey({
          kind: 'rowGroup',
          id: group.id,
          part: 'record',
        })}
        rules={{
          github: group.rowRules.github?.record,
          amplify: group.rowRules.amplify?.record,
        }}
        onChange={(p, record) => {
          onChange(setGroupRowRule(dashboard, group.id, p, record));
        }}
      />
      <OverrideFields
        name={name}
        target={targetKey({ kind: 'rowGroup', id: group.id })}
        stages={inheritedStages(dashboard, undefined)}
        own={patterns(dashboard.stages, (id) =>
          groupOverridePattern(group, id),
        )}
        custom={customStages(dashboard.stages, (id) =>
          groupOverridePattern(group, id),
        )}
        renderRule={(stageId) => {
          const rules = ownOverride(group.stageRules, stageId);
          return (
            <ProviderRules
              defaultOpen
              title={`${stageId} stage rules of ${name}`}
              rules={{ github: rules?.github, amplify: rules?.amplify }}
              onChange={(p, rule) => {
                onChange(
                  setRowGroupStageRule(dashboard, group.id, stageId, p, rule),
                );
              }}
            />
          );
        }}
        loadBranches={() =>
          discoverBranches(
            dashboard,
            env,
            dashboard.rows.filter((r) => group.memberIds.includes(r.id)),
          )
        }
        onChange={(stageId, pattern) => {
          onChange(setRowGroupOverride(dashboard, group.id, stageId, pattern));
        }}
      />
    </Disclosure>
  );
}
