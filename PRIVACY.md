# Privacy

_Effective 23 October 2026._

fooboard is a static web app that runs entirely in your browser. This page says, plainly, what it does with your data. In short: **we don't collect any.**

## What fooboard stores, and where

Everything fooboard keeps stays **in your browser**, on the device you are using:

| What                                                                                    | Where                                                                          | How long                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Your dashboards (names, rows, stages, rules, colours, groups)                           | Browser local storage                                                          | Until you delete them or clear your browser's data for the site                                 |
| Zoom, density and theme                                                                 | Browser local storage                                                          | The same                                                                                        |
| GitHub tokens and AWS keys                                                              | The page's memory only, or local storage if you tick _Remember on this device_ | Until the tab closes (memory), or until you _Forget_ them or clear the site's data (remembered) |
| A copy of your dashboards from before an upgrade (e.g. `fooboard:config.v4`)            | Browser local storage                                                          | Until the next save succeeds                                                                    |
| What fooboard read from GitHub and AWS (runs, jobs, branches, apps, rate-limit budgets) | The page's memory only                                                         | Until the tab closes; a changed secret drops what was read with the old one, budget included    |

fooboard has no server of its own, no accounts, no database, no cookies, no analytics, no advertising and no third-party scripts. Nothing you enter is sent to us.

## Who your browser talks to

- **The host** that serves fooboard's files. Like any website, it may keep standard access logs (your IP address, the time, the page requested). It never receives your dashboards or credentials.
- **GitHub** (`api.github.com`), using your token, to read the repos, branches, workflow runs and jobs on your boards. GitHub's [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) applies.
- **AWS** (Amplify's regional endpoints), using your key, to read the Amplify apps, branches and jobs on your boards. The [AWS privacy notice](https://aws.amazon.com/privacy/) applies.

These calls go **directly** from your browser to GitHub and AWS. fooboard does not proxy, see or keep them.

## Links and sharing

Links to X, GitHub and other sites are ordinary links: nothing is sent until you follow one, and then that site's own privacy policy applies. _Share_ uses your device's share menu or your clipboard; fooboard doesn't see what you do with them.

## Your credentials are your responsibility

Anyone with access to your browser profile can read what is stored in it, including remembered credentials. Use read-only credentials scoped to what the board needs, as the [credentials guide](./README.md#credentials) explains, and revoke them when you're done.

## Removing your data

- _Forget_ removes one credential from this browser.
- Deleting a dashboard removes it, its view settings and its credentials from this browser.
- To remove all of fooboard's data from this browser, and nothing else, close every fooboard tab, then clear this site's data in your browser's settings. Closing the tabs drops the credentials held in their memory.

Removing data from fooboard does not revoke credentials at GitHub or AWS: [revoke them there](./README.md#revoking-a-credential) too.

## Children

fooboard is a developer tool, not directed at children.

## Changes

Changes to this page are made in the [public repository](https://github.com/karmaniverous/fooboard), where its history is visible. The date at the top shows the latest version.

## Contact

Questions: [open an issue](https://github.com/karmaniverous/fooboard/issues).
