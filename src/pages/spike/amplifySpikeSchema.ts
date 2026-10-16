/**
 * Amplify spike form: Zod schema (source of truth for the values type),
 * defaults, and the field list the page renders, so each field's name,
 * label and validation are declared once.
 *
 * @module
 */
import { z } from 'zod';

import type { SpikeField } from './SpikePage';

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

export const amplifySpikeFields: readonly SpikeField<AmplifySpikeFormValues>[] =
  [
    { name: 'accessKeyId', label: 'Access key ID', type: 'text' },
    { name: 'secretAccessKey', label: 'Secret access key', type: 'password' },
    { name: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
    { name: 'appId', label: 'App ID', type: 'text' },
    {
      name: 'branch',
      label: 'Branch (optional)',
      type: 'text',
      placeholder: 'leave blank to use the first branch found',
    },
  ];
