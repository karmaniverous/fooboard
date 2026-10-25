/**
 * A demo visit (spec.md §3.14 *Board and edits*): the scenario's demo
 * secrets held in memory for the tab, a real board's providers over the
 * simulator, and nothing written to the device's storage; a changed demo
 * secret drops what the old one read.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { GITHUB_API_BASE } from '@/lib/transport';

import { createDemoSession, demoCredentials } from './demoSession';
import { acmeScenario } from './scenarios/acme';
import {
  ACME_DEV_AWS,
  ACME_GITHUB,
  ACME_MARKETING_AWS,
} from './scenarios/acmeBoard';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('a demo visit', () => {
  it("holds the scenario's secrets in memory, and none for a credential it lacks", () => {
    const store = demoCredentials(acmeScenario);
    expect(store.get(ACME_GITHUB)).toEqual({
      kind: 'github',
      token: 'demo-token-acme',
    });
    expect(store.get(ACME_DEV_AWS)).toMatchObject({
      kind: 'aws',
      accessKeyId: 'DEMOACMEDEVKEY01',
    });
    expect(store.get(ACME_MARKETING_AWS)).toBeUndefined();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it("reads the simulator through a real board's providers", async () => {
    const { env, transport } = createDemoSession(acmeScenario, {
      clock: () => Date.UTC(2026, 9, 25),
    });
    const api = env.providers.github(ACME_GITHUB);
    expect(api).toBeDefined();
    const page = await api?.reposPage(1);
    expect(page?.notModified).toBe(false);
    expect(transport.githubApiBase).toBe(GITHUB_API_BASE);
    expect(env.providers.amplify(ACME_DEV_AWS)).toBeDefined();
    expect(env.providers.amplify(ACME_MARKETING_AWS)).toBeUndefined();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('drops what a demo secret read once it changes', () => {
    const { env, credentials } = createDemoSession(acmeScenario);
    const key = ['github', ACME_GITHUB, 'repos'];
    env.client.setQueryData(key, ['cached']);
    expect(env.client.getQueryData(key)).toEqual(['cached']);
    // The same secret again keeps what it read; another drops it.
    credentials.set(
      ACME_GITHUB,
      { kind: 'github', token: 'demo-token-acme' },
      false,
    );
    expect(env.client.getQueryData(key)).toEqual(['cached']);
    credentials.set(ACME_GITHUB, { kind: 'github', token: 'another' }, false);
    expect(env.client.getQueryData(key)).toBeUndefined();
  });
});
