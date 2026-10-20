# Contributing to fooboard

Thanks for helping. These are the standing rules for everyone who changes this repo, human or coding agent. What to build, and in what order, is in the product spec's development plan; this file is _how_ to work.

## Setup

```bash
npm install            # install dependencies
npx lefthook install   # install Git hooks (once, after cloning)
```

## Commands

```bash
npm run dev          # start the Vite dev server
npm run build        # type-check (tsc -b) and build the static site to dist/
npm run preview      # preview the production build locally
npm run lint         # ESLint (+ Prettier)
npm run lint:fix     # ESLint --fix
npm run typecheck    # tsc -b --noEmit
npm test             # Vitest (jsdom, coverage reported)
npm run knip         # find unused files, dependencies and exports
```

## Workflow

- **One PR at a time.** Each PR ships a meaningful block of features. Never work on two PRs in parallel; start the next from an up-to-date `main` after the previous one is merged.
- **Branches** are named `feature/<slug>` (lefthook enforces the prefix).
- **Commit and push** after every green commit. Before every push, check the branch's PR state with `gh pr list --head <branch> --state all --json number,state` (without `--state all`, merged and closed PRs are hidden and the branch looks PR-free). Look at the **newest** PR on the branch: if it is merged or closed, stop. A merged branch takes new work only through a new PR opened from it, by agreement; once that follow-up PR is open, pushing to it is fine.
- **Open the PR as a draft early** so progress is visible; mark it ready only after the pre-review checks below.
- **Only the maintainer merges, deploys and releases.** Don't edit `CHANGELOG.md` by hand; it is generated at release.

## Quality gate (every commit)

All of these pass with **zero errors and zero warnings**:

```bash
npm run lint
npm run typecheck
npm test
npm run knip
npm run build
```

- `eslint-disable`, `@ts-ignore` and `@ts-expect-error` are forbidden. Fix the code. If a rule seems wrong, raise it in the PR instead of suppressing it.
- Don't loosen lint, TypeScript or knip configuration to make a check pass.

## Before review (every PR)

These checks **start from the code the PR touched**. That is the point of departure, not a hard boundary: follow breadcrumbs from it (callers, callees, duplicated logic elsewhere) wherever SOLID/DRY leads, but don't re-review the whole code base.

1. **Dependencies**: run `npx npm-check-updates --peer`. Use current versions; never add an outdated major. Report anything held back, and why, in the PR body.
2. **SOLID/DRY pass** over the touched code: single responsibility per module, callers depend on ports (interfaces) rather than on SDKs or `fetch`, and no duplicated logic, markup or configuration.
3. **Docs sync**: the [README](./README.md) (the user guide and credential guide), this file, [PRIVACY](./PRIVACY.md) and [TERMS](./TERMS.md) match the touched code **exactly**: commands, options, behaviour, examples and screenshots. In-app links into the README use its heading anchors (`readmeSection` in `src/lib/site.ts`); renaming a linked heading breaks them.
4. **Test coverage, to the standard of _adequate_**:
   - cover meaningful behaviour: decision branches, edge cases and error paths;
   - **remove trivial tests**: tests that restate the implementation, assert constants or framework behaviour, or exist only to raise a percentage;
   - coverage is reported, never gated by a threshold;
   - note anything deliberately left uncovered in the PR body, with the reason.

## Code conventions

- **TypeScript, strict.** No `any`; use `unknown` and narrow. No narrowing type assertions (`as X`, `as unknown as X`): parse, guard or build a complete value instead (ESLint `no-unsafe-type-assertion`). Test fakes too: `src/test/fakeReaders.ts` and `src/lib/amplify/sdkShapes.ts` build typed readers and SDK shapes.
- **Zod schemas are the source of truth** for data shapes; derive types with `z.infer`.
- **Don't reinvent the wheel: use [`radash`](https://radash-docs.vercel.app)** for general-purpose utilities (grouping, sorting, picking max/min, uniqueness, deep cloning, retries, debouncing and the like) instead of hand-rolled helpers. Write a local helper only when radash has nothing suitable, and say why in a comment.
- **Ports and adapters**: pure domain logic in `src/domain`; providers behind interfaces; React components render and hold UI state only.
- **Files stay under 300 lines** (ESLint `max-lines`). Split by responsibility before that.
- **Every non-test module starts with a TSDoc `@module` comment** saying what it is for.
- **Tests sit next to the code** (`*.test.ts(x)`). Use fakes for ports. Provider fixtures are recorded from real API responses, then trimmed and anonymised to `acme/*`.
- **UI** follows the jeeves-server kit: Tailwind v4 tokens and shadcn-style components in `src/components/ui`, outbound links through `ExternalLink`.
- **Use library controls.** Build UI from the component library (shadcn-style components over Radix primitives in `src/components/ui`; add the library's component when one is missing) rather than hand-rolling a tooltip, dialog, sheet, tabs, toggle group, checkbox, collapsible or similar. Hand-roll only with a compelling reason the library can't meet, and say why in a comment. (Deliberate exception: `ConfirmButton`'s inline confirm.) ESLint rejects a native `<select>`, `<details>`/`<summary>` or checkbox `<input>` outside the wrappers in `src/components`: use `Choice`, `Disclosure` (or `Collapsible`) and `CheckField`.
- **Windows-friendly scripts**: write repo scripts in TypeScript, not shell.

## Security

fooboard is static and browser-only; credentials never leave the user's browser except to call GitHub or AWS directly.

- Never commit, log or print credentials, and never put them in error messages, fixtures or screenshots.
- Credentials are stored only where the user chooses: session memory, or local storage under _Remember on this device_.
- No third-party or inline scripts, cookies or telemetry.

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
