/**
 * Sheet: a modal panel sliding from an edge (see `modal` for the shared
 * parts: it takes focus, traps Tab, closes on Escape or the backdrop, and
 * returns focus).
 *
 * @module
 */
import * as SheetPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { ModalContent, ModalTitle } from './modal';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = ModalTitle;

const SIDE = {
  right: 'inset-y-0 right-0 w-full max-w-lg border-l',
  bottom: 'inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl border-t',
} as const;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof ModalContent>,
  React.ComponentPropsWithoutRef<typeof ModalContent> & {
    side?: keyof typeof SIDE;
  }
>(({ side = 'right', className, ...props }, ref) => (
  <ModalContent
    ref={ref}
    className={cn('overflow-y-auto', SIDE[side], className)}
    {...props}
  />
));
SheetContent.displayName = 'SheetContent';

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger };
