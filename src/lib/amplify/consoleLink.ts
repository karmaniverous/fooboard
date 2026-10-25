/**
 * Pure builder for the AWS Amplify console deployment link (spec.md §6
 * spike 1 / §7 open question 1): the console keys a deployment by app,
 * branch and job id, as Amplify's API does; the branch segment must be
 * URL-encoded because branch names such as `preview/bali` contain `/`.
 *
 * @module
 */

/** Inputs required to compose an Amplify console deployment link. */
export interface AmplifyConsoleLinkInput {
  /** AWS region the Amplify app lives in, e.g. `us-east-1`. */
  region: string;
  /** Amplify app id, e.g. `d1a2b3c4d5e6f7`. */
  appId: string;
  /** Amplify branch name, may contain slashes (e.g. `preview/bali`). */
  branch: string;
  /** Amplify job id for the deployment. */
  jobId: string;
}

/**
 * Build the AWS console URL for a specific Amplify deployment job.
 *
 * Format (confirmed by spec.md §6 spike 1):
 * `https://{region}.console.aws.amazon.com/amplify/apps/{appId}/branches/{encodeURIComponent(branch)}/deployments/{jobId}`
 */
export function buildAmplifyConsoleLink({
  region,
  appId,
  branch,
  jobId,
}: AmplifyConsoleLinkInput): string {
  const encodedBranch = encodeURIComponent(branch);
  return `https://${region}.console.aws.amazon.com/amplify/apps/${appId}/branches/${encodedBranch}/deployments/${jobId}`;
}
