/**
 * Serves the committed Amplify Hosting configuration from `vite preview`
 * (spec.md §3.10, Decision 40), and checks it at build time:
 *
 * - every preview response carries the headers of `customHttp.yml`, the
 *   CSP included, so the built app is tested under the policy that ships;
 * - a path `amplify-rewrites.json` rewrites is served the page, as on
 *   Amplify; any other path is a file, and a missing file is a 404 (the
 *   rewrite excludes asset paths, so a missing asset is never answered with
 *   the page);
 * - a build fails if the rewrite would hide one of its files or a file in
 *   `public/`.
 *
 * The development server is left alone: Vite's inline module preamble
 * needs scripts the CSP rightly refuses.
 *
 * @module
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

import {
  hiddenFiles,
  parseCustomHttp,
  parseRewrites,
  type Rewrite,
  rewrite,
} from './hosting.ts';

/** The headers file Amplify reads from the repository root. */
export const CUSTOM_HTTP_FILE = 'customHttp.yml';

/** The app's custom rules (the SPA rewrite), applied in the console. */
export const REWRITES_FILE = 'amplify-rewrites.json';

/** What the preview middleware serves. */
export interface HostingOptions {
  /** Response headers, by name. */
  headers: Readonly<Record<string, string>>;
  /** The rewrites, in order. */
  rules: readonly Rewrite[];
  /** Whether a site path (`/assets/x.js`) is a file in the build. */
  exists: (sitePath: string) => boolean;
}

/** The parts of a Node request the middleware reads and rewrites. */
interface Request {
  url?: string;
}

/** The parts of a Node response the middleware writes. */
interface Response {
  statusCode: number;
  setHeader: (name: string, value: string) => unknown;
  end: () => unknown;
}

/** A connect middleware over {@link Request} and {@link Response}. */
type Middleware = (req: Request, res: Response, next: () => void) => void;

/** A URL path decoded, or undefined if it has a malformed escape (which
 * no file can match, so it is a 404 as on Amplify, not a 500). */
const decodePath = (pathname: string): string | undefined => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
};

/** The preview middleware: headers on every response, then the rewrite,
 * then a 404 for a path that is neither rewritten nor a file. */
export function hostingMiddleware({
  headers,
  rules,
  exists,
}: HostingOptions): Middleware {
  return (req, res, next) => {
    for (const [name, value] of Object.entries(headers))
      res.setHeader(name, value);
    const url = new URL(req.url ?? '/', 'http://preview');
    const target = rewrite(rules, url.pathname);
    if (target !== url.pathname) {
      req.url = `${target}${url.search}`;
      next();
      return;
    }
    const sitePath = decodePath(url.pathname);
    if (sitePath !== undefined && exists(sitePath)) {
      next();
      return;
    }
    res.statusCode = 404;
    res.end();
  };
}

/** Whether `file` is given and is a regular file. */
const isFile = (file: string | undefined): boolean =>
  file !== undefined &&
  statSync(file, { throwIfNoEntry: false })?.isFile() === true;

/** `sitePath` as a file under `dir`, or undefined if it would escape
 * `dir` (`/..%2f..` decodes to a parent path). */
export const within = (dir: string, sitePath: string): string | undefined => {
  const file = path.resolve(dir, `.${sitePath}`);
  return file.startsWith(`${path.resolve(dir)}${path.sep}`) ? file : undefined;
};

/** Every file under `dir` as a site path (`/favicon.svg`); none if `dir`
 * is empty (no public directory) or missing. */
export const sitePaths = (dir: string): string[] =>
  dir === '' || !statSync(dir, { throwIfNoEntry: false })?.isDirectory()
    ? []
    : readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map(
          (entry) =>
            `/${path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')}`,
        );

/** The Vite plugin; reads both files from the project root. */
export function hosting(): Plugin {
  let root = process.cwd();
  let publicDir = '';
  const read = (file: string): string =>
    readFileSync(path.join(root, file), 'utf8');
  return {
    name: 'fooboard-hosting',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    configurePreviewServer(server) {
      const outDir = path.resolve(root, server.config.build.outDir);
      server.middlewares.use(
        hostingMiddleware({
          headers: parseCustomHttp(read(CUSTOM_HTTP_FILE)),
          rules: parseRewrites(read(REWRITES_FILE)),
          exists: (sitePath) => isFile(within(outDir, sitePath)),
        }),
      );
    },
    generateBundle(_options, bundle) {
      const hidden = hiddenFiles(parseRewrites(read(REWRITES_FILE)), [
        ...Object.keys(bundle).map((file) => `/${file}`),
        ...sitePaths(publicDir),
      ]);
      if (hidden.length > 0)
        this.error(
          `${REWRITES_FILE} would serve the page for ${hidden.join(', ')}`,
        );
    },
  };
}
