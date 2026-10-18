/**
 * The footer (spec.md C-19): the copyright at the left and every menu item
 * at the right, on one line that never wraps. As it narrows the items
 * become icons, then drop out from the left; Privacy and Terms always
 * stay. Chosen by measuring the content.
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import { type FooterForm, footerForm } from '@/lib/footerForm';
import { site } from '@/lib/site';
import { measuredWidth, useMeasured } from '@/lib/useMeasured';
import { cn, PINNED_FULL } from '@/lib/utils';

import { NavControl } from './NavControl';
import { useNavItems } from './navItems';

export function Footer(): React.JSX.Element {
  const items = useNavItems();
  const legalCount = items.filter((i) => i.legal).length;
  const [ref, form] = useMeasured<HTMLElement, FooterForm>((el) => {
    // Not laid out (no width yet): the full form.
    if (el.clientWidth === 0) return -1;
    const style = getComputedStyle(el);
    const room =
      el.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0');
    return footerForm(
      room,
      measuredWidth(el, 'copyright'),
      measuredWidth(el, 'text'),
      items.map((i) => measuredWidth(el, `icon-${i.id}`)),
      legalCount,
    );
  }, -1);
  const copyright = (
    <span className="shrink-0">
      &copy; 2026{' '}
      <ExternalLink href={site.ownerUrl}>{site.ownerName}</ExternalLink>
    </span>
  );
  const shown = form < 0 ? items : items.filter((i, n) => i.legal || n >= form);
  return (
    <footer
      ref={ref}
      className={cn(
        PINNED_FULL,
        'flex items-center justify-between gap-6 overflow-hidden whitespace-nowrap border-t border-border px-5 py-3 text-xs text-muted-foreground',
      )}
    >
      {/* Natural widths of each form (never shown). */}
      <div
        aria-hidden
        inert
        className="invisible absolute left-0 top-0 flex w-max flex-col"
      >
        <span data-measure="copyright" className="w-max">
          {copyright}
        </span>
        <span data-measure="text" className="flex w-max gap-4">
          {items.map((i) => (
            <NavControl key={i.id} item={i} form="text" />
          ))}
        </span>
        <span className="flex w-max gap-1">
          {items.map((i) => (
            <span key={i.id} data-measure={`icon-${i.id}`}>
              <NavControl item={i} form="icon" />
            </span>
          ))}
        </span>
      </div>

      {copyright}
      <nav
        aria-label="Footer"
        className={cn('flex items-center', form < 0 ? 'gap-4' : 'gap-1')}
      >
        {shown.map((i) => (
          <NavControl key={i.id} item={i} form={form < 0 ? 'text' : 'icon'} />
        ))}
      </nav>
    </footer>
  );
}
