/**
 * Tooltip: shadcn-style wrapper over Radix's tooltip primitive (shown on
 * hover and on keyboard focus, kept inside the window). Each `WithTooltip`
 * brings its own provider, so components and their tests need no wrapper.
 *
 * @module
 */
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={6}
      className={cn(
        'z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** `children` with a tooltip saying `label` (the common case). */
function WithTooltip({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactElement;
}): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipPrimitive.Provider>
  );
}

export { WithTooltip };
