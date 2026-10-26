/**
 * The *Share / Export* dialog (spec.md C-19, §3.8): the saved dashboards'
 * share links, files and X post (`BoardShare`), and beside them the demo's
 * link (`DemoShare`). The demo's own board isn't offered: it is simulated
 * and lives only in its tab, so the demo link shares it.
 *
 * @module
 */
import { useMemo } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { site } from '@/lib/site';
import { BoardShare } from '@/share/ui/BoardShare';
import { DemoShare } from '@/share/ui/DemoShare';
import { DIALOG_SCROLLS } from '@/share/ui/dialogClass';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

export function ShareDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when it closes (it has no trigger of its own). */
  onCloseAutoFocus?: (event: Event) => void;
}): React.JSX.Element {
  const { config } = useStores();
  // Read when opened, so a dashboard saved since is listed.
  const dashboards = useMemo(
    () => (open ? dashboardsOf(config.load()) : []),
    [open, config],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className={DIALOG_SCROLLS}
      >
        <DialogTitle>Share {site.name}</DialogTitle>
        {dashboards.length > 0 ? (
          <BoardShare dashboards={dashboards} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Create or import a dashboard to share it. Meanwhile, share the demo.
          </p>
        )}
        <DemoShare />
      </DialogContent>
    </Dialog>
  );
}
