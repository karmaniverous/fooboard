/**
 * Tests for repo matching (spec.md §3.12 *Repo matching*): a GitHub URL
 * naming the row's repo matches whatever its case, `www.`, `.git` or
 * trailing `/`; another host, or another repo, never does.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { buildsRepo, repoFromUrl, sameRepo } from './repoUrl';

describe('repoFromUrl', () => {
  it.each([
    ['https://github.com/acme/web', 'acme/web'],
    ['https://github.com/acme/web.git', 'acme/web'],
    ['https://github.com/acme/web/', 'acme/web'],
    ['https://github.com/acme/web.git/', 'acme/web'],
    ['https://www.github.com/acme/web', 'acme/web'],
    ['HTTPS://GitHub.COM/Acme/Web', 'Acme/Web'],
  ])('reads %s as %s, as written', (url, repo) => {
    expect(repoFromUrl(url)).toBe(repo);
  });

  it.each([
    'https://gitlab.com/acme/web',
    'https://github.com.evil.example/acme/web',
    'https://mygithub.com/acme/web',
    'http://github.com/acme/web',
    'https://github.com/acme',
    'https://github.com/acme/web/tree/main',
    '',
    undefined,
  ])('reads no repo from %s', (url) => {
    expect(repoFromUrl(url)).toBeUndefined();
  });
});

describe('buildsRepo', () => {
  it.each([
    'https://github.com/acme/web',
    'https://github.com/ACME/Web.git',
    'https://www.github.com/acme/web/',
  ])('matches %s to acme/web', (url) => {
    expect(buildsRepo(url, 'acme/web')).toBe(true);
    expect(buildsRepo(url, 'Acme/WEB')).toBe(true);
  });

  it('never matches another repo, owner or host', () => {
    expect(buildsRepo('https://github.com/acme/web', 'acme/webs')).toBe(false);
    expect(buildsRepo('https://github.com/acme/web', 'acmes/web')).toBe(false);
    expect(buildsRepo('https://gitlab.com/acme/web', 'acme/web')).toBe(false);
    expect(buildsRepo(undefined, 'acme/web')).toBe(false);
  });

  it('compares owner/names case-insensitively', () => {
    expect(sameRepo('Acme/Web', 'acme/web')).toBe(true);
    expect(sameRepo('acme/web', 'acme/api')).toBe(false);
  });
});
