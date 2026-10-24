/**
 * The shared parts of the library's modals (Dialog, Sheet), over Radix's
 * dialog primitive: the backdrop, the content panel with its corner close
 * button, the close button itself and the title. Each modal only adds its
 * placement.
 *
 * @module
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** The modal's close button: an X named *Close*, its hover a tint of
 * the text colour so it shows on any background. */
function ModalClose({ className }: { className?: string }): React.JSX.Element {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className={cn(
        'rounded-md p-1 hover:bg-current/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <X aria-hidden className="size-4" />
    </DialogPrimitive.Close>
  );
}

const ModalContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Show the corner close button (on by default). */
    closeButton?: boolean;
  }
>(({ closeButton = true, className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(
        'fixed z-50 flex flex-col gap-4 border-border bg-background p-5 text-foreground shadow-xl',
        className,
      )}
      {...props}
    >
      {children}
      {closeButton && <ModalClose className="absolute right-4 top-4" />}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ModalContent.displayName = 'ModalContent';

const ModalTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('pr-8 text-base font-semibold', className)}
    {...props}
  />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

export { ModalClose, ModalContent, ModalTitle };
