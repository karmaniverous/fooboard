/**
 * One navigation item (see `navItems`) as an icon button with a tooltip
 * (the header, the footer's icon form) or as a text link (the footer). A
 * choice cycles to its next option.
 *
 * @module
 */
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  buttonVariants,
  ICON_BUTTON_CLASS,
} from '@/components/ui/buttonVariants';
import { WithTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { ExternalLink } from './ExternalLink';
import { type NavItem, nextOption } from './navItems';

export function NavControl({
  item,
  form,
}: {
  item: NavItem;
  form: 'icon' | 'text';
}): React.JSX.Element {
  const { label, Icon } = item;
  const content =
    form === 'icon' ? <Icon className="size-4" /> : <span>{label}</span>;
  const named = form === 'icon' ? { 'aria-label': label } : {};
  const look = cn(
    buttonVariants({ variant: form === 'icon' ? 'ghost' : 'link' }),
    form === 'icon'
      ? ICON_BUTTON_CLASS
      : 'h-auto px-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline',
  );
  let control: React.JSX.Element;
  switch (item.kind) {
    case 'link':
      control = (
        <ExternalLink unstyled href={item.href} className={look} {...named}>
          {content}
        </ExternalLink>
      );
      break;
    case 'route':
      control = (
        <Link to={item.to} className={look} {...named}>
          {content}
        </Link>
      );
      break;
    default:
      control = (
        <Button
          type="button"
          variant="ghost"
          className={look}
          onClick={() => {
            if (item.kind === 'choice')
              item.onChange(nextOption(item.options, item.value));
            else item.onSelect();
          }}
          {...named}
        >
          {content}
        </Button>
      );
  }
  return form === 'icon' ? (
    <WithTooltip label={label}>{control}</WithTooltip>
  ) : (
    control
  );
}
