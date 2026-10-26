# Privacy

_Effective 26 October 2026._

fooboard is a static web app that runs entirely in your browser. This page says, plainly, what it does with your data. In short: **we don't collect any.**

## What fooboard stores, and where

Everything fooboard keeps stays **in your browser**, on the device you are using:

| What                                                                                                                                                          | Where                                                                                                                                                                                                                | How long                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Your dashboards (names, rows, stages, rules, colours, groups, settings and pinned apps)                                                                       | Browser local storage                                                                                                                                                                                                | Until you delete them, choose _Reset_, or clear your browser's data for the site                                                                                                                                                                               |
| Zoom, density and theme                                                                                                                                       | Browser local storage                                                                                                                                                                                                | The same                                                                                                                                                                                                                                                       |
| GitHub tokens and AWS keys                                                                                                                                    | The page's memory only, or local storage if you tick _Remember on this device_                                                                                                                                       | Until the tab closes (memory), or until you _Forget_ them, untick _Remember_, choose _Reset_ or clear the site's data (remembered)                                                                                                                             |
| A copy of your dashboards from before an upgrade (e.g. `fooboard:config.v5`)                                                                                  | Browser local storage                                                                                                                                                                                                | Until the next save succeeds                                                                                                                                                                                                                                   |
| What fooboard read from GitHub and AWS (runs, jobs, branches, rate-limit budgets, and the name and repository URL of every Amplify app each AWS key can list) | The page's memory; the answers a board reads with a remembered token or key are also kept in the browser's IndexedDB, unencrypted, each with a one-way fingerprint of the secret it was read with (never the secret) | Until the tab closes (memory); up to 24 hours (IndexedDB), and never for a token or key kept for the tab only. A changed, forgotten or no-longer-remembered secret, a removed credential or a deleted dashboard drops what was read with it, in every open tab |

fooboard has no server of its own, no accounts, no database, no cookies, no analytics, no advertising and no third-party scripts. Nothing you enter is sent to us.

## Who your browser talks to

- **The host** that serves fooboard's files. Like any website, it may keep standard access logs (your IP address, the time, the page requested). It never receives your dashboards or credentials.
- **GitHub** (`api.github.com`), using your token, to read the repos, branches, workflow runs and jobs on your boards. GitHub's [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) applies.
- **AWS** (Amplify's regional endpoints), using your key, to read the Amplify apps, branches and jobs on your boards. To find the apps that build your rows' repos, it lists the apps in every region that has Amplify Hosting under each key a board reads with, hourly (the same lists the editor shows when you add an app). So the answers kept for up to 24 hours include the names and repository URLs of every Amplify app those keys can list, not only the apps on your boards. The [AWS privacy notice](https://aws.amazon.com/privacy/) applies.

These calls go **directly** from your browser to GitHub and AWS. fooboard does not proxy, see or keep them.

**The demo** talks to neither: its GitHub and AWS are simulated inside the page, and it sends no request to them or anyone else. Its demo tokens and keys, and anything you change in it, stay in the tab's memory until you reload or leave; only zoom and density are saved, as for any board.

## Links and sharing

Links to X, GitHub and other sites are ordinary links: nothing is sent until you follow one, and then that site's own privacy policy applies. _Share_ uses your device's share menu or your clipboard; fooboard doesn't see what you do with them.

## Your credentials are your responsibility

Anyone with access to your browser profile can read what is stored in it, including remembered credentials. Use read-only credentials scoped to what the board needs, as the [credentials guide](./README.md#credentials) explains, and revoke them when you're done.

## Removing your data

- _Forget_ removes one credential from this browser.
- Unticking _Remember on this device_ on a credential removes its stored copy and what was read with it, in every open fooboard tab: a token or key kept for the tab only leaves nothing on the device, neither the secret nor the answers read with it. If the browser won't let fooboard remove the copy, fooboard says so and asks you to use _Reset_.
- Deleting a dashboard removes it, its view settings and its credentials from this browser.
- _Reset_ (in the menu) removes all of fooboard's data from this browser, and nothing else, in every open fooboard tab: dashboards, settings, credentials and the answers kept from GitHub and AWS. If the browser won't let it clear them, it says so, and no other tab reloads.
- Clearing this site's data in your browser's settings removes what is stored; credentials held in an open tab's memory go when the tab closes.

Removing data from fooboard does not revoke credentials at GitHub or AWS: [revoke them there](./README.md#revoking-a-credential) too.

## Children

fooboard is a developer tool, not directed at children.

## Changes

Changes to this page are made in the [public repository](https://github.com/karmaniverous/fooboard), where its history is visible. The date at the top shows the latest version.

## Contact

Questions: [open an issue](https://github.com/karmaniverous/fooboard/issues).
