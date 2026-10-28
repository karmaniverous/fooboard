/**
 * The releases What's new shows (spec.md C-20): the changelog bundled
 * with this build (`CHANGELOG.md`, which the release regenerates before it
 * builds, so its newest release is this build's), each with its X post
 * from `X_POSTS`.
 *
 * @module
 */
import changelog from '../../CHANGELOG.md?raw';
import { parseChangelog, type Release, withXPosts } from './changelog';

/**
 * Each release's announcement on X, by version: a post of `@fooboarding`
 * (`https://x.com/fooboarding/status/<id>`; any other link is ignored).
 * A post goes out after its release, so its link is added here then and
 * ships with the next build.
 */
const X_POSTS: Readonly<Record<string, string>> = {};

/** This build's releases, newest first. */
export const RELEASES: readonly Release[] = withXPosts(
  parseChangelog(changelog),
  X_POSTS,
);
