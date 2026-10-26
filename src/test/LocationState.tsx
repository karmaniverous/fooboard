/**
 * For tests: the router's location state, as JSON (test id
 * `location-state`), and *History back*, the browser's Back.
 *
 * @module
 */
import { useLocation, useNavigate } from 'react-router-dom';

export function LocationState(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location-state">
        {JSON.stringify(useLocation().state)}
      </output>
      <button
        type="button"
        onClick={() => {
          navigate(-1);
        }}
      >
        History back
      </button>
    </>
  );
}
