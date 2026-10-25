/**
 * The dashboard editor (spec.md C-21): general settings (rename,
 * duplicate, delete), rows, stages, source rules and status sets. Every
 * change is validated against the dashboard schema before it is saved, so
 * an edit can never leave a dashboard that won't load. Opened on a fix
 * (spec.md A§4.3.7), it opens and scrolls to the item, and offers a check
 * drafted from the record on the rule. In a side panel its tabs sit in the
 * panel's pinned header (`PanelTabs`, spec.md §3.6) and the item scrolls
 * in the panel's body.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PanelTabs } from '@/components/SidePanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Dashboard } from '@/domain/config/dashboard';
import { sourcesWithItems } from '@/domain/model/sources';
import type { Problem } from '@/domain/problems/problem';

import type { EditorDraft } from './draft';
import { EditFocusContext, EDITOR_TABS, type EditorTab } from './editTarget';
import { GeneralEditor } from './GeneralEditor';
import { NotSaved } from './NotSaved';
import { RowsEditor } from './RowsEditor';
import {
  BranchSamplesContext,
  type RuleSamples,
  RuleSamplesContext,
  SourcesWithItemsContext,
} from './rules/samples';
import { SourcesEditor } from './sources/SourcesEditor';
import { StagesEditor } from './StagesEditor';
import { StatusSetsEditor } from './statuses/StatusSetsEditor';
import type { UnknownCell } from './statuses/unknownRuns';
import { useValidatedChange } from './useValidatedChange';

const FOCUS_RING = ['ring-2', 'ring-amber-500'];

/** Mark and scroll to the first of `keys` found under `root` (the
 * sections holding it opened themselves: `useFocused`). */
function focusItem(root: HTMLElement, keys: readonly string[]): void {
  for (const key of keys) {
    const el = root.querySelector<HTMLElement>(
      `[data-edit-target="${CSS.escape(key)}"]`,
    );
    if (!el) continue;
    el.classList.add(...FOCUS_RING);
    // Not every environment lays out (scrolling is a nicety there).
    if (typeof el.scrollIntoView === 'function')
      el.scrollIntoView({ block: 'center' });
    return;
  }
}

export function DashboardEditor({
  dashboard,
  onChange,
  draft,
  unknown,
  samples = {},
  branchSamples = [],
  problems = [],
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
  /** Open on a fix (*Add rule*, *Add override*, *Fix*). */
  draft?: EditorDraft;
  /** The board's cells whose run matched no status (A§4.3.6). */
  unknown?: readonly UnknownCell[];
  /** The board's records per source, for rule previews. */
  samples?: RuleSamples;
  /** The Amplify branch list entries read, for the branch rule. */
  branchSamples?: readonly JSONValue[];
  /** The board's problems shown (the Sources tab lists its own). */
  problems?: readonly Problem[];
}): React.JSX.Element {
  const [tab, setTab] = useState<EditorTab>(draft?.tab ?? 'General');
  const root = useRef<HTMLDivElement>(null);
  const focus = useMemo(
    () => ({ focus: draft?.focus ?? [], check: draft?.check }),
    [draft],
  );
  useEffect(() => {
    if (root.current && draft?.focus) focusItem(root.current, draft.focus);
  }, [draft]);
  const withItems = sourcesWithItems(dashboard);
  const { update, error } = useValidatedChange(onChange);
  const props = { dashboard, onChange: update };
  return (
    <EditFocusContext value={focus}>
      <RuleSamplesContext value={samples}>
        <SourcesWithItemsContext value={withItems}>
          <BranchSamplesContext value={branchSamples}>
            <div ref={root}>
              <Tabs
                className="flex flex-col gap-3"
                value={tab}
                onValueChange={(v) => {
                  const next = EDITOR_TABS.find((t) => t === v);
                  if (next) setTab(next);
                }}
              >
                <PanelTabs>
                  <TabsList aria-label="Editor section">
                    {EDITOR_TABS.map((t) => (
                      <TabsTrigger key={t} value={t}>
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </PanelTabs>
                <NotSaved error={error} />
                {/* Only the open tab's panel is mounted (Radix's default). */}
                <TabsContent value="General">
                  <GeneralEditor {...props} />
                </TabsContent>
                <TabsContent value="Rows">
                  <RowsEditor {...props} override={draft?.override} />
                </TabsContent>
                <TabsContent value="Stages">
                  <StagesEditor
                    {...props}
                    draftPattern={
                      draft?.tab === 'Stages' ? draft.pattern : undefined
                    }
                  />
                </TabsContent>
                <TabsContent value="Sources">
                  <SourcesEditor
                    {...props}
                    hints={problems.filter((p) => p.target?.kind === 'source')}
                  />
                </TabsContent>
                <TabsContent value="Statuses">
                  <StatusSetsEditor {...props} unknown={unknown} />
                </TabsContent>
              </Tabs>
            </div>
          </BranchSamplesContext>
        </SourcesWithItemsContext>
      </RuleSamplesContext>
    </EditFocusContext>
  );
}
