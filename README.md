# fooboard

**Welcome to DevOps hell. Here's your map.**

> `fooboard.dev` &middot; open source (BSD-3-Clause) &middot; X: [@fooboarding](https://x.com/fooboarding)

fooboard is a free, open-source, client-only browser app that shows the
deployment state of every repo × stage at a glance. Setup takes minutes:
paste a GitHub token, pick repos and a branch preset, and the board fills
itself in from GitHub Actions runs (and, optionally, AWS Amplify jobs) —
no workflow changes required. Nothing leaves the browser except the calls
it makes directly to GitHub and AWS; the host serves static files only.
See [spec.md](https://github.com/karmaniverous/fooboard) (tracked
separately) for the full product spec.

**Status:** pre-release, built in the PRs listed in `spec.md` §8. Landed so far:

- **App shell** (Vite + React + TypeScript + Tailwind v4), with a shadcn-style UI kit shared with [jeeves-server](https://github.com/karmaniverous/jeeves-server).
- **Domain core** (`src/domain/`): the config schema, branch presets, matching rules and cell derivation. Pure TypeScript.
- **Live data**:
  - the GitHub and Amplify providers (`src/lib/github/`, `src/lib/amplify/`);
  - a fictional `acme/*` demo board with demo providers (`src/demo/`), shaped like a real pipeline: three preview environments in a _Preview_ column group, then dev, release and prod; a _Backend_ group of GitHub repos (one keyed to its own jobs) and a _Frontend_ group of Amplify apps that release from `preview/release` with the group's own AWS key; one unmapped run for each reason;
  - the board engine and poll scheduler (`src/engine/`), which turn provider data into the cell model.
- **The board** (`src/board/`):
  - cells in solid status colours, with as much detail as their size allows;
  - behind/diverged badges linking to the GitHub compare page, and empty states;
  - a hover tooltip, and a detail sheet on touch;
  - row and column groups: a line at every group edge, group names above their rows (they stay in view when the board scrolls sideways) and over their columns;
  - a layout that keeps text readable (13 px at 100%) and shows as much as fits: equal columns across the screen, and the most detail every cell can show at the same size; tall boards scroll down;
  - zoom (Ctrl/Cmd + wheel, pinch, the buttons, or `+` `-` `0`): zooming out shrinks text to fit more, zooming in adds detail, then magnifies;
  - Default, Comfortable and Compact density (padding only);
  - light or dark, following the device's setting;
  - summary counts that filter the board (just a dot or circle and the count when space is short, with the word on hover), and a battery meter of the GitHub requests left.
- **Follow and Share**: _Follow @fooboarding_ in the page header, and a _Share_ button on every board. For now Share offers the demo link: the device's share menu where there is one, _Copy link_, and _Post on X_.
- **Try the demo**: `/demo`, or _Try the demo_ on the home page, shows the demo board with no account.
- **Local storage** (`src/storage/`), all in this browser:
  - dashboards, saved under a versioned schema; older saves are upgraded when they load (dividers become groups); data that can't be read is reported and never overwritten;
  - zoom and density, saved per dashboard on each device;
  - tokens and AWS keys, kept only for the current tab unless _Remember on this device_ is ticked, with _Forget_ to remove them;
  - _Reset_, which clears only fooboard's data.
- **Browser spikes**: two removable dev pages (below).

- **Your own dashboards**: _Create a dashboard_ on the home page (a name and starting stages), then open it at `/d/<id>`:
  - **Credentials**: add a GitHub token or AWS key (an eye button shows what you pasted), kept for the tab unless _Remember on this device_ is ticked. You can also _Forget_ one, choose the dashboard's default (and a row group's own default, which its rows use unless they choose their own), copy one from another dashboard (an independent copy), and remove one. Tokens close to expiry are flagged, and each credential states the worst case if it leaks.
  - **Edit**:
    - rename, duplicate or delete the dashboard;
    - add rows from a searchable list of your repos, or Amplify apps listed from AWS;
    - add stages from the branches found in your repos, with a preview of what a pattern matches;
    - edit the mapping rules and colours;
    - group rows and stages: start a group from any row or stage, add others to it, label it, or delete it (its members stay); a group disappears with its last member;
    - give a row group its own default credentials and branch overrides, and any row its own overrides (a row's beats its group's, which beats the stage's pattern); _Find branches_ reads the branches in the repos concerned and suggests them as you type in each field (for a group, with how many of its repos have each); a row's credential choices name the credential it inherits and whether it comes from its group or the dashboard;
    - reorder by dragging or with _Move up_ / _Move down_: dropping onto an item puts it in that item's group (or none), and a step at a group's edge first leaves the group, or joins the group next to it; every removal asks first.
  - **Unmapped (N)**: recent runs with no cell, each with its reason. _Add test_ opens the editor with the fix pre-filled. For a branch no stage matches, _Add override_ opens the run's row, ready to use that branch for a stage on the row or its group.
- **Credential guide**: `/guide/credentials` covers creating read-only tokens and keys, what a leak exposes, and how to revoke.

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
