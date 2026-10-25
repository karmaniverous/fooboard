/**
 * The demo's preferences (spec.md §3.14 *Board and edits*): the device's
 * store for the view settings (zoom, row height and the rest of a
 * dashboard's view), which the demo saves like any board, but problem
 * dismissals kept in memory for the visit, since a dismissal is an edit
 * and nothing edited in the demo outlives it.
 *
 * @module
 */
import type { PreferencesStore } from '@/storage/preferencesStore';

/** `device`'s preferences, with dismissals held for this visit only. */
export function demoPreferences(device: PreferencesStore): PreferencesStore {
  const dismissed = new Map<string, string[]>();
  const withDismissed = (
    id: string,
    view: ReturnType<PreferencesStore['getView']>,
  ) => ({
    ...view,
    dismissedProblems: dismissed.get(id) ?? [],
  });
  return {
    ...device,
    getView: (id) => withDismissed(id, device.getView(id)),
    setView: (id, { dismissedProblems, ...changes }) => {
      if (dismissedProblems) dismissed.set(id, dismissedProblems);
      return withDismissed(id, device.setView(id, changes));
    },
  };
}
