/**
 * Serves the committed Amplify Hosting configuration from `vite preview`
 * and the dev server (spec.md §3.10, Decision 40), and checks it at build
 * time:
 *
 * - every preview response carries the headers of `customHttp.yml`, the
 *   CSP included, so the built app is tested under the policy that ships:
 *   the `'**'` pattern's, merged with those of the one-path pattern naming
 *   the requested path, as Amplify merges them (spec 0.2.0 §3.J);
 * - a path an `amplify-rewrites.json` redirect names is answered its
 *   status with its target as the `Location`, the request's query carried
 *   over unless the target has its own, as on Amplify; a redirect from a full URL
 *   (the apex `https://fooboard.dev`) names another host, which a local
 *   server never is, so it is skipped (Decision 110); so is any rule with
 *   a country `condition`, since a local request has no country;
 * - a path `amplify-rewrites.json` rewrites is served the rule's target
 *   (the page, or a file such as `/ai.md`), as on Amplify; any other path
 *   is a file, and a missing file is a 404 (the rewrite excludes asset
 *   paths, so a missing asset is never answered with the page);
 * - the dev server runs the same middleware with two differences: the page
 *   goes without the CSP, since Vite's inline React preamble needs a script
 *   the CSP rightly refuses; and Vite itself serves the page and answers
 *   missing paths, since its own modules (`/@vite/client`, `/src/main.tsx`)
 *   are not files of a build. So `npm run dev` serves `/ai` from
 *   `public/ai.md` as markdown with every header, as on Amplify;
 * - a build fails if a rewrite (not a redirect) would hide one of its
 *   files or a file in `public/`.
 *
 * @module
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

import { headersFor, type HostingHeaders, parseCustomHttp } from './hosting.ts';
import {
  hiddenFiles,
  type HostingRules,
  parseRewrites,
  rewrite,
  SPA_ENTRY,
  unconditioned,
} from './hostingRules.ts';

/** The headers file Amplify reads from the repository root. */
export const CUSTOM_HTTP_FILE = 'customHttp.yml';

/** The app's custom rules (the rewrites), applied in the console. */
export const REWRITES_FILE = 'amplify-rewrites.json';

/** The header the dev server leaves off the page (see the module). */
export const CSP_HEADER = 'Content-Security-Policy';

/** What the middleware serves, the same on both servers: the response
 * headers (every path's, and each one-path pattern's) and the rules. */
type HostingConfig = HostingRules & { headers: HostingHeaders };

/** The middleware's options: `vite preview` serves a build, so it knows
 * which files exist; the dev server leaves the page and missing paths to
 * Vite. */
export type HostingOptions = HostingConfig &
  (
    | {
        server: 'preview';
        /** Whether a site path (`/assets/x.js`) is a file in the build. */
        exists: (sitePath: string) => boolean;
      }
    | { server: 'dev' }
  );

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

/** A redirect's `Location` for a request with query `search`: the
 * target with the request's query carried over, as Amplify carries it,
 * unless the target has a query of its own (before any fragment). */
const location = (target: string, search: string): string => {
  const hash = target.indexOf('#');
  const [base, fragment] =
    hash < 0 ? [target, ''] : [target.slice(0, hash), target.slice(hash)];
  return base.includes('?') ? target : `${base}${search}${fragment}`;
};

/** The hosting middleware: headers on every response, then a path
 * redirect, then the rewrite, then (on `vite preview`) a 404 for a path
 * that is neither redirected, rewritten nor a file. On the dev server the
 * page goes without the CSP and is left to Vite, as are missing paths (see
 * the module). */
export function hostingMiddleware(options: HostingOptions): Middleware {
  const { headers } = options;
  const redirects = unconditioned(options.redirects);
  const rewrites = unconditioned(options.rewrites);
  const dev = options.server === 'dev';
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const redirect = redirects.find(({ path }) => path === url.pathname);
    const target = rewrite(rewrites, url.pathname);
    const page = target === SPA_ENTRY;
    for (const [name, value] of Object.entries(
      headersFor(headers, url.pathname),
    ))
      if (!(dev && page && name === CSP_HEADER)) res.setHeader(name, value);
    if (redirect !== undefined) {
      res.statusCode = Number(redirect.status);
      res.setHeader('Location', location(redirect.target, url.search));
      res.end();
      return;
    }
    if (target !== url.pathname) {
      if (!(dev && target === SPA_ENTRY)) req.url = `${target}${url.search}`;
      next();
      return;
    }
    const sitePath = decodePath(url.pathname);
    if (
      options.server === 'dev' ||
      (sitePath !== undefined && options.exists(sitePath))
    ) {
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
  /** Both files, read as a server starts. */
  const config = (): HostingConfig => ({
    headers: parseCustomHttp(read(CUSTOM_HTTP_FILE)),
    ...parseRewrites(read(REWRITES_FILE)),
  });
  return {
    name: 'fooboard-hosting',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use(hostingMiddleware({ ...config(), server: 'dev' }));
    },
    configurePreviewServer(server) {
      const outDir = path.resolve(root, server.config.build.outDir);
      server.middlewares.use(
        hostingMiddleware({
          ...config(),
          server: 'preview',
          exists: (sitePath) => isFile(within(outDir, sitePath)),
        }),
      );
    },
    generateBundle(_options, bundle) {
      const hidden = hiddenFiles(parseRewrites(read(REWRITES_FILE)).rewrites, [
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
