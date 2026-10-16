# AGENTS.md

Standing rules for everyone who changes this repo, human or coding agent. What to build, and in what order, is in the product spec's development plan; this file is _how_ to work.

## Workflow

- **One PR at a time.** Each PR ships a meaningful block of features. Never work on two PRs in parallel; start the next from an up-to-date `main` after the previous one is merged.
- **Branches** are named `feature/<slug>` (lefthook enforces the prefix).
- **Commit and push** after every green commit. Before every push, check the branch's PR state (`gh pr list --head <branch> --json number,state`); if it is merged or closed, stop.
- **Open the PR as a draft early** so progress is visible; mark it ready only after the pre-review checks below.
- **Only the maintainer merges, deploys and releases.** Don't edit `CHANGELOG.md` by hand; it is generated at release.

## Quality gate (every commit)

All of these pass with **zero errors and zero warnings**:

```
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
3. **Docs sync**: README, docs and the credential guide match the touched code **exactly**: commands, options, behaviour, examples and screenshots.
4. **Test coverage, to the standard of _adequate_**:
   - cover meaningful behaviour: decision branches, edge cases and error paths;
   - **remove trivial tests**: tests that restate the implementation, assert constants or framework behaviour, or exist only to raise a percentage;
   - coverage is reported, never gated by a threshold;
   - note anything deliberately left uncovered in the PR body, with the reason.

## Code conventions

- **TypeScript, strict.** No `any`; use `unknown` and narrow.
- **Zod schemas are the source of truth** for data shapes; derive types with `z.infer`.
- **Ports and adapters**: pure domain logic in `src/domain`; providers behind interfaces; React components render and hold UI state only.
- **Files stay under 300 lines.** Split by responsibility before that.
- **Every non-test module starts with a TSDoc `@module` comment** saying what it is for.
- **Tests sit next to the code** (`*.test.ts(x)`). Use fakes for ports. Provider fixtures are recorded from real API responses, then trimmed and anonymised to `acme/*`.
- **UI** follows the jeeves-server kit: Tailwind v4 tokens and shadcn-style components in `src/components/ui`, outbound links through `ExternalLink`.
- **Windows-friendly scripts**: write repo scripts in TypeScript, not shell.

## Security

fooboard is static and browser-only; credentials never leave the user's browser except to call GitHub or AWS directly.

- Never commit, log or print credentials, and never put them in error messages, fixtures or screenshots.
- Credentials are stored only where the user chooses: session memory, or local storage under _Remember on this device_.
- No third-party or inline scripts, cookies or telemetry.
