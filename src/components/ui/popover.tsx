/**
 * Popover: shadcn-style wrapper over Radix's popover primitive (placed
 * against its anchor and kept inside the window).
 *
 * @module
 */
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { CLOSE_BUTTON_CLASS } from './buttonVariants';

const Popover = PopoverPrimitive.Root;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={6}
      className={cn(
        'z-50 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/** The popover's close button: the modals' X, named *Close*. */
function PopoverClose({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <PopoverPrimitive.Close
      aria-label="Close"
      className={cn(CLOSE_BUTTON_CLASS, className)}
    >
      <X aria-hidden className="size-4" />
    </PopoverPrimitive.Close>
  );
}

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
