/**
 * Whether this browser has seen this build's release notes (spec 0.2.0
 * §3.D; Decision 100): the dot on the menu's *Release notes* shows while
 * this build's version is newer than the last one seen (a device
 * preference) and goes when the link is followed, which stores this
 * build's version. A first visit (nothing stored, Reset included) takes
 * this build's version as seen and stores it, so it never shows the dot.
 *
 * @module
 */
import { useEffect, useMemo, useState } from 'react';

import { APP_VERSION } from '@/lib/site';
import { isUnseen } from '@/lib/versions';
import type { PreferencesStore } from '@/storage/preferencesStore';

export interface ReleaseNotesSeen {
  /** Mark this build's release notes seen. */
  markReleaseNotesSeen: () => void;
  /** Whether this browser hasn't seen this build's release notes. */
  releaseNotesUnseen: boolean;
}

export function useReleaseNotesSeen(
  preferences: Pick<
    PreferencesStore,
    'getLastSeenVersion' | 'setLastSeenVersion'
  >,
): ReleaseNotesSeen {
  const [lastSeen, setLastSeen] = useState(
    () => preferences.getLastSeenVersion() ?? APP_VERSION,
  );
  useEffect(() => {
    if (preferences.getLastSeenVersion() === undefined)
      preferences.setLastSeenVersion(APP_VERSION);
  }, [preferences]);
  return useMemo(
    () => ({
      markReleaseNotesSeen: () => {
        preferences.setLastSeenVersion(APP_VERSION);
        setLastSeen(APP_VERSION);
      },
      releaseNotesUnseen: isUnseen(APP_VERSION, lastSeen),
    }),
    [lastSeen, preferences],
  );
}
