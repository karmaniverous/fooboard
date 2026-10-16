/**
 * GitHub browser spike page (spec.md §6 spike 2): a dev aid, not a product
 * page. Supplies the shared `SpikePage` with the GitHub form and call chain,
 * and states above the raw result whether GitHub honoured the ETag (a `304`
 * leaves the rate-limit budget unchanged). Removable once the spikes are
 * done.
 *
 * @module
 */
import { createGitHubReader } from '@/lib/github/reader';

import {
  githubSpikeFields,
  githubSpikeFormDefaults,
  githubSpikeFormSchema,
} from './githubSpikeSchema';
import { runGithubSpike } from './runGithubSpike';
import { SpikePage } from './SpikePage';

const verdict = (honoured: boolean | undefined): string => {
  if (honoured === undefined) return 'unknown (no rate-limit headers seen)';
  return honoured
    ? 'yes: the repeat came back 304 and used no budget'
    : 'no: the repeat used budget';
};

export function GithubSpikePage(): React.JSX.Element {
  return (
    <SpikePage
      title="GitHub browser spike"
      service="GitHub"
      fields={githubSpikeFields}
      schema={githubSpikeFormSchema}
      defaults={githubSpikeFormDefaults}
      run={(values) =>
        runGithubSpike(createGitHubReader({ token: values.token }), values)
      }
      renderResult={(result) => (
        <p className="text-sm">
          ETag honoured: {verdict(result.notModifiedHonoured)}
        </p>
      )}
    />
  );
}
