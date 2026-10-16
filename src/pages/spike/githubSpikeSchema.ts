/**
 * GitHub spike form: Zod schema (source of truth for the values type),
 * defaults, and the field list the page renders, so each field's name,
 * label and validation are declared once.
 *
 * @module
 */
import { z } from 'zod';

import type { SpikeField } from './SpikePage';

export const githubSpikeFormSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
  owner: z.string().trim().min(1, 'Owner is required'),
  repo: z.string().trim().min(1, 'Repo is required'),
  branchPrefix: z.string().trim().optional(),
});

export type GithubSpikeFormValues = z.infer<typeof githubSpikeFormSchema>;

export const githubSpikeFormDefaults: GithubSpikeFormValues = {
  token: '',
  owner: '',
  repo: '',
  branchPrefix: '',
};

export const githubSpikeFields: readonly SpikeField<GithubSpikeFormValues>[] = [
  { name: 'token', label: 'Fine-grained PAT', type: 'password' },
  { name: 'owner', label: 'Repo owner', type: 'text', placeholder: 'acme' },
  { name: 'repo', label: 'Repo name', type: 'text', placeholder: 'api-core' },
  {
    name: 'branchPrefix',
    label: 'Branch prefix (optional)',
    type: 'text',
    placeholder: 'release/, or blank for main',
  },
];
