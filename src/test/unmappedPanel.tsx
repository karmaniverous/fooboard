/**
 * The Unmapped panel in its side panel over a dashboard kept in state
 * (spec 0.2.0 §3.I), and its test entries and queries, for the
 * dismissal tests.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Unlink } from 'lucide-react';
import { useState } from 'react';

import { BoardActionButton } from '@/board/BoardActionButton';
import { UnmappedPanel } from '@/board/UnmappedPanel';
import { SidePanel } from '@/components/SidePanel';
import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';
import type { UnmappedDismissal } from '@/domain/config/unmappedDismissals';
import { UNMAPPED } from '@/domain/derivation';
import type { UnmappedRun } from '@/engine';
import { splitUnmapped } from '@/engine/unmappedDismissals';

const noRow = { kind: UNMAPPED.noRowMatches } as const;
export const entry = (
  n: number,
  over: Partial<UnmappedRun> = {},
): UnmappedRun => ({
  provider: 'github',
  id: `github:acme/api#${String(n)}`,
  where: 'acme/api',
  title: 'Deploy API',
  record: {},
  branch: 'feature/login',
  htmlUrl: `https://github.com/acme/api/actions/runs/${String(n)}`,
  reason: noRow,
  rows: [{ rowId: 'api', reason: noRow }],
  ...over,
});
const deploy = entry(1);
export const nightly = entry(2, { title: 'Nightly', branch: 'main' });

const PANEL = 'Unmapped runs';

/** Dismissals a test starts with, and, once rendered, a way to replace
 * them from outside the panel (another surface's edit). */
export interface Outside {
  dismissals: UnmappedDismissal[];
  replace?: (dismissals: UnmappedDismissal[]) => void;
}

/** The panel in its side panel, open, over a dashboard kept in state;
 * the panel goes, as its button does, once no entry is shown. */
export function renderPanel(
  unmapped: UnmappedRun[] = [deploy, nightly],
  save: (d: Dashboard) => void = () => undefined,
  onEmptied?: () => void,
  outside: Outside = { dismissals: [] },
): Dashboard[] {
  const saved: Dashboard[] = [];
  function Harness(): React.JSX.Element {
    const [dashboard, setDashboard] = useState(
      DashboardSchema.parse({
        id: 'd',
        name: 'D',
        unmappedDismissals: outside.dismissals,
      }),
    );
    outside.replace = (dismissals) => {
      setDashboard((d) => ({ ...d, unmappedDismissals: dismissals }));
    };
    const [show, setShow] = useState(false);
    const shown = splitUnmapped(unmapped, dashboard.unmappedDismissals).shown;
    return (
      <>
        {shown.length > 0 && (
          <SidePanel
            title={PANEL}
            tooltip={PANEL}
            trigger={<BoardActionButton label={PANEL} Icon={Unlink} />}
          >
            <UnmappedPanel
              unmapped={unmapped}
              dashboard={dashboard}
              onChange={(next) => {
                save(next);
                saved.push(next);
                setDashboard(next);
              }}
              showDismissed={show}
              onShowDismissed={setShow}
              onAddTest={() => undefined}
              onEmptied={onEmptied}
            />
          </SidePanel>
        )}
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: PANEL }));
  return saved;
}

/** The open side panel. */
export const panel = (): HTMLElement =>
  screen.getByRole('dialog', { name: PANEL });
/** Open the *Dismiss…* form of the entry titled `title`. */
export const openForm = (title: string): HTMLElement => {
  const item = within(panel()).getByRole('link', { name: title }).closest('li');
  if (!item) throw new Error(`no entry ${title}`);
  fireEvent.click(within(item).getByRole('button', { name: 'Dismiss…' }));
  return screen.getByRole('form', { name: `Dismiss ${title}` });
};
export const field = (form: HTMLElement, name: string): HTMLElement =>
  within(form).getByRole('textbox', { name });
export const dismissButton = (form: HTMLElement): HTMLElement =>
  within(form).getByRole('button', { name: 'Dismiss' });
/** The panel's heading, counting the entries. */
export const heading = (): HTMLElement =>
  within(panel()).getByRole('heading', { level: 3 });
