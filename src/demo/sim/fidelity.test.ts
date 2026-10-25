/**
 * Simulator fidelity (spec.md §3.14 *Request surface*): every answer the
 * shipped and measurement scenarios give parses with the readers' own
 * schemas (GitHub) and through the AWS SDK's own parser (Amplify), at
 * the opening and later, across every repo, run, compare, region and
 * app, so the demo can't drift from what the readers accept.
 */
import { describe, expect, it } from 'vitest';

import { acmeScenario } from '@/demo/scenarios/acme';
import { measureScenario } from '@/demo/scenarios/measure';
import { AMPLIFY_REGIONS } from '@/lib/amplify/regions';
import {
  BranchesResponseSchema,
  CompareSchema,
  JobsResponseSchema,
  ReposResponseSchema,
  WorkflowRunsResponseSchema,
} from '@/lib/github/schemas';
import { GITHUB_API_BASE } from '@/lib/transport';
import { simAmplifyReaderFor, simTransport } from '@/test/simDemo';

import type { DemoScenario } from './scenario';

const scenarios: [string, DemoScenario][] = [
  ['the shipped scenario', acmeScenario],
  ['the measurement scenario', measureScenario],
];

describe.each(scenarios)('%s', (_, scenario) => {
  it.each([0, 7 * 60_000])(
    'parses every GitHub answer with the readers schemas at %i ms',
    async (t) => {
      const transport = simTransport(() => t, {}, scenario);
      const token = scenario.github.tokens.find((tk) => !tk.rejected);
      const get = async (path: string) => {
        const res = await transport.fetch(`${GITHUB_API_BASE}${path}`, {
          headers: { authorization: `Bearer ${token?.secret ?? ''}` },
        });
        return { status: res.status, body: (await res.json()) as unknown };
      };
      const repos = ReposResponseSchema.parse(
        (await get('/user/repos?per_page=100&page=1')).body,
      );
      expect(repos.length).toBeGreaterThan(0);
      let parsed = 0;
      for (const repo of repos) {
        const branches = await get(
          `/repos/${repo.full_name}/branches?per_page=100&page=1`,
        );
        if (branches.status !== 200) continue; // a faulted repo
        const names = BranchesResponseSchema.parse(branches.body).map(
          (b) => b.name,
        );
        const runs = WorkflowRunsResponseSchema.parse(
          (
            await get(
              `/repos/${repo.full_name}/actions/runs?per_page=100&page=1&exclude_pull_requests=true`,
            )
          ).body,
        );
        for (const run of runs.workflow_runs.slice(0, 10)) {
          JobsResponseSchema.parse(
            (
              await get(
                `/repos/${repo.full_name}/actions/runs/${String(run.id)}/attempts/1/jobs?per_page=100&page=1`,
              )
            ).body,
          );
          parsed += 1;
        }
        for (const head of names.slice(1))
          CompareSchema.parse(
            (
              await get(
                `/repos/${repo.full_name}/compare/${names[0] ?? ''}...${head}`,
              )
            ).body,
          );
      }
      expect(parsed).toBeGreaterThan(0);
    },
  );

  it('parses every Amplify answer through the SDK in every region', async () => {
    const readerFor = simAmplifyReaderFor(
      simTransport(() => 0, {}, scenario),
      scenario,
    );
    let jobs = 0;
    for (const key of scenario.aws.keys)
      for (const region of AMPLIFY_REGIONS) {
        const reader = readerFor({ credentialId: key.id, region });
        for (const app of await reader.listApps()) {
          expect(app.createTime).toBeInstanceOf(Date);
          for (const branch of await reader.listBranches(app.appId ?? '')) {
            const list = await reader.listJobs(
              app.appId ?? '',
              branch.branchName ?? '',
              50,
            );
            for (const job of list) expect(job.startTime).toBeInstanceOf(Date);
            jobs += list.length;
          }
        }
      }
    expect(jobs).toBeGreaterThan(0);
  });
});
