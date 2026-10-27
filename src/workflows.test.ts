/**
 * Tests the deployment configuration committed to the repo (spec.md §3.10,
 * Decisions 22, 24 and 40), each file parsed as its tool reads it:
 *
 * - CI and the prod guard both rerun when a PR is edited (retargeted to
 *   `prod`); the prod guard runs on `pull_request_target`, so its workflow
 *   comes from `prod` and the PR it checks can't replace it, with no token
 *   permissions, never checks out PR code and passes PR fields to its
 *   script only through env variables;
 * - `amplify.yml` builds with Node 22, `npm ci` and `npm run build`, and
 *   publishes `dist`;
 * - `customHttp.yml` sets the CSP and the security headers (the CSP's style
 *   hashes are checked against the injected styles in `cspStyles.test.tsx`);
 * - `amplify-rewrites.json` serves the page for the app's routes and never
 *   for an asset path.
 *
 * @module
 */
import { AmplifyClient } from '@aws-sdk/client-amplify';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

import ciRaw from '../.github/workflows/ci.yml?raw';
import prodPrRaw from '../.github/workflows/prod-pr.yml?raw';
import amplifyRaw from '../amplify.yml?raw';
import rewritesRaw from '../amplify-rewrites.json?raw';
import customHttpRaw from '../customHttp.yml?raw';
import viteConfigRaw from '../vite.config.ts?raw';
import {
  parseCustomHttp,
  parseRewrites,
  rewrite,
  SPA_ENTRY,
} from '../vite/hosting';
import { FIRST_RUN_PATH } from './firstRun/paths';
import { AMPLIFY_REGIONS } from './lib/amplify/regions';
import { cspDirectives } from './test/csp';

const Trigger = z.object({
  branches: z.array(z.string()),
  types: z.array(z.string()),
});
const Step = z.object({
  uses: z.string().optional(),
  run: z.string().optional(),
});
const Job = z.object({
  permissions: z.unknown().optional(),
  steps: z.array(Step),
  strategy: z
    .object({ matrix: z.object({ 'node-version': z.array(z.string()) }) })
    .optional(),
});
const Workflow = z.object({
  on: z.record(z.string(), Trigger.partial()),
  permissions: z.unknown().optional(),
  jobs: z.record(z.string(), Job),
});

const ci = Workflow.parse(parse(ciRaw));
const prodPr = Workflow.parse(parse(prodPrRaw));
const steps = (workflow: z.infer<typeof Workflow>) =>
  Object.values(workflow.jobs).flatMap((job) => job.steps);

describe('CI workflow', () => {
  it('runs on PRs into prod, including when one is retargeted (edited)', () => {
    expect(ci.on.pull_request.branches).toContain('prod');
    expect(ci.on.pull_request.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'edited']),
    );
  });
});

describe('prod PR guard workflow', () => {
  it('runs on pull_request_target, not pull_request', () => {
    expect(Object.keys(prodPr.on)).toEqual(['pull_request_target']);
  });

  it('checks PRs into prod, including when one is retargeted (edited)', () => {
    expect(prodPr.on.pull_request_target.branches).toEqual(['prod']);
    expect(prodPr.on.pull_request_target.types).toContain('edited');
  });

  it('has no token permissions', () => {
    expect(prodPr.permissions).toEqual({});
    for (const job of Object.values(prodPr.jobs))
      expect(job.permissions).toBeUndefined();
  });

  it('never checks out PR code', () => {
    expect(steps(prodPr).filter((step) => step.uses)).toEqual([]);
  });

  it('passes PR fields to the script only through env variables', () => {
    const runs = steps(prodPr).flatMap((step) => step.run ?? []);
    expect(runs).toHaveLength(1);
    for (const run of runs) expect(run).not.toMatch(/\$\{\{/);
  });
});

const Amplify = z.strictObject({
  version: z.literal(1),
  frontend: z.strictObject({
    phases: z.strictObject({
      preBuild: z.strictObject({ commands: z.array(z.string()) }),
      build: z.strictObject({ commands: z.array(z.string()) }),
    }),
    artifacts: z.strictObject({
      baseDirectory: z.string(),
      files: z.array(z.string()),
    }),
    cache: z.strictObject({ paths: z.array(z.string()) }),
  }),
});

describe('Amplify build spec (amplify.yml)', () => {
  const { phases, artifacts } = Amplify.parse(parse(amplifyRaw)).frontend;

  it('installs with npm ci on Node 22, a Node major CI tests', () => {
    expect(phases.preBuild.commands.slice(0, 2)).toEqual([
      'nvm install 22',
      'nvm use 22',
    ]);
    expect(phases.preBuild.commands[2]).toMatch(/^npm ci(\s|$)/);
    expect(phases.preBuild.commands).toHaveLength(3);
    expect(ci.jobs.quality.strategy?.matrix['node-version']).toContain('22');
  });

  it("builds with npm run build and publishes all of Vite's dist", () => {
    expect(phases.build.commands).toEqual(['npm run build']);
    expect(artifacts).toEqual({ baseDirectory: 'dist', files: ['**/*'] });
    expect(viteConfigRaw).toMatch(/outDir: 'dist'/);
  });
});

const headers = parseCustomHttp(customHttpRaw);
const directives = cspDirectives(headers['Content-Security-Policy']);
const csp = new Map(directives);

describe('response headers (customHttp.yml)', () => {
  it('sets the CSP and every security header, and nothing else', () => {
    expect(Object.keys(headers).sort()).toEqual([
      'Content-Security-Policy',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ]);
  });

  it.each([
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    ['X-Frame-Options', 'DENY'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
  ])('sets %s to %s', (name, value) => {
    expect(headers[name]).toBe(value);
  });

  it('denies camera, microphone and geolocation, among others', () => {
    const denied = headers['Permissions-Policy']
      .split(',')
      .map((p) => p.trim());
    expect(denied).toEqual(
      expect.arrayContaining(['camera=()', 'microphone=()', 'geolocation=()']),
    );
    for (const p of denied) expect(p).toMatch(/^[a-z-]+=\(\)$/);
  });
});

/** The origin the SDK calls for Amplify in a region. */
const amplifyOrigin = (region: string): string => {
  const { endpointProvider } = new AmplifyClient({ region }).config;
  return endpointProvider({ Region: region }).url.origin;
};

describe('Content-Security-Policy', () => {
  it('sets exactly the directives fooboard needs', () => {
    expect(directives.map(([name]) => name)).toEqual([
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'frame-ancestors',
      'base-uri',
      'form-action',
    ]);
  });

  it.each([
    ['default-src', ["'none'"]],
    ['script-src', ["'self'"]],
    ['img-src', ["'self'", 'data:']],
    ['font-src', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'none'"]],
  ])('sets %s to %j', (directive, sources) => {
    expect(csp.get(directive)).toEqual(sources);
  });

  it('allows styles only from the site and by hash, never inline or eval', () => {
    const [self, ...hashes] = csp.get('style-src') ?? [];
    expect(self).toBe("'self'");
    for (const h of hashes) expect(h).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
    expect(headers['Content-Security-Policy']).not.toMatch(/unsafe|\*/);
  });

  it("connects only to GitHub's API and the SDK's endpoint in each Amplify region", () => {
    const amplify = AMPLIFY_REGIONS.map(amplifyOrigin);
    expect(csp.get('connect-src')).toEqual([
      'https://api.github.com',
      ...amplify,
    ]);
  });
});

describe('SPA rewrite (amplify-rewrites.json)', () => {
  const rules = parseRewrites(rewritesRaw);

  it.each([
    '/',
    '/demo',
    FIRST_RUN_PATH,
    `${FIRST_RUN_PATH}/a1b2/repos`,
    '/d/northwind',
    '/d/v1.2',
  ])('serves the page for the route %s', (path) => {
    expect(rewrite(rules, path)).toBe(SPA_ENTRY);
  });

  it.each([
    '/assets/index-C8J63TUT.js',
    '/assets/index-DEixzA0u.css',
    '/assets/index-C8J63TUT.js.map',
    '/favicon.svg',
    '/favicon-32.png',
    '/apple-touch-icon.png',
    '/assets/font.woff2',
  ])('serves the file itself for the asset path %s', (path) => {
    expect(rewrite(rules, path)).toBe(path);
  });
});
