/**
 * Amplify browser spike page (spec.md §6 spike 1): a dev aid, not a product
 * page. Supplies the shared `SpikePage` with the Amplify form and call
 * chain, and shows the composed console link above the raw result.
 * Removable once the spikes are done.
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import { createAmplifyReader } from '@/lib/amplify/reader';

import {
  amplifySpikeFields,
  amplifySpikeFormDefaults,
  amplifySpikeFormSchema,
} from './amplifySpikeSchema';
import { runAmplifySpike } from './runAmplifySpike';
import { SpikePage } from './SpikePage';

export function AmplifySpikePage(): React.JSX.Element {
  return (
    <SpikePage
      title="Amplify browser spike"
      service="AWS Amplify"
      fields={amplifySpikeFields}
      schema={amplifySpikeFormSchema}
      defaults={amplifySpikeFormDefaults}
      run={(values) => runAmplifySpike(createAmplifyReader(values), values)}
      renderResult={(result) => (
        <p className="text-sm">
          Console link:{' '}
          <ExternalLink href={result.consoleLink}>
            {result.consoleLink}
          </ExternalLink>
        </p>
      )}
    />
  );
}
