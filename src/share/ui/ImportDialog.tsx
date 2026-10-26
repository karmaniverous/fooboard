/**
 * The import dialog (spec.md §3.8), for a share link just opened or a
 * file the user chooses: a share that can't be read shows the error state
 * ("This link isn't a fooboard board, or it's damaged", or that a newer
 * fooboard made it); one that can lists its dashboards and the choices
 * (`ImportForm`). *Replace the whole setup* asks for confirmation in an
 * alert dialog. Nothing is written until *Import*; cancelling discards
 * the share. After an import the app opens the imported dashboard, or the
 * home page when there were several.
 *
 * @module
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { describeError } from '@/lib/errors';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

import { applyImport } from '../applyImport';
import { readShare, type Share, type ShareRead } from '../envelope';
import type { ImportPlan } from '../importPlan';
import type { LinkPayload } from '../link';
import { DIALOG_SCROLLS } from './dialogClass';
import { ImportForm } from './ImportForm';
import {
  refusalHint,
  refusalMessage,
  type ShareOrigin,
  shareSummary,
} from './shareWords';
import { useImportForm } from './useImportForm';

const readLink = (link: LinkPayload): ShareRead =>
  link.kind === 'text'
    ? readShare(link.text)
    : { ok: false, reason: 'damaged' };

function ImportChoices({
  share,
  onDone,
  onCancel,
}: {
  share: Share;
  onDone: (plan: ImportPlan) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const stores = useStores();
  const existing = useMemo(() => dashboardsOf(stores.config.load()), [stores]);
  const form = useImportForm(share, existing);
  const [confirming, setConfirming] = useState<ImportPlan | null>(null);
  const [imported, setImported] = useState<ImportPlan | null>(null);
  const apply = (plan: ImportPlan) => {
    try {
      applyImport(stores, plan, form.remember);
      onDone(plan);
    } catch (err) {
      // Secrets that failed after the dashboards were saved: imported, and
      // the message says how to clear what was left.
      if (err instanceof AggregateError) {
        form.setError(err.message);
        setImported(plan);
      } else form.setError(describeError(err));
    }
  };
  return (
    <>
      <ImportForm form={form} dashboards={share.dashboards} />
      <div className="flex justify-end gap-2">
        {imported ? (
          <Button
            onClick={() => {
              onDone(imported);
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              disabled={!form.ready}
              onClick={() => {
                form.plan().then(
                  (plan) => {
                    if (!plan) return;
                    if (form.mode === 'replaceAll') setConfirming(plan);
                    else apply(plan);
                  },
                  (err: unknown) => {
                    form.setError(describeError(err));
                  },
                );
              }}
            >
              {form.busy ? 'Opening…' : 'Import'}
            </Button>
          </>
        )}
      </div>
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Replace the whole setup?</AlertDialogTitle>
          <AlertDialogDescription>
            Every dashboard in this browser is replaced by the{' '}
            {String(confirming?.dashboards.length ?? 0)} imported, and the
            credentials no imported dashboard uses are forgotten. It can&apos;t
            be undone.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) apply(confirming);
              }}
            >
              Replace
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ImportDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  /** The share link just opened, if that's what opened the dialog. */
  link: LinkPayload | null;
}): React.JSX.Element {
  const navigate = useNavigate();
  // Each file read gets its own form (`n`), whatever it holds.
  const [file, setFile] = useState<{ read: ShareRead; n: number } | null>(null);
  const fromLink = useMemo(() => (link ? readLink(link) : null), [link]);
  const read = fromLink ?? file?.read;
  const origin: ShareOrigin = fromLink ? 'link' : 'file';
  const close = () => {
    setFile(null);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className={DIALOG_SCROLLS}
      >
        <DialogTitle>Import dashboards</DialogTitle>
        {!fromLink && (
          <label className="flex flex-col gap-1 text-sm">
            A fooboard file
            <input
              type="file"
              accept="application/json,.json"
              className="text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-muted file:px-2 file:py-1"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (!chosen) return;
                const show = (next: ShareRead) => {
                  setFile((f) => ({ read: next, n: (f?.n ?? 0) + 1 }));
                };
                chosen.text().then(
                  (text) => {
                    show(readShare(text));
                  },
                  () => {
                    show({ ok: false, reason: 'damaged' });
                  },
                );
              }}
            />
          </label>
        )}
        {read && !read.ok && (
          <>
            <p role="alert" className="text-sm text-status-failure">
              {refusalMessage(read.reason, origin)}
            </p>
            {read.reason !== 'newer' && (
              <p className="text-sm text-muted-foreground">
                {refusalHint(origin)}
              </p>
            )}
          </>
        )}
        {read?.ok && (
          <p className="text-sm text-muted-foreground">
            {shareSummary(read.share, origin)}
          </p>
        )}
        {read?.ok && (
          <ImportChoices
            key={file?.n ?? 0}
            share={read.share}
            onCancel={close}
            onDone={(plan) => {
              close();
              const [only] = plan.imported;
              navigate(plan.imported.length === 1 && only ? `/d/${only}` : '/');
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
