/**
 * One navigation item (see `appNav`) as an icon button with a tooltip (the
 * header, the footer's icon form) or as a text link (the footer).
 *
 * @module
 */
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { WithTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { ExternalLink } from './ExternalLink';
import type { NavItem } from './navItems';

export function NavControl({
  item,
  form,
  className,
}: {
  item: NavItem;
  form: 'icon' | 'text';
  className?: string;
}): React.JSX.Element {
  const { label, Icon } = item;
  const content =
    form === 'icon' ? <Icon className="size-4" /> : <span>{label}</span>;
  const iconProps =
    form === 'icon' ? ({ 'aria-label': label } as const) : ({} as const);
  const look = cn(
    form === 'icon'
      ? 'size-8 shrink-0 p-0'
      : 'h-auto px-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline',
    className,
  );
  const variant = form === 'icon' ? 'ghost' : 'link';
  const linkLook = buttonVariants({ variant, className: look });
  let control: React.JSX.Element;
  if (item.href)
    control = (
      <ExternalLink
        unstyled
        href={item.href}
        className={linkLook}
        {...iconProps}
      >
        {content}
      </ExternalLink>
    );
  else if (item.to)
    control = (
      <Link to={item.to} className={linkLook} {...iconProps}>
        {content}
      </Link>
    );
  else
    control = (
      <Button
        type="button"
        variant={variant}
        className={cn(look, item.disabled && 'cursor-not-allowed opacity-50')}
        // Still focusable and hoverable, so its tooltip says why.
        aria-disabled={item.disabled}
        onClick={item.disabled ? undefined : item.onSelect}
        {...iconProps}
      >
        {content}
      </Button>
    );
  return form === 'icon' ? (
    <WithTooltip label={label}>{control}</WithTooltip>
  ) : (
    control
  );
}
