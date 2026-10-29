/**
 * What an address the app has no route for shows (spec.md §2.16, Scope
 * item 6, row P7): *Page not found*, in the look of *Dashboard not found*.
 *
 * @module
 */
import { NotFound } from '@/pages/NotFound';

export function PageNotFound(): React.JSX.Element {
  return (
    <NotFound
      title="Page not found"
      message="There's nothing at this address."
    />
  );
}
