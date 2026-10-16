/**
 * Re-render when any credential secret changes (entered, remembered,
 * forgotten or copied). The returned number changes on every change, so
 * it can key memoised readers that must be rebuilt.
 *
 * @module
 */
import { useEffect, useState } from 'react';

import { useStores } from '@/storage/storesContext';

export function useCredentialVersion(): number {
  const { credentials } = useStores();
  const [version, setVersion] = useState(0);
  useEffect(
    () =>
      credentials.subscribe(() => {
        setVersion((v) => v + 1);
      }),
    [credentials],
  );
  return version;
}
