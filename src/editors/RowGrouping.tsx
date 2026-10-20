/**
 * A row's group and overrides in the row editor (spec.md C-14b, C-14c,
 * C-1a, C-15, A§4.3.6): its group; its group's default credentials,
 * status sets and stage-rule overrides (shown on each member, since a
 * group has no editor of its own); *Add override* from an unmapped
 * record; and the row's own overrides, as branch patterns or general
 * rules (A§4.3.7).
 *
 * @module
 */
import { useContext } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf, type RowGroup } from '@/domain/config/groups';
import { ownOverride } from '@/domain/config/ownOverride';
import type { Row } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { ITEM_NAME_PATH } from '@/domain/model/keys';
import { always } from '@/domain/rules/always';
import { branchOf } from '@/domain/rules/branch';
import { targetKey } from '@/editors/editTarget';
import type { EngineProviders } from '@/engine';

import { discoverBranches } from './branches';
import { CredentialSelect } from './CredentialSelect';
import { GroupControl } from './GroupControl';
import {
  groupOverridePattern,
  rowOverridePattern,
  setRowGroupCredential,
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
import { SourcesWithItemsContext } from './rules/samples';
import { GroupStatusSets, RowStatusSets } from './statuses/StatusSetOverrides';

interface Props {
  dashboard: Dashboard;
  providers: EngineProviders;
  onChange: (dashboard: Dashboard) => void;
}

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
  const { dashboard, providers, onChange } = props;
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
        loadBranches={() => discoverBranches(dashboard, providers, [row])}
        onChange={(stageId, pattern) => {
          onChange(setRowOverride(dashboard, row.id, stageId, pattern));
        }}
      />
      <RowStatusSets dashboard={dashboard} row={row} onChange={onChange} />
    </>
  );
}

function RowGroupSettings({
  dashboard,
  providers,
  onChange,
  group,
}: Props & { group: RowGroup }): React.JSX.Element {
  const name = group.label ?? 'this group';
  const withItems = useContext(SourcesWithItemsContext);
  return (
    <div
      className="flex flex-col gap-1 rounded border border-dashed p-1 text-xs"
      data-edit-target={targetKey({ kind: 'rowGroup', id: group.id })}
    >
      <span className="font-semibold">Group settings: {name}</span>
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ['github', 'GitHub token'],
            ['aws', 'AWS key'],
          ] as const
        ).map(([kind, noun]) => (
          <CredentialSelect
            key={kind}
            dashboard={dashboard}
            kind={kind}
            label={`${noun} for ${name}`}
            value={group.defaultCredentials[kind]}
            onChange={(id) => {
              onChange(setRowGroupCredential(dashboard, group.id, kind, id));
            }}
          />
        ))}
      </div>
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
          onChange(setGroupRowRule(dashboard, group.id, p, 'record', record));
        }}
      />
      <ProviderRules
        title={`Item rules of ${name}`}
        scope="item"
        newPath={ITEM_NAME_PATH}
        target={targetKey({
          kind: 'rowGroup',
          id: group.id,
          part: 'items',
        })}
        providers={withItems}
        rules={{
          github: group.rowRules.github?.items,
          amplify: group.rowRules.amplify?.items,
        }}
        onChange={(p, items) => {
          onChange(setGroupRowRule(dashboard, group.id, p, 'items', items));
        }}
      />
      <GroupStatusSets
        dashboard={dashboard}
        group={group}
        name={name}
        onChange={onChange}
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
            providers,
            dashboard.rows.filter((r) => group.memberIds.includes(r.id)),
          )
        }
        onChange={(stageId, pattern) => {
          onChange(setRowGroupOverride(dashboard, group.id, stageId, pattern));
        }}
      />
    </div>
  );
}
