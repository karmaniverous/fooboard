/**
 * What's new (spec.md C-20, §3.10): the bundled changelog read into
 * releases, each version's X post attached, and whether this browser has
 * seen the newest one. Pure; `releases.ts` binds it to the bundle.
 *
 * The changelog is git-cliff's (`cliff.toml`): a `## [x.y.z] - date`
 * heading per release, a `### group` heading per kind of change, and a
 * `- message` line per commit. The unreleased section isn't a release.
 *
 * @module
 */

/** One kind of change in a release (*Features*, *Bug Fixes*, …). */
interface ReleaseSection {
  title: string;
  /** One line per change, as inline Markdown. */
  items: string[];
}

/** One release in the changelog, newest first. */
export interface Release {
  version: string;
  /** `YYYY-MM-DD`, when the changelog gives it. */
  date?: string;
  sections: ReleaseSection[];
  /** Its announcement on X, if there is one. */
  xPost?: string;
}

const RELEASE_HEADING = /^##\s+\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?$/;
const SECTION_HEADING = /^###\s+(.+)$/;
const ITEM = /^[-*]\s+(.+)$/;
const UNRELEASED = 'unreleased';

/** The releases in a git-cliff changelog, in its order (newest first). */
export function parseChangelog(text: string): Release[] {
  const releases: Release[] = [];
  let release: Release | undefined;
  let section: ReleaseSection | undefined;
  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      const [, version = '', date] = heading;
      release =
        version.toLowerCase() === UNRELEASED
          ? undefined
          : { version, ...(date ? { date } : {}), sections: [] };
      if (release) releases.push(release);
      section = undefined;
      continue;
    }
    if (!release) continue;
    const title = SECTION_HEADING.exec(line)?.[1];
    if (title) {
      section = { title, items: [] };
      release.sections.push(section);
      continue;
    }
    const item = ITEM.exec(line)?.[1];
    if (item && section) section.items.push(item);
  }
  return releases;
}

/** An announcement post by the product's X account. */
const X_POST = /^https:\/\/x\.com\/fooboarding\/status\/\d+$/;

/** `releases` with each one's X post from `posts` (by version), where it
 * is a post of the product's account; any other link is left out. */
export const withXPosts = (
  releases: readonly Release[],
  posts: Readonly<Partial<Record<string, string>>>,
): Release[] =>
  releases.map((r) => {
    const xPost = posts[r.version];
    return xPost !== undefined && X_POST.test(xPost) ? { ...r, xPost } : r;
  });

const SEMVER =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** A match's group `i`, undefined when it took no part. */
export const group = (m: RegExpMatchArray, i: number): string | undefined =>
  m[i];

/** Compare two prerelease identifiers by semver's rules: numbers
 * numerically and below words, words by character. */
function compareIdentifier(a: string, b: string): number {
  const numeric = /^\d+$/;
  if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b);
  if (numeric.test(a)) return -1;
  if (numeric.test(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Semver order of `a` and `b` (negative, zero or positive), or undefined
 * when either isn't a semantic version. */
export function compareVersions(a: string, b: string): number | undefined {
  const x = SEMVER.exec(a);
  const y = SEMVER.exec(b);
  if (!x || !y) return undefined;
  for (let i = 1; i <= 3; i++) {
    const d = Number(x[i]) - Number(y[i]);
    if (d !== 0) return d;
  }
  // A release is above its prereleases.
  const [pa, pb] = [group(x, 4), group(y, 4)];
  if (pa === undefined || pb === undefined)
    return pa === pb ? 0 : pa === undefined ? 1 : -1;
  const [ia, ib] = [pa.split('.'), pb.split('.')];
  for (let i = 0; i < Math.min(ia.length, ib.length); i++) {
    const d = compareIdentifier(ia[i] ?? '', ib[i] ?? '');
    if (d !== 0) return d;
  }
  return ia.length - ib.length;
}

/** Whether `newest` is a version this browser hasn't seen: there is one,
 * and nothing was seen, or what was seen is older (by semver; when either
 * isn't a semantic version, any difference counts). */
export function isUnseen(
  newest: string | undefined,
  lastSeen: string | undefined,
): boolean {
  if (newest === undefined) return false;
  if (lastSeen === undefined) return true;
  const order = compareVersions(newest, lastSeen);
  return order === undefined ? newest !== lastSeen : order > 0;
}
