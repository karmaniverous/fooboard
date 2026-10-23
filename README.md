<div align="center">

<img src="public/favicon.svg" alt="fooboard logo" width="120" height="120" />

# fooboard

**Welcome to DevOps hell. Here's your map.**

[![CI](https://github.com/karmaniverous/fooboard/actions/workflows/ci.yml/badge.svg)](https://github.com/karmaniverous/fooboard/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](https://github.com/karmaniverous/fooboard/tree/main/LICENSE)
[![changelog](https://img.shields.io/badge/changelog-latest-blue.svg)](https://github.com/karmaniverous/fooboard/tree/main/CHANGELOG.md)
[![X: @fooboarding](https://img.shields.io/badge/follow-%40fooboarding-black?logo=x)](https://x.com/fooboarding)

</div>

> 📷 _Screenshot to come: the demo board, light and dark._

fooboard shows the deployment state of every repo × stage at a glance. Paste a GitHub token, pick your repos and a branch preset, and the board fills itself in from your GitHub Actions runs (and, if you use them, AWS Amplify builds). No workflow changes, no account, no server: it is a free, open-source, static web app, and nothing leaves your browser except the calls it makes directly to GitHub and AWS.

**Status:** pre-release. Not hosted yet; run it locally (see [CONTRIBUTING](./CONTRIBUTING.md)).

## Contents

- [Try the demo](#try-the-demo)
- [Your own dashboard](#your-own-dashboard)
- [Reading the board](#reading-the-board)
- [Editing a dashboard](#editing-a-dashboard)
- [Rules](#rules)
- [Unmapped runs](#unmapped-runs)
- [Credentials](#credentials)
- [Header, menu and footer](#header-menu-and-footer)
- [Your data](#your-data)
- [Releasing and deployment](#releasing-and-deployment)
- [Contributing](#contributing)
- [License](#license)

## Try the demo

_Try the demo_ (on the home page, or the play button in the header) opens a sample board for a fictional company, `acme`, with no account or token. It is shaped like a real pipeline: a _Preview_ group of three preview environments, then _dev_, _release_ and _prod_; a _Backend_ group of GitHub service repos and a _Frontend_ group of Amplify apps. Its runs move along as you watch, and it shows every status, badge, empty state and unmapped run described below. About two and a half minutes in, a new run starts on _web-app_ / _prod_, and its jobs take a few seconds to load, so that cell shows the **refreshing** dot meanwhile.

> 📷 _Screenshot to come: the home page._

## Your own dashboard

1. On the home page, choose _Create a dashboard_: give it a name and pick starting stages: _Environment branches_ (dev, staging, prod), _Gitflow_, _Release train_, or _Blank_.
2. Add a GitHub token under _Credentials_ (see [Credentials](#credentials)).
3. In the editor, add rows from a searchable list of your repos (and, with an AWS key, your Amplify apps), and adjust the stages.

A dashboard lives at `/d/<id>` in this browser.

## Reading the board

> 📷 _Screenshot to come: a board with every status, badge and empty state._

Each **row** is a repo (or an Amplify app, or one deployable unit in a repo), and each **column** a stage (for the built-in presets, a branch or a pattern such as `release/*`). Each **cell** shows the newest record that its row's and its column's [rules](#rules) place there, as the first status in its **status set** whose rule the record matches. The built-in sets:

| Set                                                | Statuses (first match wins)                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| _GitHub deploy and test_ (default for GitHub rows) | Tests failed, Deploy failed, Cancelled, Testing, Deploying, Passed, Deployed, Partial (deployed, tests to come), Queued |
| _GitHub single job_                                | Failed, Cancelled, Running, Queued, Succeeded                                                                           |
| _Amplify_ (default for Amplify rows)               | Failed, Cancelled, Running, Queued, Deployed                                                                            |

Each status has a name, a colour, an icon (✓ success, ✕ failure, ◔ running, ◑ partial, ○ queued, ⊘ cancelled) and can be outlined, as Queued is. A status in progress pulses. Text on a cell is white or near-black, whichever reads better on its colour.

A record that matches no status shows **Unknown** (purple, ?), so a gap in the rules is visible; see [Rules](#rules).

A cell can carry a **badge**: _behind_ (amber, with a count) when its branch is missing commits from the stage it is promoted from, or _diverged_ (with `behind/ahead`) when it also has commits the source lacks. A badge links to GitHub's compare page. Badges need git: they show on rows linked to a GitHub repo (a GitHub row's own repo; an Amplify row's repo) when the cell's record has a commit and a branch.

An **empty cell** says why: _no records_, _needs credential_ (with a link to [Credentials](#credentials)) or _error_. A **warning marker** (!) on a row or stage header, or beside the board's name for board-wide problems, means a rule there has a problem (a group's problems mark its members; a status set's problems mark the rows whose cells use it); hover it to read them, click it to open the editor at the problem. A cell's own problems (such as a hint to read more) are listed in its detail. _Problems (N)_ in the toolbar lists every problem with _Fix_ to open the editor at the exact item, and notes on what the rule check couldn't decide; when there are only notes it reads _Notes (N)_.

**Loading.** A board fills as answers arrive: each repo's runs first, then each run's jobs, then the behind counts. Until a cell's jobs land it can show **provisional**: dashed, in the look of the summary status its run implies (_Running_ for a queued, waiting, requested, pending or in-progress run; _Failing_, _Cancelled_ or _OK_ from a finished run's conclusion; nothing for any other conclusion), taken by name from the cell's status set, or a plain dashed outline when the set has no status of that name. A cell whose rules test jobs shows nothing until they land. A cell showing earlier data while newer data may be on its way carries a pulsing corner dot (**refreshing**): once a read of its row's runs (or of its Amplify apps' branches and jobs) has taken longer than 300 ms, until it lands; at once when they are older than their poll interval; and while a newer run's jobs load over its last placement. A quicker read, as most polls are, shows no dot, so polling doesn't make cells flash. Data still within its poll interval, as when you open a board again soon after, shows no dot. Neither mark changes a cell's size. Answers are kept for the page, so an edit, or opening a board again, shows what is known at once and reads only what is due; a GitHub answer that hasn't changed costs no request budget.

**Polling.** A row polls every 5 s while one of its cells is in progress (a provisional _Running_ included) and every 60 s otherwise, four times slower for a token past half its budget, and nothing polls while the tab is hidden; coming back reads only what fell due. A finished run's jobs are never read again. When GitHub says a token is rate-limited, or AWS throttles a key, fooboard pauses that credential until the provider says to retry (AWS's suggested delay, else 5 s). Each credential's requests wait in one queue: the editors' lookups and a row's first read go to its front, while polls wait their turn with run jobs and behind counts.

**Errors.** A repo GitHub can't find (or an Amplify app that's gone) shows _error_ with a problem on its row; an expired or revoked token shows _needs credential_; either way, nothing cached is shown in its place. A renamed repo keeps its data and gets a "renamed to" problem. Any other failed read puts _error_ with the message on the cells it feeds (the message alone, such as _GitHub request to runs failed with status 502_), and a problem you can dismiss; so does a failure in working out what a row shows, on every cell of that row. One failing Amplify app affects only the rows that read it.

- **Details**: hover a cell (or focus it from the keyboard) for its status, branch, commit and time; on a touch screen, tap for a detail sheet. Clicking a cell opens the job on GitHub (or the Amplify console).
- **Groups**: rows and stages can be grouped, with a line at each group's edges. A column group is framed, its name at its left; group names stay in view as the board scrolls.
- **Fitting the screen**: columns share the window's width, and each cell shows as much detail as fits. Zoom with Ctrl/⌘ + wheel, a pinch, the toolbar buttons or `+` `-` `0`; zooming out fits more, zooming in shows more. _Default_, _Comfortable_ and _Compact_ density change the padding.
- **Legend**: _Legend_ shows each status set the board’s cells use, with its statuses as cells show them.
- **Summary**: a count for each summary status the cells show (for the built-in sets: _Failing_, _Running_, _Cancelled_, _OK_; _Unknown_ last), then behind and diverged cells; click one to show only those cells, again to clear. A provisional cell (see _Loading_ below) counts toward no chip and matches no filter until its jobs land.
- **Request budget**: a battery for each GitHub token the board uses shows the requests left this hour; its tooltip names the token and says when the budget resets. It is grey and empty until the board's first GitHub response with that token, and again after you replace or forget the token: fooboard reads the budget from the headers of answers it already gets and never asks for it separately, so it costs nothing. fooboard polls four times slower for a token past half its hourly budget; a replaced token starts without that slowdown until its own first response.

## Editing a dashboard

> 📷 _Screenshot to come: the editor._

_Edit_ (on the board) opens the editor, with these tabs:

- **General**: rename, duplicate or delete the dashboard, and set its **requests in flight**: how many requests each credential may have running at once in this tab, for GitHub and AWS separately (1 to 100, 10 by default). A change applies at once and reads nothing again. Higher fills the board faster; a burst can trigger GitHub's secondary rate limits or AWS throttling, after which fooboard pauses that credential (see _Polling_). The limit is per credential per tab: two tabs on the same token can each have that many running.
- **Rows**: add GitHub rows from the repos a token can see (the dashboard's default token unless you choose another; the row keeps the one you chose), or Amplify rows from the apps your AWS key lists. A credential choice offers the default it inherits first, as _Dashboard default (name)_ or _Group default (name)_, then the other credentials of that kind. A row can use its own credentials, its own row rule (e.g. one deployable unit in a repo), and its own rule for any stage (an **override**). An Amplify row can read more than one app (_Add source_, say for an app in another AWS account); each source has the same AWS key choice as when it was added, which you can change at any time.
- **Stages**: add stages, each with a rule saying which records belong in it (the presets test the branch); set each stage's source (for the behind/diverged badges).
- **Sources**: the source rules for GitHub and Amplify, including what to read (GitHub: skip pull-request runs, which still count toward what is read, and runs per repo, 100 by default and up to 500, each 100 one request per repo per poll; Amplify: jobs per branch, 20 by default and up to 100, and which branches). When a read comes back full, each of its rows' cells showing _no records_ gets a hint to read more, since the stage's last run or job may be older than what was read. Amplify reads every branch by default, which makes more AWS calls than reading only stage branches; narrow it with the branch rule; see [Rules](#rules).
- **Statuses**: the status set GitHub rows and Amplify rows use; see [Rules](#rules).

**Groups**: start a group from any row or stage, add others to it, label it, or delete it (its members stay). A row group can have its own default credentials, row rule, status sets and stage overrides; a row's own override beats its group's, which beats the stage's rule, and each choice names what it inherits.

**Lists**: rows, stages, column groups, your own status sets and their cell statuses, your own source rules and their keys, and the runs no status matches each show as a header (name, a summary such as the repo, pattern or members, and its move, remove or add buttons) that opens to its details with one click. One opens at a time per list, all start closed, a new one opens (and scrolls into view), and _Fix_ or _Add override_ opens the one to change. A row group's settings, shown in each member's row, open from _Group settings_.

**Reordering**: drag an item by its handle and its header moves with the pointer while the others slide aside; a dimmed copy marks where it will land, and it settles there when you let go. From the keyboard, focus the handle, press Space, move with the arrow keys and press Space again (Escape cancels), or use _Move up_ / _Move down_. With reduced motion set in your system, items move without sliding. Dropping onto an item puts it in that item's group. Every removal asks first.

## Rules

Everything fooboard knows about GitHub, Amplify or your pipeline is a rule you can edit; the app ships built-in rules for both sources.

**Checks and rules.** A **check** tests a value in a record: a [JSONPath](https://www.rfc-editor.org/rfc/rfc9535) (filters allowed, e.g. `$.items[?search(@.name, '[Tt]est')].state`; filter functions are case-sensitive, so the _only items where_ builder writes them for you), an operator, and options:

- **glob** (default): the whole value; `*` any characters, `?` one, `[abc]` one of, `{a,b}` either;
- **regex**: JavaScript syntax, anywhere in the value unless anchored;
- **exists**: the path finds a value that isn't null;
- **ignore case** (default on), **any** or **every** value the path finds, and **NOT**.

A **rule** is one or more checks joined by **AND** (default) or **OR**. Null counts as missing; numbers and booleans are tested as text; an object or array can only be tested with **exists** (glob and regex never match one), so test a field inside it. The branch presets test the branch with regexes, so `preview/*` stops at `/` and needs at least one character after `preview/`. Regexes are limited to 500 characters; a badly written one can still slow the page.

**Three kinds of rule.**

- **Source rules** (the _Sources_ tab, one per source) turn each source's raw data into **records** with keys you name: each key is an ordered list of translations (the first whose rule matches gives the value), so GitHub's `failure` and Amplify's `FAILED` can both become `status: failed`. A source rule also says where the items are (GitHub: the run's jobs) and their keys (item rules are offered only for a source whose rule has items), which records to keep (default: all), which key orders records (required), and, for Amplify, which branches to read (default: all). Every record keeps its raw data under `_raw`. The board shows `time`, `link`, `message`, `commit` and `branch` when a record has them.
- **Placement rules**, one per source, say which records belong where: on the dashboard, a row group or a row, a **row rule** for the record and an **item rule** for its items (e.g. only the `deploy (billing)` job on a billing row); on the dashboard, a column group or a stage, a **stage rule**, overridable for a row group or a row. The most specific level wins; a stage without its own rule uses its column group's, then the dashboard's. With no stage rule at all a stage matches nothing (and says so); with no row rule a row takes everything from its repo or app. A record belongs in a cell when it passes the row and stage rules; the cell shows the newest by the order key.
- **Status sets** decide what a cell shows: an **item rule** (an item counts when it passes this and the row's item rule; a record with items but none that count isn't the cell's), **summary statuses** (the summary chips: name, colour, icon, in progress) and **cell statuses** in order, each with a rule: a cell shows the first whose rule its record matches, or Unknown.

**Which set a cell uses**: a single cell's choice, else its row's, else its row group's, else the dashboard's; each choice offers _Inherit_, naming the set it would get. **Built-in rules** (source rules and status sets) are referenced by id, so a board picks up fixes in new releases. The branch presets instead write ordinary stage rules into each stage, which you edit directly. **Customise** copies one into the dashboard to edit; built-ins can't be edited in place, and a rule still in use can't be removed.

**Time and link**: a cell shows the `time` and `link` of its counted item with the latest time (else the record's own). The built-in GitHub rule gives each job its completion time, else its start time, so a running job shows when it started.

**Editing a rule**: rows of checks under an AND/OR switch. The path field suggests the paths the board's current records have, and _Pick field_ shows a real record (an Unknown one when there is one) as a tree, raw data included, to click a path from; _only items where_ (pick an item key, type a glob) writes the filter for you, ignoring case unless you untick it; a live preview says how many of the board's records (or items) each check and the whole rule match, over up to 50 records per source. When a glob or regex check's path finds an object or array in any of the data the preview uses (one such value is enough, under **any** or **every**), the check says to test a field inside it; the hint is the path field's accessible description. A source rule's keys are edited on the _Sources_ tab as lists of translations, each a rule over the raw data that gives a value or copies one, previewed over the raw data of the board's records; the Amplify branch rule previews over the branch lists read. A stage's branch pattern (on the _Stages_ tab, and in a stage-rule override on a row or row group) is a shortcut that writes the stage rule for you; under it you can write a full rule instead.

**Problems**: a path that doesn't parse (copy and items paths included), a rule that uses a key (or item key) its source rule doesn't produce, an order key that is none of the source rule's keys, an item rule on a source without items, a stage with no stage rule for a source its rows use, a source rule or status set that doesn't exist or is for the other source (the built-in default is used meanwhile), and a key no translation matched while reading (with how often and a sample) are reported where they happen. _Fix_ opens the editor at the item; a problem in a built-in source rule or status set offers _Customise_, which makes an editable copy and uses it, since built-ins can't be edited in place. Notes say what the check couldn't decide (paths under `_raw`, wildcards) and which rules are for a source no row uses. Hints (an Amplify row without a GitHub credential, so no badges; an empty cell that may need more read, also listed on the _Sources_ tab) and notes can be dismissed; dismissals stay in this browser. The _Statuses_ tab lists the records no status matches; _Add status_ drafts a status for an Unknown record at the top of its set (a built-in set is first copied into the dashboard).

**Versions**: a board records the version of fooboard's data model that saved it (now 5); a release that changes the data model migrates older boards automatically (version 5 gave each board its _requests in flight_, 10 for GitHub and AWS), and a board from a newer release asks you to reload. Boards saved by early development builds (before version 4) can't be opened. Saved boards that can't be read, from any version, are reported and left unchanged: fooboard never saves over them.

## Unmapped runs

_Unmapped (N)_ lists recent GitHub runs and Amplify jobs that have no cell, with the reason for each row that reads their repo or app: no stage rule matches (naming the branch), no row rule matches, no item counts, or no order key. _Add rule_ opens the editor where the fix goes, with a check drafted from the record to add: a new stage pre-filled with the branch; the row rule that missed it; the item rule of the row's status set; or the source rule's order key. _Add override_ opens a stage-rule override for the branch on a row reading the record or its group.

## Credentials

fooboard reads GitHub and AWS with credentials **you** create, kept only in this browser. Create the narrowest ones that work: read-only, for just the repos and apps on the board, with a short expiry. Every place in the app that needs a credential links here.

> 📷 _Screenshot to come: the Credentials panel._

### GitHub token

Use a **fine-grained personal access token**:

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Set **Resource owner** to your account, or to the **organization** that owns the repos. An organization's repos can only be selected when the organization itself is the resource owner.
   > An organization may require an admin to **approve** fine-grained tokens. Until one does, the token stays pending and the board shows _needs credential_.
3. Under **Repository access**, choose _Only select repositories_ and pick only this dashboard's repos.
4. Under **Permissions**, set these repository permissions to _Read-only_, and leave everything else at _No access_:

   | Permission | Access    |
   | ---------- | --------- |
   | Metadata   | Read-only |
   | Contents   | Read-only |
   | Actions    | Read-only |

5. Set a short **expiration** (30 to 90 days). fooboard warns as it approaches.
6. Generate the token and paste it into _Credentials_ → _Add a credential_. Tick _Remember on this device_ to keep it after the browser closes.

### Classic tokens

A classic token works, but GitHub's classic scopes have no read-only option for private repos: reading their Actions runs needs the `repo` scope, which also grants **write** access to every repo its owner can reach, not just the ones on this board. fooboard only reads, but a leak would expose that write access. For a board of public repos only, a classic token with **no scopes** is enough, and can only read. Otherwise, use a fine-grained token unless your organization disallows them.

### Shared boards

Everyone viewing a board with the same token shares that token's hourly GitHub budget (the battery shows what's left). For a shared board, create a token just for it, not your everyday one, so it can be revoked on its own, and name it clearly (e.g. `fooboard-acme-shared-2026Q4`).

### AWS key

Amplify rows need an AWS access key for an IAM user that can only read Amplify:

1. In the IAM console, create a user for fooboard (one per AWS account).
2. Attach a read-only Amplify policy. On the AWS key form in fooboard, **Copy AWS policy** copies the right one:
   - **Before the dashboard has Amplify rows** (you create the key before you can pick its apps), it copies the account-wide policy below: the key can read the branches and jobs of every Amplify app in the account.
   - **After you add Amplify rows**, copy it again and replace the policy: the copy narrows branches and jobs to this dashboard's apps, as in the template below.

   Or attach a policy below yourself: in the template, replace `REGION`, `ACCOUNT_ID` and `APP_ID`, adding a line to each of the last two statements for each app.

3. Create an access key for the user, and paste its ID and secret into _Credentials_ → _Add a credential_ → _AWS key_.

Account-wide, before the dashboard has Amplify rows:

<!-- prettier-ignore -->
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FooboardListApps",
      "Effect": "Allow",
      "Action": [
        "amplify:ListApps"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FooboardReadAllApps",
      "Effect": "Allow",
      "Action": [
        "amplify:ListBranches",
        "amplify:ListJobs"
      ],
      "Resource": "arn:aws:amplify:*:*:apps/*"
    }
  ]
}
```

Narrowed to the dashboard's apps (the template):

<!-- prettier-ignore -->
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FooboardListApps",
      "Effect": "Allow",
      "Action": [
        "amplify:ListApps"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FooboardReadBranches",
      "Effect": "Allow",
      "Action": [
        "amplify:ListBranches"
      ],
      "Resource": [
        "arn:aws:amplify:REGION:ACCOUNT_ID:apps/APP_ID"
      ]
    },
    {
      "Sid": "FooboardReadJobs",
      "Effect": "Allow",
      "Action": [
        "amplify:ListJobs"
      ],
      "Resource": [
        "arn:aws:amplify:REGION:ACCOUNT_ID:apps/APP_ID/branches/*"
      ]
    }
  ]
}
```

AWS can't limit listing apps to particular apps, so the key can see the **names** of every Amplify app in the account (that is how the editor offers apps to pick). With the narrowed policy it reads branches and jobs only for the apps listed; with the account-wide one, for every app in the account. The copied policy uses `*` for the account, because fooboard doesn't know it: that grants nothing more, since a user's policy only reaches its own account's apps. A source whose region or app ID is not valid (an app ID of `*`, say, would widen the policy) is left out, and the button says so; if no source is valid, it copies the account-wide policy. A row whose apps span accounts uses one key per account.

### What a leaked credential exposes

- **Fine-grained GitHub token** (as above): read access to the selected repos only, including their code, workflow files and Actions logs. It cannot write, push or start anything.
- **Classic token** with the `repo` scope: read **and write** access to every repo its owner can reach; treat a leak as a compromise of those repos. With no scopes: public data only.
- **AWS key** (policies above): the names of the account's Amplify apps, and branch and job details for the listed apps (for every app in the account, with the account-wide policy); nothing else in your AWS account.

### Revoking a credential

- **GitHub**: [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) (or your organization's token page): delete the token. It stops working at once.
- **AWS**: IAM console → Users → the fooboard user → Security credentials: deactivate or delete the access key; delete the user if it exists only for fooboard.
- **In fooboard**, _Forget_ removes a credential from this browser. It does not revoke it at GitHub or AWS: do that too.

## Header, menu and footer

The header stays at the top of the window. Its buttons, each with a tooltip:

- **News & support**: [@fooboarding](https://x.com/fooboarding) on X.
- **README**: this page.
- **Try the demo**.
- **Theme**: _System_ (follows your device's light or dark setting), _Light_ or _Dark_. The button cycles through them and the menu offers all three; the choice is saved on this device.
- **Share / Export**: for now, shares the demo (your device's share menu where there is one, _Copy link_, _Post on X_). Sharing and exporting boards come later.
- **Import**: coming soon.
- **GitHub**: this repo.
- **Report an issue**: [GitHub Issues](https://github.com/karmaniverous/fooboard/issues).

As the window narrows, buttons move into the menu from the right, then the tagline goes; _README_ and _News & support_ stay longest. [Privacy](./PRIVACY.md) and [Terms](./TERMS.md) are always in the menu. The footer repeats every item as a link, turning to icons and then dropping out from the left as space runs short; Privacy and Terms always stay.

## Your data

Everything stays in this browser:

- **Dashboards** are saved under a versioned format; older saves are upgraded when they load, and data that can't be read is reported and never overwritten. The first save after an upgrade keeps a copy of the old save (e.g. `fooboard:config.v4`) until the next save succeeds.
- **Zoom, density and theme** are saved on each device. Deleting a dashboard removes its settings on this device too.
- **Tokens and keys** are kept only for the current tab unless you tick _Remember on this device_. _Forget_ removes one.
- **To clear everything** fooboard keeps, close every fooboard tab, then clear this site's data in your browser's settings. Closing the tabs drops the tokens and keys held in their memory.

See [PRIVACY.md](./PRIVACY.md).

## Releasing and deployment

Only the maintainer releases and deploys. Two long-running branches feed the hosted sites through Amplify Hosting:

| Branch            | Site                                      | Updated by                                              |
| ----------------- | ----------------------------------------- | ------------------------------------------------------- |
| `preview/release` | release.fooboard.dev (password-protected) | `npm run release`, which moves it to the newest release |
| `prod`            | fooboard.dev                              | a PR from a `release/x.y.z` branch, and nothing else    |

**Release.** On an up-to-date `main`, run `npm run release`. release-it runs the quality gate, bumps the version, writes `CHANGELOG.md`, commits, tags, pushes `main`, creates the GitHub release, then:

1. pushes the numbered branch `release/x.y.z`;
2. moves `preview/release` to that commit (`git push --force-with-lease`, no merge commit), so release.fooboard.dev always shows the latest release. The move is a fast-forward in the normal case; the force keeps `preview/release` exactly equal to the release if anything else landed there, and the lease (taken just after a fetch) refuses to overwrite a push that races the release.

**Deploy to production.** Open a PR from `release/x.y.z` into `prod` and merge it. release-it never touches `prod`. The _prod PR from release/x.y.z_ check fails any PR into `prod` whose head isn't a stable `release/x.y.z` branch of this repo. It runs on `pull_request_target`, so its workflow always comes from `prod` and a PR can't edit away the guard that checks it; it never checks out or runs PR code.

**Bootstrapping the prod check.** Because the check's workflow is read from `prod`, it only appears once a release that contains `.github/workflows/prod-pr.yml` has been merged into `prod`. The first release PR into `prod` therefore goes through without the guard (CI still runs on it) and brings the workflow file with it. After it merges, the check runs on every later PR into `prod`, and the maintainer makes _prod PR from release/x.y.z_ a required check in `prod`'s branch protection, alongside _quality (node 22)_ and _quality (node 24)_. Don't require it before then, or no PR into `prod` could merge.

This path needs no direct push to `prod`, so `prod` never holds a commit that didn't come through a release PR, and the guard it adds is exactly the file released and tested on `main`. The only unguarded PR is that first one, which the maintainer opens from `release/x.y.z` by hand.

**Prereleases.** `npm run release:pre` (from any branch) tags a prerelease such as `0.2.0-0`, creates a GitHub prerelease and pushes `release/0.2.0-0`, but leaves `preview/release` alone: the preview site only ever shows a stable release, and a prerelease can't be PR'd into `prod`.

**Hotfixes.** Normally fix on `main` and release again. When `main` holds work that mustn't ship yet, branch `hotfix/<slug>` from the `release/x.y.z` branch, fix it there, run `npm run release -- --no-git.requireBranch` from the hotfix branch (this cuts `release/x.y.(z+1)` and moves `preview/release`), PR that into `prod`, then merge the hotfix branch back into `main` by PR.

**`.env.local`.** `npm run release` loads `.env.local` with dotenvx. It needs `GITHUB_TOKEN` (a token that can create releases on this repo) for release-it's GitHub release; copy `.env.local.template` to start. Other local-only variables, such as validation credentials, may live there too. `.env.local` is gitignored: never commit it or paste its contents.

## Contributing

Development setup, commands and standards are in [CONTRIBUTING.md](./CONTRIBUTING.md). In the dev server, the TanStack Query Devtools show every query, boards are timed and a summary is printed to the browser console; `/demo?latency=300` simulates network latency on the demo; production builds contain none of it. See [Timing (development builds)](./CONTRIBUTING.md#timing-development-builds).

## License

BSD-3-Clause. See [LICENSE](./LICENSE). By using fooboard you agree to the [Terms](./TERMS.md).
