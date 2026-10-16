/**
 * Zod schema for the Amplify browser-spike form (spec.md §6 spike 1 / C-6).
 * Credentials are validated shape-only and never leave component state.
 *
 * @module
 */
import { z } from 'zod';

export const amplifySpikeFormSchema = z.object({
  accessKeyId: z.string().trim().min(1, 'Access key ID is required'),
  secretAccessKey: z.string().trim().min(1, 'Secret access key is required'),
  region: z.string().trim().min(1, 'Region is required'),
  appId: z.string().trim().min(1, 'App ID is required'),
  branch: z.string().trim().optional(),
});

export type AmplifySpikeFormValues = z.infer<typeof amplifySpikeFormSchema>;

export const amplifySpikeFormDefaults: AmplifySpikeFormValues = {
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-east-1',
  appId: '',
  branch: '',
};
