/**
 * The status sets a provider's cells can use (spec.md A§4.3.6): the
 * bundled presets, then the dashboard's own sets.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { type Provider } from '@/domain/config/providers';
import { PRESETS } from '@/domain/statuses/presets';

/** The sets a provider's cells can use. */
export const setOptions = (
  dashboard: Pick<Dashboard, 'customStatusSets'>,
  provider: Provider,
): { value: string; label: string }[] =>
  [...PRESETS, ...dashboard.customStatusSets]
    .filter((s) => s.provider === provider)
    .map((s) => ({ value: s.id, label: s.name }));
