/**
 * Sheet: shadcn-style panel sliding from an edge, over Radix's dialog
 * primitive (modal: takes focus, traps Tab, closes on Escape or the
 * backdrop, and returns focus).
 *
 * @module
 */
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SIDE = {
  right: 'inset-y-0 right-0 w-full max-w-lg border-l',
  bottom: 'inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl border-t',
} as const;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
    side?: keyof typeof SIDE;
    /** Show the corner close button (on by default). */
    closeButton?: boolean;
  }
>(
  (
    { side = 'right', closeButton = true, className, children, ...props },
    ref,
  ) => (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <SheetPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto border-border bg-background p-5 text-foreground shadow-xl',
          SIDE[side],
          className,
        )}
        {...props}
      >
        {children}
        {closeButton && (
          <SheetPrimitive.Close
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-4" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  ),
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('pr-8 text-base font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger };
