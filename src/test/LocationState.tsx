/**
 * For tests: the router's location state, as JSON (test id
 * `location-state`).
 *
 * @module
 */
import { useLocation } from 'react-router-dom';

export function LocationState(): React.JSX.Element {
  return (
    <output data-testid="location-state">
      {JSON.stringify(useLocation().state)}
    </output>
  );
}
