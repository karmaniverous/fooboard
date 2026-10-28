/**
 * The *Reset* confirmation (spec.md C-4, §3.9, Decisions 15 and 38): an
 * alert dialog saying what goes (every dashboard, credential, setting and
 * cached answer fooboard keeps in this browser, in every open tab) before
 * the stores' Reset clears it and reloads. If the cache or local storage
 * can't be cleared, the dialog stays open and says so.
 *
 * @module
 */
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { describeError } from '@/lib/errors';
import { site } from '@/lib/site';
import { useStores } from '@/storage/storesContext';

export function ResetDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when it closes (it has no trigger of its own). */
  onCloseAutoFocus?: (event: Event) => void;
}): React.JSX.Element {
  const stores = useStores();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogTitle>Reset {site.name}?</AlertDialogTitle>
        <AlertDialogDescription>
          This removes every dashboard, credential, setting and cached answer{' '}
          {site.name} keeps in this browser, in every open {site.name} tab,
          which then reload. It can&apos;t be undone, and it doesn&apos;t revoke
          your tokens or keys at GitHub or AWS.
        </AlertDialogDescription>
        {error && (
          <p role="alert" className="text-sm text-status-failure">
            Not reset: {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              // Stay open until it's done (the page reloads), or to say why not.
              e.preventDefault();
              setBusy(true);
              stores.reset().then(
                () => {
                  setBusy(false);
                  onOpenChange(false);
                },
                (err: unknown) => {
                  setBusy(false);
                  setError(describeError(err));
                },
              );
            }}
          >
            Reset
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
