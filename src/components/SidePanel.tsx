/**
 * A modal side panel (Radix Dialog): takes focus, traps Tab, closes on
 * Escape, the backdrop or Close, and returns focus to its trigger. Used
 * for a dashboard's credentials, editors and unmapped runs.
 *
 * @module
 */
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function SidePanel({
  title,
  trigger,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** The element that opens the panel (rendered as the dialog trigger). */
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col gap-4 overflow-y-auto border-l bg-background p-5 shadow-xl"
        >
          <div className="flex items-center">
            <Dialog.Title className="text-base font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="ml-auto rounded-md p-1 hover:bg-muted"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
