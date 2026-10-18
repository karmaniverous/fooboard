/**
 * Dialog: a centred modal (see `modal` for the shared parts: it takes
 * focus, traps Tab, closes on Escape, the backdrop or Close).
 *
 * @module
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { ModalContent, ModalTitle } from './modal';

const Dialog = DialogPrimitive.Root;
const DialogTitle = ModalTitle;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof ModalContent>,
  React.ComponentPropsWithoutRef<typeof ModalContent>
>(({ className, ...props }, ref) => (
  <ModalContent
    ref={ref}
    className={cn(
      'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border',
      className,
    )}
    {...props}
  />
));
DialogContent.displayName = 'DialogContent';

export { Dialog, DialogContent, DialogTitle };
