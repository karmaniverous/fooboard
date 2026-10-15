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

**Status:** this PR scaffolds the app shell (Vite + React + TypeScript +
Tailwind v4, shadcn-style UI kit shared with
[jeeves-server](https://github.com/karmaniverous/jeeves-server)) and a
removable Amplify browser spike. The board itself — config store,
provider adapters, derivation and the grid UI — lands in follow-up PRs.

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

## Amplify browser spike

Route: `/spike/amplify` (linked nowhere in the product UI; open it
directly in the dev server or a deployed build). It is a **dev aid**,
clearly labelled in the page itself, and removable once the spike it
exists to confirm — that the AWS Amplify API accepts signed calls
directly from a browser (CORS + SigV4) — is no longer in question.

1. Run `npm run dev` and open `http://localhost:5173/spike/amplify`.
2. Enter an AWS access key ID and secret for an IAM user scoped to
   read-only Amplify permissions (`ListApps`, `ListBranches`,
   `ListJobs`, `GetJob`), a region, and an Amplify app ID. Branch is
   optional; leave it blank to use the first branch the app returns.
3. Submit. The page calls `ListBranches` → `ListJobs` (`maxResults: 5`)
   → `GetJob` on the newest job on the resolved branch, then renders the
   raw responses as JSON along with the composed AWS console deployment
   link.
4. Credentials are held only in this component's React state: never
   persisted to local storage or cookies, never logged, and never sent
   anywhere except directly to AWS by the SDK. CORS and authentication
   errors are shown verbatim so they can be diagnosed.

## License

BSD-3-Clause. See [LICENSE](./LICENSE).
