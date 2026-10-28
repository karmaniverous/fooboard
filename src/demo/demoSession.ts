/**
 * One visit's demo (spec.md §3.14 *Board and edits*, Decision 53 item 2):
 * the scenario's credentials held in memory for the tab (their demo
 * secrets only the simulator accepts), the simulator's transport, and a
 * query environment of its own, never persisted, whose providers are a
 * real board's built over them. Nothing here touches the device's
 * storage, so nothing done in the demo outlives the visit.
 *
 * @module
 */
import { credentialProviders } from '@/engine/credentialProviders';
import type { Transport } from '@/lib/transport';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import {
  createCredentialStore,
  type CredentialStore,
} from '@/storage/credentialStore';
import { memoryStorage } from '@/storage/keyValue';

import type { DemoScenario } from './sim/scenario';
import { createSimulator, type SimulatorOptions } from './sim/simulator';

export interface DemoSession {
  /** The demo's credential secrets, in memory for the tab. */
  credentials: CredentialStore;
  transport: Transport;
  env: QueryEnv;
}

/** The scenario's tokens and keys as a credential store in memory. */
export function demoCredentials(scenario: DemoScenario): CredentialStore {
  const store = createCredentialStore(memoryStorage());
  for (const token of scenario.github.tokens)
    store.set(token.id, { kind: 'github', token: token.secret }, false);
  for (const key of scenario.aws.keys)
    store.set(
      key.id,
      {
        kind: 'aws',
        accessKeyId: key.accessKeyId,
        secretAccessKey: key.secret,
      },
      false,
    );
  return store;
}

/** A visit to `scenario`'s demo; the simulator's options (seed, clock,
 * latency) as given. */
export function createDemoSession(
  scenario: DemoScenario,
  options: SimulatorOptions = {},
): DemoSession {
  const credentials = demoCredentials(scenario);
  const transport = createSimulator(scenario, options);
  const env = createQueryEnv({
    providers: (hooks) => credentialProviders(credentials, hooks, transport),
  });
  // A changed or forgotten demo secret drops what the old one read, as on
  // a real board (spec.md §3.1).
  credentials.subscribe((id, dropsData) => {
    if (dropsData) env.removeCredentials([id]);
  });
  return { credentials, transport, env };
}
