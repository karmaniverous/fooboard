# fooboard

> `fooboard.dev` &middot; open source (BSD-3-Clause) &middot; X: [@fooboarding](https://x.com/fooboarding)

fooboard is a free, open-source, client-only browser app that shows the
deployment state of every repo × stage at a glance. Setup takes minutes:
paste a GitHub token, pick repos and a branch preset, and the board fills
itself in from GitHub Actions runs (and, optionally, AWS Amplify jobs) —
no workflow changes required. Nothing leaves the browser except the calls
it makes directly to GitHub and AWS; the host serves static files only.
See [spec.md](https://github.com/karmaniverous/fooboard) (tracked
separately) for the full product spec.

**Status:** the app shell is scaffolded (Vite + React + TypeScript +
Tailwind v4, shadcn-style UI kit shared with
[jeeves-server](https://github.com/karmaniverous/jeeves-server)) with
removable Amplify and GitHub browser spikes, and the domain core has landed: the
config schema, branch presets, matching primitives and cell-derivation
rules under `src/domain/` (pure TypeScript, no React, network or
storage; see `spec.md` §8 PR A). PR B (in progress) adds the live GitHub and Amplify providers, demo
data and the board engine; the grid UI follows.

## Dev commands

```bash
npm install            # install dependencies
npx lefthook install   # install Git hooks (once, after cloning)

npm run dev             # start the Vite dev server
npm run build            # type-check (tsc -b) and build the static site to dist/
npm run preview          # preview the production build locally
npm run lint              # ESLint (+ Prettier)
npm run lint:fix          # ESLint --fix
npm run typecheck          # tsc -b --noEmit
npm test                    # Vitest (jsdom, coverage reported)
npm run knip                  # find unused files/deps/exports
```

## Browser spikes

Two dev pages confirm that fooboard's providers work directly from a browser: `/spike/amplify` and `/spike/github`. Nothing in the product UI links to them, so open them directly in the dev server or a deployed build. Each is labelled as a dev aid on the page itself, and both are removed before release.

On both pages, credentials are held only in the page's React state. They are never saved to local storage or cookies, never logged, and sent only to the service being called. Errors (CORS, authentication, rate limits) are shown verbatim.

### Amplify (`/spike/amplify`)

1. Run `npm run dev` and open `http://localhost:5173/spike/amplify`.
2. Enter an AWS access key ID and secret for an IAM user with read-only Amplify permissions (`ListApps`, `ListBranches`, `ListJobs`, `GetJob`). Then enter a region and an Amplify app ID. Branch is optional; leave it blank to use the first branch the app returns.
3. Submit. The page calls `ListBranches`, then `ListJobs` (5 jobs), then `GetJob` on the newest job. It shows the raw responses and the AWS console link to that deployment.

### GitHub (`/spike/github`)

1. Run `npm run dev` and open `http://localhost:5173/spike/github`.
2. Enter a fine-grained personal access token with read-only access (Metadata, Contents, Actions) to the repo you want to test, plus the repo owner and name. Branch prefix is optional; it defaults to `main`.
3. Submit. The page lists workflow runs (pull-request runs excluded), the newest run's jobs, branches matching the prefix, and a compare between `main` and the first matching branch.
4. It then repeats the runs request and reports whether GitHub honoured the ETag. A `304 Not Modified` leaves the rate-limit budget unchanged, which is what keeps polling cheap.

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
