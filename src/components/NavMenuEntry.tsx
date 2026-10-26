/**
 * One navigation item (see `navItems`) in the header menu: a menu item for
 * a link, route or action, and radio items for a choice.
 *
 * @module
 */
import { Link } from 'react-router-dom';

import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

import { ExternalLink } from './ExternalLink';
import type { NavItem } from './navItems';

export function NavMenuEntry({ item }: { item: NavItem }): React.JSX.Element {
  const body = (
    <>
      <item.Icon className="size-4" />
      {item.label}
    </>
  );
  switch (item.kind) {
    case 'choice':
      return (
        <DropdownMenuRadioGroup
          aria-label={item.name}
          value={item.value}
          onValueChange={item.onChange}
        >
          {item.options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      );
    case 'link':
      return (
        <DropdownMenuItem asChild className="gap-2">
          <ExternalLink unstyled href={item.href}>
            {body}
          </ExternalLink>
        </DropdownMenuItem>
      );
    case 'route':
      return (
        <DropdownMenuItem asChild className="gap-2">
          <Link to={item.to}>{body}</Link>
        </DropdownMenuItem>
      );
    case 'action':
      return (
        <DropdownMenuItem className="gap-2" onSelect={item.onSelect}>
          {body}
        </DropdownMenuItem>
      );
  }
}
