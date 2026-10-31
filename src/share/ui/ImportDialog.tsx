/**
 * The import dialog (spec.md §3.8), for a share link just opened, or a
 * file the user chooses or a link or JSON pasted in (`ShareInputs`): a
 * share that can't be read shows the error state (`ShareRefusalNotice`:
 * its problems field by field, with *Copy errors for your assistant*;
 * that it's damaged; or that a newer fooboard made it); one that can
 * lists its dashboards and the choices
 * (`ImportForm`). *Replace the whole setup* asks for confirmation in an
 * alert dialog. While a question about a secret that differs is
 * unanswered, *Import* is disabled and says why (`aria-describedby`).
 * Nothing is written until *Import*; cancelling discards
 * the share. After an import the app opens the imported dashboard, with
 * its credentials panel open on the first credential that has no secret
 * here (`landingAfter`, spec 0.2.0 §3.J *Keys on arrival*), or the home
 * page when there were several.
 *
 * @module
 */
import { useId, useMemo, useState } from 'react';
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
import type { Share, ShareRead } from '../envelope';
import type { ImportPlan } from '../importPlan';
import { landingAfter } from '../landing';
import type { LinkPayload } from '../link';
import { readLink } from '../readLink';
import { DIALOG_SCROLLS } from './dialogClass';
import { ImportForm } from './ImportForm';
import { ShareInputs } from './ShareInputs';
import { ShareRefusalNotice } from './ShareRefusalNotice';
import { ANSWER_TO_IMPORT, type ShareOrigin, shareSummary } from './shareWords';
import { useImportForm } from './useImportForm';

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
  const form = useImportForm(share, existing, (id) =>
    stores.credentials.get(id),
  );
  const why = useId();
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
      {form.asking && !imported && (
        <p id={why} className="text-xs text-muted-foreground">
          {ANSWER_TO_IMPORT}
        </p>
      )}
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
              aria-describedby={form.asking ? why : undefined}
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
  const stores = useStores();
  // Each file or pasted link read gets its own form (`n`), whatever it
  // holds.
  const [chosen, setChosen] = useState<{
    read: ShareRead | null;
    origin: ShareOrigin;
    n: number;
  } | null>(null);
  const fromLink = useMemo(() => (link ? readLink(link) : null), [link]);
  const read = fromLink ?? chosen?.read;
  const origin: ShareOrigin = fromLink ? 'link' : (chosen?.origin ?? 'file');
  const close = () => {
    setChosen(null);
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
          <ShareInputs
            onRead={(next, from) => {
              setChosen((c) => ({
                read: next,
                origin: from,
                n: (c?.n ?? 0) + 1,
              }));
            }}
          />
        )}
        {read && !read.ok && (
          <ShareRefusalNotice refusal={read} origin={origin} />
        )}
        {read?.ok && (
          <p className="text-sm text-muted-foreground">
            {shareSummary(read.share, origin)}
          </p>
        )}
        {read?.ok && (
          <ImportChoices
            key={chosen?.n ?? 0}
            share={read.share}
            onCancel={close}
            onDone={(plan) => {
              close();
              const { path, state } = landingAfter(
                plan,
                (id) => stores.credentials.get(id) !== undefined,
              );
              navigate(path, state ? { state } : undefined);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
