/**
 * Test access to the simulated demo (spec.md §3.14): the simulator's
 * transport over a scenario (the measurement scenario's 19 × 6 board
 * unless given) with a test clock, and the readers and providers a real
 * board builds over it, so tests read the same simulated GitHub and AWS
 * the demo does. The clock is relative: 0 is the scenario's opening,
 * placed at a fixed wall time for the test file. Delays (latency, slow
 * jobs) resolve at once unless a `wait` is given.
 *
 * @module
 */
import { demoCredentials } from '@/demo/demoSession';
import { measureScenario } from '@/demo/scenarios/measure';
import { MEASURE_AWS, MEASURE_GITHUB } from '@/demo/scenarios/measureBoard';
import type { DemoScenario } from '@/demo/sim/scenario';
import {
  createSimulator,
  type SimulatorOptions,
  type Wait,
} from '@/demo/sim/simulator';
import { credentialProviders } from '@/engine/credentialProviders';
import { createAmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import { createGitHubApi, type GitHubApi } from '@/lib/github';
import type { Transport } from '@/lib/transport';
import type { ProviderHooks } from '@/query/client';
import type { QueryProviders } from '@/query/fetchers';

/** The wall time of the scenario's opening in this test file. */
const SIM_EPOCH = Date.now();

/** Delays resolve at once. */
const noWait: Wait = () => Promise.resolve();

/** `scenario` with each alias credential id holding the secret of the
 * scenario credential it names (`{ other: MEASURE_GITHUB }`), so a test
 * can read with ids the scenario doesn't define. */
export function withAliases(
  scenario: DemoScenario,
  aliases: Record<string, string>,
): DemoScenario {
  const alias = <T extends { id: string }>(items: readonly T[]): T[] => [
    ...items,
    ...Object.entries(aliases).flatMap(([id, of]) => {
      const found = items.find((item) => item.id === of);
      return found ? [{ ...found, id }] : [];
    }),
  ];
  return {
    ...scenario,
    github: { ...scenario.github, tokens: alias(scenario.github.tokens) },
    aws: { ...scenario.aws, keys: alias(scenario.aws.keys) },
  };
}

/** The simulator over `scenario`, its clock `rel` ms from the opening. */
export const simTransport = (
  rel: () => number = () => 0,
  options: Omit<SimulatorOptions, 'clock'> = {},
  scenario: DemoScenario = measureScenario,
): Transport =>
  createSimulator(scenario, {
    wait: noWait,
    ...options,
    clock: () => SIM_EPOCH + rel(),
  });

/** A real board's providers over the scenario's credentials and `transport`. */
export const simProviders = (
  hooks: ProviderHooks,
  transport: Transport = simTransport(),
  scenario: DemoScenario = measureScenario,
): QueryProviders =>
  credentialProviders(demoCredentials(scenario), hooks, transport);

/** The GitHub client for the scenario's token `tokenId`. */
export function simGitHubApi(
  transport: Transport = simTransport(),
  tokenId = MEASURE_GITHUB,
  scenario: DemoScenario = measureScenario,
): GitHubApi {
  const token = scenario.github.tokens.find((t) => t.id === tokenId);
  if (!token) throw new Error(`no token ${tokenId}`);
  return createGitHubApi({
    token: token.secret,
    fetchImpl: transport.fetch,
    apiBase: transport.githubApiBase,
  });
}

/** Amplify readers for the scenario's AWS keys (`MEASURE_AWS` for any
 * credential id the scenario lacks). */
export const simAmplifyReaderFor =
  (
    transport: Transport = simTransport(),
    scenario: DemoScenario = measureScenario,
  ): AmplifyReaderFor =>
  ({ credentialId, region }) => {
    const key =
      scenario.aws.keys.find((k) => k.id === credentialId) ??
      scenario.aws.keys.find((k) => k.id === MEASURE_AWS);
    if (!key) throw new Error(`no key ${credentialId}`);
    return createAmplifyReader({
      region,
      accessKeyId: key.accessKeyId,
      secretAccessKey: key.secret,
      fetch: transport.fetch,
    });
  };
