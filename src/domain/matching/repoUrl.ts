/**
 * An Amplify app's repository URL against a row's GitHub repo (spec.md
 * §3.12 *Repo matching*): an app builds `owner/name` when its
 * `repository` is a GitHub URL naming it, `https://github.com/owner/name`
 * with an optional `www.`, an optional `.git` and an optional trailing
 * `/`, compared case-insensitively (GitHub's names are). Other hosts never
 * match. The app picker reads repos with the same function. Pure.
 *
 * @module
 */

/** A GitHub repository URL: the host case-insensitive, `www.` optional. */
const GITHUB_REPO_URL =
  /^https:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i;

/** `owner/name` from an Amplify app's repository URL, as written there,
 * if it is a GitHub URL. */
export function repoFromUrl(url: string | undefined): string | undefined {
  const match = GITHUB_REPO_URL.exec(url ?? '');
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** Do two `owner/name`s name the same GitHub repo? */
export const sameRepo = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/** Does the app at `url` build `repo` (`owner/name`)? */
export function buildsRepo(url: string | undefined, repo: string): boolean {
  const found = repoFromUrl(url);
  return found !== undefined && sameRepo(found, repo);
}
