// @vitest-environment node
/**
 * Tests that a release runs the Playwright suite on a server of its own
 * (spec 0.2.0 §3.F; Decisions 88 and 99): release-it's `after:init` ends
 * with `npm run e2e:release`, after the build; `e2e:release` runs the same
 * tests as `e2e`; and `playwright.config.ts`, loaded as npm runs it under
 * that script, never reuses a preview server already on its port, while
 * under `e2e` outside CI it still does.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import packageJsonRaw from '../package.json?raw';

/** The Playwright config, a Node module outside the app's program (it
 * reads `process.env`), so it is loaded by path and parsed, not typed. */
const PLAYWRIGHT_CONFIG = '../playwright.config.ts';

const PlaywrightConfigModule = z.object({
  RELEASE_E2E_SCRIPT: z.string(),
  default: z.object({
    webServer: z.object({ reuseExistingServer: z.boolean() }),
  }),
});

const packageJson = z
  .object({
    scripts: z.record(z.string(), z.string()),
    'release-it': z.object({
      hooks: z.object({ 'after:init': z.array(z.string()) }),
    }),
  })
  .parse(JSON.parse(packageJsonRaw));

/** The config module, loaded afresh with the environment `env` sets. */
async function loadConfig(
  env: Record<string, string> = {},
): Promise<z.infer<typeof PlaywrightConfigModule>> {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return PlaywrightConfigModule.parse(
    await import(/* @vite-ignore */ PLAYWRIGHT_CONFIG),
  );
}

/** The release script's name, as `playwright.config.ts` exports it. */
const releaseScript = async (): Promise<string> =>
  (await loadConfig()).RELEASE_E2E_SCRIPT;

/** `reuseExistingServer` of the config loaded under `script`, outside CI. */
const reusesServerUnder = async (script: string): Promise<boolean> =>
  (await loadConfig({ CI: '', npm_lifecycle_event: script })).default.webServer
    .reuseExistingServer;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the release hooks', () => {
  it('run the e2e suite last, after the build', async () => {
    const hooks = packageJson['release-it'].hooks['after:init'];
    expect(hooks.slice(-2)).toEqual([
      'npm run build',
      `npm run ${await releaseScript()}`,
    ]);
  });

  it('run the same Playwright tests as e2e', async () => {
    expect(packageJson.scripts[await releaseScript()]).toBe('playwright test');
    expect(packageJson.scripts.e2e).toBe('playwright test');
  });
});

describe('the Playwright web server', () => {
  it('is never reused under the release script', async () => {
    expect(await reusesServerUnder(await releaseScript())).toBe(false);
  });

  it('is reused under e2e outside CI', async () => {
    expect(await reusesServerUnder('e2e')).toBe(true);
  });
});
