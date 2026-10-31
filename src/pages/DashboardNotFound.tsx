/**
 * What a page for a dashboard this browser doesn't hold shows: the board
 * (spec.md §2.4) and the first run's later steps (§3.9).
 *
 * @module
 */
import { NotFound } from '@/pages/NotFound';

export function DashboardNotFound(): React.JSX.Element {
  return (
    <NotFound
      title="Dashboard not found"
      message="It isn't saved in this browser."
    />
  );
}
