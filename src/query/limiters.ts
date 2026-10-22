/**
 * The limiters of one QueryClient (spec.md §3.2, Decision 28): one per
 * credential, per tab. A credential belongs to one dashboard, so its cap
 * is that dashboard's *requests in flight* for its platform; configuring
 * a dashboard applies its settings at once and refetches nothing.
 *
 * @module
 */
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Provider } from '@/domain/config/providers';
import { DEFAULT_REQUESTS_IN_FLIGHT } from '@/domain/config/settings';
import { getOrCreate } from '@/lib/memo';

import { createLimiter, type Limiter, type Timers } from './limiter';

/** The provider a credential kind reads. */
const PROVIDER_OF: Record<CredentialKind, Provider> = {
  github: 'github',
  aws: 'amplify',
};

export interface Limiters {
  /** The credential's limiter, created at its configured cap. */
  for(provider: Provider, credentialId: string): Limiter;
  /** Apply `dashboard`'s requests in flight to its credentials. */
  configure(dashboard: Pick<Dashboard, 'credentials' | 'settings'>): void;
}

export function createLimiters({
  now,
  timers,
}: { now?: () => number; timers?: Timers } = {}): Limiters {
  const limiters = new Map<string, Limiter>();
  const caps = new Map<string, number>();
  const id = (provider: Provider, credentialId: string) =>
    JSON.stringify([provider, credentialId]);
  return {
    for(provider, credentialId) {
      const key = id(provider, credentialId);
      return getOrCreate(limiters, key, () =>
        createLimiter({
          max: caps.get(key) ?? DEFAULT_REQUESTS_IN_FLIGHT,
          now,
          timers,
        }),
      );
    },
    configure({ credentials, settings }) {
      for (const credential of credentials) {
        const key = id(PROVIDER_OF[credential.kind], credential.id);
        const cap = settings.requestsInFlight[credential.kind];
        caps.set(key, cap);
        limiters.get(key)?.setMax(cap);
      }
    },
  };
}
