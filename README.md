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
- [Unmapped runs](#unmapped-runs)
- [Credentials](#credentials)
- [Header, menu and footer](#header-menu-and-footer)
- [Your data](#your-data)
- [Contributing](#contributing)
- [License](#license)

## Try the demo

_Try the demo_ (on the home page, or the play button in the header) opens a sample board for a fictional company, `acme`, with no account or token. It is shaped like a real pipeline: a _Preview_ group of three preview environments, then _dev_, _release_ and _prod_; a _Backend_ group of GitHub service repos and a _Frontend_ group of Amplify apps. Its runs move along as you watch, and it shows every status, badge, empty state and unmapped run described below.

> 📷 _Screenshot to come: the home page._

## Your own dashboard

1. On the home page, choose _Create a dashboard_: give it a name and pick starting stages: _Environment branches_ (dev, staging, prod), _Gitflow_, _Release train_, or _Blank_.
2. Add a GitHub token under _Credentials_ (see [Credentials](#credentials)).
3. In the editor, add rows from a searchable list of your repos (and, with an AWS key, your Amplify apps), and adjust the stages.

A dashboard lives at `/d/<id>` in this browser.

## Reading the board

> 📷 _Screenshot to come: a board with every status, badge and empty state._

Each **row** is a repo (or an Amplify app, or one deployable unit in a repo), and each **column** a stage: a branch, or a pattern such as `release/*`. Each **cell** shows the latest run on that stage's branch:

| Cell | Means |
| --- | --- |
| ✓ green | Success |
| ✕ red | Failure |
| ◔ blue, pulsing | Started (still running) |
| ○ pale, dashed, dark text | Queued |
| ◑ teal | Partial (some jobs succeeded) |
| ⊘ slate | Cancelled |

A cell can carry a **badge**: _behind_ (amber, with a count) when its branch is missing commits from the stage it is promoted from, or _diverged_ (with `behind/ahead`) when it also has commits the source lacks. A badge links to GitHub's compare page.

An **empty cell** says why: _no branch_, _no recent runs_, _needs credential_ (with a link to [Credentials](#credentials)) or _error_.

- **Details**: hover a cell (or focus it from the keyboard) for its run, commit, phase and time; on a touch screen, tap for a detail sheet. Clicking a cell opens the job on GitHub (or the Amplify console).
- **Groups**: rows and stages can be grouped; group names stay in view as the board scrolls.
- **Fitting the screen**: columns share the window's width, and each cell shows as much detail as fits. Zoom with Ctrl/⌘ + wheel, a pinch, the toolbar buttons or `+` `-` `0`; zooming out fits more, zooming in shows more. _Default_, _Comfortable_ and _Compact_ density change the padding.
- **Summary**: counts of failing, running, behind and diverged cells; click one to show only those cells, again to clear.
- **Request budget**: a battery for each GitHub token the board uses shows the requests left this hour (grey until first read); its tooltip names the token and says when the budget resets. Reading it costs nothing. fooboard slows its polling as a token's budget runs down, and pauses while the tab is hidden.

## Editing a dashboard

> 📷 _Screenshot to come: the editor._

_Edit_ (on the board) opens the editor, with these tabs:

- **General**: rename, duplicate or delete the dashboard.
- **Rows**: add GitHub rows from your repos, or Amplify rows from the apps your AWS key lists. A row can use its own credentials, and its own branch for any stage (an **override**); _Find branches_ suggests the branches in its repo as you type.
- **Stages**: add stages from the branches found in your repos, with a preview of what a pattern matches; set each stage's source (for the behind/diverged badges).
- **Mapping**: the rules that pick which workflow job a cell shows.
- **Colours**: the status colours.

**Groups**: start a group from any row or stage, add others to it, label it, or delete it (its members stay). A row group can have its own default credentials and branch overrides; a row's own override beats its group's, which beats the stage's pattern, and each choice names what it inherits.

**Reordering**: drag, or use _Move up_ / _Move down_. Dropping onto an item puts it in that item's group. Every removal asks first.

## Unmapped runs

_Unmapped (N)_ lists recent runs that have no cell, with the reason: no stage matches the branch, no rule matches the job, or no row key matches. _Add test_ opens the editor with the fix filled in; for an unmatched branch, _Add override_ uses that branch for a stage on the run's row or its group.

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

   | Permission | Access |
   | --- | --- |
   | Metadata | Read-only |
   | Contents | Read-only |
   | Actions | Read-only |

5. Set a short **expiration** (30 to 90 days). fooboard warns as it approaches.
6. Generate the token and paste it into _Credentials_ → _Add a credential_. Tick _Remember on this device_ to keep it after the browser closes.

### Classic tokens

A classic token works, but GitHub's classic scopes have no read-only option for private repos: reading their Actions runs needs the `repo` scope, which also grants **write** access to every repo its owner can reach, not just the ones on this board. fooboard only reads, but a leak would expose that write access. For a board of public repos only, a classic token with **no scopes** is enough, and can only read. Otherwise, use a fine-grained token unless your organization disallows them.

### Shared boards

Everyone viewing a board with the same token shares that token's hourly GitHub budget (the battery shows what's left). For a shared board, create a token just for it, not your everyday one, so it can be revoked on its own, and name it clearly (e.g. `fooboard-acme-shared-2026Q4`).

### AWS key

Amplify rows need an AWS access key for an IAM user that can only read Amplify:

1. In the IAM console, create a user for fooboard (one per AWS account).
2. Attach this policy. On the AWS key form in fooboard, **Copy AWS policy** copies it with your dashboard's apps filled in; or replace `REGION`, `ACCOUNT_ID` and `APP_ID` below, adding a line to each of the last three statements for each app.
3. Create an access key for the user, and paste its ID and secret into _Credentials_ → _Add a credential_ → _AWS key_.

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
    },
    {
      "Sid": "FooboardReadJob",
      "Effect": "Allow",
      "Action": [
        "amplify:GetJob"
      ],
      "Resource": [
        "arn:aws:amplify:REGION:ACCOUNT_ID:apps/APP_ID/branches/*/jobs/*"
      ]
    }
  ]
}
```

AWS can't limit listing apps to particular apps, so the key can see the **names** of every Amplify app in the account (that is how the editor offers apps to pick); it reads branches and jobs only for the apps listed. The copied policy uses `*` for the account, because fooboard doesn't know it: that grants nothing more, since a user's policy only reaches its own account's apps. Before a dashboard has Amplify rows, the copied policy only lists apps; copy it again after adding them. A row whose apps span accounts uses one key per account.

### What a leaked credential exposes

- **Fine-grained GitHub token** (as above): read access to the selected repos only, including their code, workflow files and Actions logs. It cannot write, push or start anything.
- **Classic token** with the `repo` scope: read **and write** access to every repo its owner can reach; treat a leak as a compromise of those repos. With no scopes: public data only.
- **AWS key** (policy above): the names of the account's Amplify apps, and branch and job details for the listed apps; nothing else in your AWS account.

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

- **Dashboards** are saved under a versioned format; older saves are upgraded when they load, and data that can't be read is reported and never overwritten.
- **Zoom, density and theme** are saved on each device.
- **Tokens and keys** are kept only for the current tab unless you tick _Remember on this device_. _Forget_ removes one.
- **Reset** clears fooboard's data, and only fooboard's.

See [PRIVACY.md](./PRIVACY.md).

## Contributing

Development setup, commands and standards are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

BSD-3-Clause. See [LICENSE](./LICENSE). By using fooboard you agree to the [Terms](./TERMS.md).
