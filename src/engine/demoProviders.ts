/**
 * Engine providers for the demo board (spec.md C-23): every credential id
 * resolves to the demo GitHub or Amplify provider, sharing one clock so
 * the board progresses consistently.
 *
 * @module
 */
import { createDemoAmplifyReaderFor } from '@/demo/amplify';
import { createDemoGitHubReader } from '@/demo/github';

import type { EngineProviders } from './types';

/** Providers answering from the demo scenarios. */
export function demoProviders(clock: () => number = Date.now): EngineProviders {
  const github = createDemoGitHubReader(clock);
  const amplify = createDemoAmplifyReaderFor(clock);
  return { github: () => github, amplify: () => amplify };
}
