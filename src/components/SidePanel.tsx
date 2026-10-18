/**
 * A side panel (editor, credentials, unmapped runs): the library's Sheet
 * from the right, with a title and a close button.
 *
 * @module
 */
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export function SidePanel({
  title,
  trigger,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  /** The element that opens the panel. */
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right">
        <SheetTitle>{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
