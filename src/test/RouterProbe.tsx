/**
 * For share and import tests: the router's path (test id `where`) and a
 * button opening the import dialog for a file.
 *
 * @module
 */
import { useLocation } from 'react-router-dom';

import { useNavDialogs } from '@/components/navItems';

export function RouterProbe(): React.JSX.Element {
  const { openImport } = useNavDialogs();
  return (
    <>
      <p data-testid="where">{useLocation().pathname}</p>
      <button type="button" onClick={openImport}>
        Open import
      </button>
    </>
  );
}
