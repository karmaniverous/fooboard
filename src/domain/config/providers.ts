/**
 * The sources fooboard reads (spec.md AA§4.3.7): GitHub Actions and AWS
 * Amplify. Rules, status sets, source rules and readers are each for one
 * of them. Pure.
 *
 * @module
 */
import { z } from 'zod';

export const ProviderSchema = z.enum(['github', 'amplify']);
export type Provider = z.infer<typeof ProviderSchema>;

/** Every source, in the order the editors list them. */
export const PROVIDERS = ProviderSchema.options;

/** Each source's name in the app. */
export const PROVIDER_LABELS = {
  github: 'GitHub',
  amplify: 'Amplify',
} as const satisfies Record<Provider, string>;
