/**
 * Choosing a status set at a place (spec.md A§4.3.6, §3.11): the
 * `statusSets` setting for one provider, at any of the six levels, and
 * every choice of one set swapped for another. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Provider } from '@/domain/config/providers';
import { DEFAULT_STATUS_SET_IDS } from '@/domain/config/statusSets';
import {
  mapSettings,
  setSettings,
  settingsAt,
  type SettingsPlace,
} from '@/domain/settings/places';
import { readSetting, writeSetting } from '@/domain/settings/schema';

/** `d` with `provider`'s set at `place` chosen as `id`. */
export const chooseSetAt = (
  d: Dashboard,
  place: SettingsPlace,
  provider: Provider,
  id: string,
): Dashboard =>
  setSettings(
    d,
    place,
    writeSetting(settingsAt(d, place) ?? {}, 'statusSets', provider, id),
  );

/** Every choice of set `from` (for `provider`) in `d` made `to` instead,
 * the built-in's use included: a dashboard choosing none while `from` is
 * the built-in now chooses `to`. */
export function replaceSet(
  d: Dashboard,
  provider: Provider,
  from: string,
  to: string,
): Dashboard {
  const swapped = mapSettings(d, (s) =>
    s.statusSets?.[provider] === from
      ? writeSetting(s, 'statusSets', provider, to)
      : s,
  );
  const builtIn =
    readSetting(d.settings, 'statusSets', provider) === undefined &&
    DEFAULT_STATUS_SET_IDS[provider] === from;
  return builtIn
    ? chooseSetAt(swapped, { level: 'dashboard' }, provider, to)
    : swapped;
}
