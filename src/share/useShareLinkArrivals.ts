/**
 * A share link pasted into this tab's address bar (spec.md §3.8) changes
 * only the fragment, so no page loads: this takes it as it arrives,
 * clearing the fragment at once (`takeShareLink`), moves the page to home,
 * where the import dialog opens, and hands the payload on.
 *
 * @module
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { type LinkPayload, takeShareLink } from './link';

export function useShareLinkArrivals(
  onLink: (payload: LinkPayload) => void,
): void {
  const navigate = useNavigate();
  useEffect(() => {
    const onHashChange = () => {
      const taken = takeShareLink(window);
      if (!taken) return;
      navigate('/', { replace: true });
      onLink(taken);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [navigate, onLink]);
}
