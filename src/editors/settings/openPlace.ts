/**
 * Opening the dashboard editor at a place's settings, from inside a
 * settings editor (spec.md §3.11 *Unlabelled groups have no gear*): an
 * unlabelled group has no gear on the board, so where a settings popup
 * names one as an origin, the origin opens *Edit dashboard* at the
 * group's settings. Provided by the board's settings popup where the
 * board has a dashboard editor; absent elsewhere (the editor itself, and
 * the demo until it has one), where origins stay plain text.
 *
 * @module
 */
import { createContext } from 'react';

import type { SettingsPlace } from '@/domain/settings/places';

export const OpenPlaceContext = createContext<
  ((place: SettingsPlace) => void) | undefined
>(undefined);
