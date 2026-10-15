/**
 * Amplify browser spike (spec.md §6 spike 1 / §7 open question 1): a dev
 * aid, not a product page. Confirms the AWS Amplify API can be called
 * directly from the browser (CORS + SigV4) by chaining
 * `ListBranches` \-&gt; `ListJobs` (maxResults 5) \-&gt; `GetJob` on the newest
 * job, then composing the AWS console deployment link.
 *
 * Credentials entered here live only in this component's state: never
 * persisted (no local storage / cookies), never logged, and sent only to
 * AWS via the SDK. This page is removable once the spike is confirmed.
 *
 * @module
 */
import {
  AmplifyClient,
  GetJobCommand,
  type JobSummary,
  ListBranchesCommand,
  ListJobsCommand,
} from '@aws-sdk/client-amplify';
import { type SubmitEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildAmplifyConsoleLink } from '@/lib/amplifyConsoleLink';

import {
  amplifySpikeFormDefaults,
  amplifySpikeFormSchema,
  type AmplifySpikeFormValues,
} from './amplifySpikeSchema';

interface SpikeResult {
  branches: unknown;
  jobs: unknown;
  job: unknown;
  consoleLink: string | null;
}

/** Narrow an unknown thrown value to a displayable error message. */
function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function newestJob(summaries: JobSummary[]): JobSummary | undefined {
  return [...summaries].sort((a, b) => {
    const at = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bt - at;
  })[0];
}

export function AmplifySpikePage(): React.JSX.Element {
  const [values, setValues] = useState<AmplifySpikeFormValues>(
    amplifySpikeFormDefaults,
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<SpikeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setField =
    (field: keyof AmplifySpikeFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const onSubmit = (e: SubmitEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setFieldError(null);
    setError(null);
    setResult(null);

    const parsed = amplifySpikeFormSchema.safeParse(values);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setLoading(true);
    void runSpike(parsed.data)
      .then(setResult)
      .catch((err: unknown) => {
        setError(describeError(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const runSpike = async (
    form: AmplifySpikeFormValues,
  ): Promise<SpikeResult> => {
    const client = new AmplifyClient({
      region: form.region,
      credentials: {
        accessKeyId: form.accessKeyId,
        secretAccessKey: form.secretAccessKey,
      },
    });

    const branchesResponse = await client.send(
      new ListBranchesCommand({ appId: form.appId }),
    );
    const branches = branchesResponse.branches ?? [];
    const targetBranch =
      form.branch && form.branch.length > 0
        ? form.branch
        : branches[0]?.branchName;
    if (!targetBranch) {
      throw new Error('No branch found on this app, and none was given.');
    }

    const jobsResponse = await client.send(
      new ListJobsCommand({
        appId: form.appId,
        branchName: targetBranch,
        maxResults: 5,
      }),
    );
    const jobSummaries = jobsResponse.jobSummaries ?? [];
    const latest = newestJob(jobSummaries);
    if (!latest?.jobId) {
      throw new Error(`No jobs found on branch "${targetBranch}".`);
    }

    const jobResponse = await client.send(
      new GetJobCommand({
        appId: form.appId,
        branchName: targetBranch,
        jobId: latest.jobId,
      }),
    );

    return {
      branches: branchesResponse.branches,
      jobs: jobsResponse.jobSummaries,
      job: jobResponse.job,
      consoleLink: buildAmplifyConsoleLink({
        region: form.region,
        appId: form.appId,
        branch: targetBranch,
        jobId: latest.jobId,
      }),
    };
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 rounded-md border border-badge-behind bg-badge-behind/10 px-4 py-3 text-sm">
        <strong>Dev spike:</strong> calls AWS Amplify directly from this page.
        Credentials stay in memory only for this session; they are never saved,
        logged, or sent anywhere but AWS. Remove this route once the spike is
        confirmed.
      </div>

      <h1 className="mb-4 text-lg font-semibold">Amplify browser spike</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Access key ID
          <Input
            type="text"
            autoComplete="off"
            value={values.accessKeyId}
            onChange={setField('accessKeyId')}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Secret access key
          <Input
            type="password"
            autoComplete="off"
            value={values.secretAccessKey}
            onChange={setField('secretAccessKey')}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Region
          <Input
            type="text"
            placeholder="us-east-1"
            value={values.region}
            onChange={setField('region')}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          App ID
          <Input
            type="text"
            value={values.appId}
            onChange={setField('appId')}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Branch (optional)
          <Input
            type="text"
            placeholder="leave blank to use the first branch found"
            value={values.branch ?? ''}
            onChange={setField('branch')}
          />
        </label>

        {fieldError && (
          <span className="text-xs text-destructive">{fieldError}</span>
        )}

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
          {result.consoleLink && (
            <p className="text-sm">
              Console link:{' '}
              <a
                href={result.consoleLink}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {result.consoleLink}
              </a>
            </p>
          )}
          <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
