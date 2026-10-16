/**
 * Amplify browser spike page (spec.md §6 spike 1): a dev aid, not a product
 * page. Collects credentials and a target, runs `runAmplifySpike` through
 * the SDK-backed reader, and shows the result or the error verbatim.
 *
 * Credentials live only in this component's state: never persisted, never
 * logged, and sent only to AWS. Removable once the spike is done.
 *
 * @module
 */
import { type SubmitEvent, useState } from 'react';

import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createAmplifyReader } from '@/lib/amplify/reader';
import { describeError } from '@/lib/errors';

import {
  amplifySpikeFields,
  amplifySpikeFormDefaults,
  amplifySpikeFormSchema,
  type AmplifySpikeFormValues,
} from './amplifySpikeSchema';
import { type AmplifySpikeResult, runAmplifySpike } from './runAmplifySpike';

export function AmplifySpikePage(): React.JSX.Element {
  const [values, setValues] = useState<AmplifySpikeFormValues>(
    amplifySpikeFormDefaults,
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AmplifySpikeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: SubmitEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const parsed = amplifySpikeFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setLoading(true);
    runAmplifySpike(createAmplifyReader(parsed.data), parsed.data)
      .then(setResult)
      .catch((err: unknown) => {
        setError(describeError(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 rounded-md border border-badge-behind bg-badge-behind/10 px-4 py-3 text-sm">
        <strong>Dev spike:</strong> calls AWS Amplify directly from this page.
        Credentials stay in memory only for this session; they are never saved,
        logged, or sent anywhere but AWS.
      </div>

      <h1 className="mb-4 text-lg font-semibold">Amplify browser spike</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {amplifySpikeFields.map(({ name, label, type, placeholder }) => (
          <label key={name} className="flex flex-col gap-1 text-sm">
            {label}
            <Input
              type={type}
              autoComplete="off"
              placeholder={placeholder}
              value={values[name] ?? ''}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, [name]: e.target.value }));
              }}
            />
          </label>
        ))}

        <Button type="submit" disabled={loading} className="mt-2 self-start">
          {loading ? 'Calling Amplify…' : 'Run spike'}
        </Button>
      </form>

      {error && (
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-status-failure bg-status-failure/10 p-3 text-xs text-status-failure">
          {error}
        </pre>
      )}

      {result && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm">
            Console link:{' '}
            <ExternalLink href={result.consoleLink}>
              {result.consoleLink}
            </ExternalLink>
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
