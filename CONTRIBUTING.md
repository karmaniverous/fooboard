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
npm run preview      # the production build, with the hosted headers and CSP
npm run lint         # ESLint (+ Prettier), then lint:md
npm run lint:fix     # ESLint --fix, then Prettier --write on Markdown
npm run lint:md      # Prettier --check on Markdown (not CHANGELOG.md)
npm run typecheck    # tsc -b --noEmit
npm test             # Vitest (jsdom, coverage reported)
npm run e2e          # Playwright smoke tests on the build (run npm run build first)
npm run e2e:release  # the same, as the release runs them: never on a server already running
npm run knip         # find unused files, dependencies and exports
```

The Playwright tests (`e2e/`) run against `vite preview` serving `dist/` with `customHttp.yml`'s headers, so under the CSP that ships. A guard on every page fails a test on any CSP violation and on any request to a host but the app's own. They cover the demo board, every dialog, sheet, popover and drag, Release notes, the error screen, the served headers, touch scrolling on a phone (390 × 844 with touch, in Chromium and WebKit; Firefox has no mobile emulation) and the automated accessibility checks (axe, WCAG 2.1 A and AA, light and dark; Tab order; reduced motion). CI runs them in Chromium; install it once with `npx playwright install chromium`. A release runs them too (`npm run e2e:release`, last in release-it's hooks, on a preview server of its own), so Chromium must also be installed on the releasing machine. No Playwright timeout (a `timeout:` option or `test.setTimeout`) is shorter than `MIN_TEST_TIMEOUT_MS` (30 s, `src/test/timeouts.ts`): build longer ones from it, and wait for a state (an attribute such as `data-in-progress`) rather than pausing a fixed time; `src/e2eTimeouts.test.ts` fails on a shorter one.

**Browser pass** (before a release): `FOOBOARD_E2E_BROWSERS=all npm run e2e` runs them in Playwright's Chromium, the installed Chrome and Edge, Firefox and WebKit (`npx playwright install chromium firefox webkit`). WebKit stands in for Safari; real Safari on macOS and iOS is checked by hand (the spec's Verification Checklist lists the steps).

## Workflow

- **One PR at a time.** Each PR ships a meaningful block of features. Never work on two PRs in parallel; start the next from an up-to-date `main` after the previous one is merged.
- **Branches** are named `feature/<slug>` (lefthook enforces the prefix; the hook lists the other prefixes). `preview/release` and `prod` are long-running deploy branches: don't commit to them.
- **Commit and push** after every green commit. Before every push, check the branch's PR state with `gh pr list --head <branch> --state all --json number,state` (without `--state all`, merged and closed PRs are hidden and the branch looks PR-free). Look at the **newest** PR on the branch: if it is merged or closed, stop. A merged branch takes new work only through a new PR opened from it, by agreement; once that follow-up PR is open, pushing to it is fine.
- **Open the PR as a draft early** so progress is visible; mark it ready only after the pre-review checks below.
- **Only the maintainer merges, deploys and releases** (see the README, [Releasing and deployment](./README.md#releasing-and-deployment)). Don't edit `CHANGELOG.md` by hand; it is generated at release.

## The hosted sites

Amplify Hosting serves three sites, one per long-running branch:

| Site                                            | Branch                                | User name | Password   |
| ----------------------------------------------- | ------------------------------------- | --------- | ---------- |
| dev.fooboard.dev                                | `main`, deployed on every merge       | `dev`     | `fooboard` |
| release.fooboard.dev                            | `preview/release`, the latest release | `release` | `fooboard` |
| www.fooboard.dev (fooboard.dev redirects there) | `prod`, production                    | none      | none       |

The password isn't a secret: it guards against opening the wrong version by accident, not against access. Production is public: its password came off once the first release was deployed to `prod`.

## Quality gate (every commit)

All of these pass with **zero errors and zero warnings**:

```bash
npm run lint
npm run typecheck
npm test
npm run knip
npm run build
npm run e2e
```

- **Lint rules cover tests.** Every rule applies to tests and test utilities (`*.test.ts(x)`, `src/test/**`) exactly as to app code; tests only gain rules (Vitest's recommended set).
- `@ts-ignore` and `@ts-expect-error` are forbidden, and so is `eslint-disable`, with one exception: a single test may disable one rule, on the one line that needs it (`// eslint-disable-next-line <rule> -- <reason>`), only when the test intrinsically requires code that breaks the rule. The reason in the comment must be compelling and say why; list each such disable in the PR body. Otherwise fix the code, and if a rule seems wrong, raise it in the PR instead of suppressing it.
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
- **No magic values.** Every number, interval, limit and default is a named constant with a doc comment saying what it is and why it has that value (e.g. `IDLE_INTERVAL_MS`, `GITHUB_PER_PAGE`). Inline literals are fine only where the meaning is self-evident (`0`, `1`, an index, a CSS class).
- **Zod schemas are the source of truth** for data shapes; derive types with `z.infer`.
- **Data-model changes migrate.** A change to the saved shape bumps `CURRENT_SCHEMA_VERSION` and adds a pure, idempotent step to `src/domain/config/migrate.ts` (a larger step in a module of its own, e.g. `migrateV6.ts`). A step holds any default it relies on as its own frozen literal, never a live constant, so a later release can't change what an old board becomes. Each step is tested field by field against a stored fixture in `src/domain/config/fixtures/` (fictional names only), and the oldest supported fixture is run through the whole chain.
- **Amplify cells find their apps in one place.** Which apps a cell reads (its pins for its key, else its unkeyed pins, else what its key's app search finds building the row's repo) is `src/engine/amplifyAccess.ts`; repo matching is `buildsRepo` in `src/domain/matching`; a region's listing and its skip rules are `src/lib/amplify/regions.ts` (add a region to `AMPLIFY_REGIONS`, and to `OPT_IN_REGIONS` if accounts must opt in). Tests seed a key's search with `seedSearch` from `src/test/amplifyRows.ts`.
- **Settings go through the one resolver.** A value that may differ by row, column or cell (a credential, a status set, an item rule) is a field of the settings object (`src/domain/settings`), read per cell with `resolveSetting` and edited only through `SettingsEditor`. Don't add a parallel inheritance path.
- **Settings on the board go through one gear and one popup.** Every gear on the board (headers, labels, the cell gear, the detail sheet) is `SettingsGear` (`src/board/SettingsGear.tsx`) with a place. Cells hold no gear: one `CellGearLayer` around the grid moves a single gear to the cell under the pointer or focus, without re-rendering cells, so keep cell state and handlers out of it (find its gear in tests with `cellGear`, `src/test/cellGear.ts`). Header gears follow `Layout.headerGears` (none, and no room kept, under 640 px); every gear opens the one `SettingsPopup`, which `SettingsPopupProvider` renders beside the board's viewport (not inside it, so keys and pointer events in the popup never reach the board's zoom and panning). Gear sizes are the named constants in `src/board/settingsGearSize.ts`, in ems of the board's text; a header's or label's gear has its room kept in the layout's worst case (`trail` in `src/board/packing.ts`). Edits save through `useValidatedChange`, as the dashboard editor's do. Test a board with its popup with `renderSettingsBoard` (`src/test/settingsBoard.tsx`), and a narrow screen with `fakeMediaQueries` (`src/test/mediaQuery.ts`).
- **Group frames and lines are drawn once, in gutters.** A group boundary is a gutter: a grid track of its own (`src/board/groupGutters.ts` places them, and `boardGroups` counts them for the layout, so fit and zoom stay exact). A column group's frame is one element over the grid (`ColumnFrames`), and a row boundary is one line across it (`RowGutter`, or the label row's line), all in `src/board/GroupFrames.tsx`. Never draw a boundary as a border on cells, headers or labels: every stage header and cell is placed in its grid column, so nothing auto-places into a gutter. What sits above or below the frames is the z-order in `src/board/gridStyles.ts` (`FRAME_LAYER`, `PIN_ABOVE_FRAMES`, `PIN_LEFT`). Test with the regrouped board in `src/test/framesBoard.tsx`.
- **Don't reinvent the wheel: use [`radash`](https://radash-docs.vercel.app)** for general-purpose utilities (grouping, sorting, picking max/min, uniqueness, deep cloning, retries, debouncing and the like) instead of hand-rolled helpers. Write a local helper only when radash has nothing suitable, and say why in a comment.
- **Ports and adapters**: pure domain logic in `src/domain`; providers behind interfaces; React components render and hold UI state only.
- **Files stay under 300 lines** (ESLint `max-lines`). Split by responsibility before that.
- **Exports state their return types**, test utilities included (ESLint `explicit-module-boundary-types`).
- **No floating promises, tests included** (ESLint `no-floating-promises`, `void` not accepted): await a promise, return it, or handle its rejection. A test that must leave a request in flight holds its promise and settles it before the test ends. Only router navigation and TanStack's invalidation and refetch, which never reject, may be called without awaiting.
- **Every non-test module starts with a TSDoc `@module` comment** saying what it is for.
- **No React act(...) warnings.** One fails the test that logged it (`src/test/actGuard.ts`). Wrap state-changing work the test does directly in `act` (focus an element with `focusElement` from `src/test/focus.ts`, not a bare `element.focus()`), and await async updates with `findBy*` or `waitFor`. Never stub `console.error` to hide one.
- **Tests sit next to the code** (`*.test.ts(x)`). Use fakes for ports. Provider fixtures are recorded from real API responses, then trimmed and anonymised to `acme/*`.
- **UI** follows the jeeves-server kit: Tailwind v4 tokens and shadcn-style components in `src/components/ui`, outbound links through `ExternalLink`. Every side panel and bottom sheet is laid out by `PanelSheetContent` (`src/components/SidePanel.tsx`): a pinned header (title, _Close_, and tabs given through `PanelTabs`) over a body that alone scrolls. Don't give a panel its own sticky header or scroll container.
- **Use library controls.** Build UI from the component library (shadcn-style components over Radix primitives in `src/components/ui`; add the library's component when one is missing) rather than hand-rolling a tooltip, dialog, sheet, tabs, toggle group, checkbox, collapsible or similar. Hand-roll only with a compelling reason the library can't meet, and say why in a comment. (Deliberate exception: `ConfirmButton`'s inline confirm.) ESLint rejects a native `<select>`, `<details>`/`<summary>` or checkbox `<input>` outside the wrappers in `src/components`: use `Choice`, `Disclosure` (or `Collapsible`) and `CheckField`.
- **Windows-friendly scripts**: write repo scripts in TypeScript, not shell.

## Security

fooboard is static and browser-only; credentials never leave the user's browser except to call GitHub or AWS directly.

- Never commit, log or print credentials, and never put them in error messages, fixtures or screenshots.
- Credentials are stored only where the user chooses: session memory, or local storage under _Remember on this device_.
- No third-party or inline scripts, cookies or telemetry.
- Everything runs under the CSP of `customHttp.yml` (README _Hosting_): no inline `<script>` or `<style>`, no `eval` or `new Function` (zod runs jitless: `src/zodJitless.ts`, the first import of `main.tsx`), no third-party script, embed, font or image, and requests only to `api.github.com` and the Amplify endpoints. React `style` props are fine. A region added to `AMPLIFY_REGIONS` goes into `connect-src` too, and a library that injects a `<style>` needs its hash: `src/workflows.test.ts` and `src/cspStyles.test.tsx` fail until they match. Check a change that adds a dialog, a library control or a request with `npm run preview` and the browser console open: a CSP violation is a bug.

## Timing (development builds)

In the dev server (`npm run dev`) every board is timed (`src/perf`): each request's duration (including any wait in its credential's queue) and outcome, the requests each row needed, and the time to the first status cell and to the full board, from the board opening and, for the first board after a page load, from the page loading. Marks and measures named `fooboard-timing:*` appear in the browser's performance panel; when the board is full, a collapsed `fooboard-timing` group in the console summarises the load against the spec's performance targets (named constants in `src/perf/targets.ts`).

- **Demo latency and scenario:** the demo answers at once (except the jobs of the run it starts two minutes in, which take 5 s, to show the refreshing dot); open `/demo?latency=300` and the simulator delays every response by 300 ms, the latency the demo targets assume, and add `scenario=measure` (`/demo?scenario=measure&latency=300`) to time the 19 × 6 measurement scenario those targets are set on. At that latency a read can run just past the 300 ms refreshing delay, so a polling row may show the dot for a moment.
- **Stray requests:** requests still running for a board no longer shown settle while the next board loads, sharing the credentials' queues, so the summary notes how many did. In development React starts each board's model twice and discards the first, whose requests still run; a board closed while polling leaves its reads in flight too. Polling after the full board is never part of a board's own load.
- **Production:** none of this is built. `import.meta.env.DEV` is `false` there, so `src/perf/index.ts` exports pass-throughs and `src/query/QueryProvider.tsx` never loads the TanStack Query Devtools (imported lazily, in development only). Each module tests `import.meta.env` itself: the build folds the test to `false` only within the module that makes it. The build fails if `fooboard-timing`, the Devtools or the demo's measurement scenario appear in its output (`vite/noDevInstrumentation.ts`). Tests run with neither.

## The simulated demo

The demo (`/demo`, `src/demo`) is the real board over a simulated GitHub and AWS (spec.md §3.14). The readers send through a _transport_ (`src/lib/transport.ts`): the browser's `fetch` and GitHub's API base on a real board, the simulator's in the demo. The simulator answers `api.github.com` and Amplify's regional endpoints from a world computed from the scenario, its seed and the clock, and fails every other request as a network error. The AWS SDK still signs and parses each request (its `FetchHttpHandler` sends through the transport's `fetch`).

- **Scenarios** are data, one module each under `src/demo/scenarios/`: repos with their branches and workflows, AWS keys and Amplify apps, promotions, pinned events and the dashboard. `acme.ts` ships; `measure.ts` is the 19 × 6 measurement scenario for the demo targets, development only (`/demo?scenario=measure`). Adding a repo and its row needs no engine change.
- **The engine** (`src/demo/sim/`) is pure in the scenario, seed and time: the same inputs give byte-identical answers, ETags included. Tests read it through `src/test/simDemo.ts` (the measurement scenario unless given) and `src/test/simScenario.ts` (a small world).
- **Coverage:** `acme.coverage.test.ts` proves that within `DEMO_COVERAGE_WINDOW_MS` the demo shows everything §3.14 lists; `fidelity.test.ts` parses every simulated answer with the readers' own schemas and the SDK. Change the scenario, and they say what it no longer shows.
