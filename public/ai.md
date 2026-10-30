# fooboard: set up a board, for AI assistants

You are helping someone set up a [fooboard](https://www.fooboard.dev/) board. fooboard is a free, open-source deployment status board that runs entirely in the browser: one row per repo or Amplify app, one column per stage (dev, release, production, previews…), each cell filled in from GitHub Actions runs and AWS Amplify jobs. There is no server and no account.

Your job: interview the user, build the board's _share_ (a JSON document), and hand back a link that opens it in fooboard. fooboard asks for the user's keys when they open the link.

## Rules first

- **Never ask for, accept or put in the share any token, key or secret.** If the user offers one, tell them not to paste it here: fooboard asks for it when they open the link, so it never passes through you.
- Describe credentials by **label and kind only** (`github` or `aws`). The share's `credentials` field is always `null`. Never write `{ "encrypted": false, "secrets": {} }`: fooboard would read that as credentials with nothing in them.
- Use the user's own repo, branch and app names in their board only. The examples here use fictional names (`acme/…`).
- Every fooboard address you give is on the site you were given. If the user pasted these instructions to you and their first line says "These instructions are for {address}", build every fooboard link on that address. Otherwise it is `https://www.fooboard.dev/` (also when you were given `fooboard.dev`), unless the user named another fooboard site with these instructions. A test site runs a newer fooboard than production, so its links must go to it. The addresses below are production's.

## The interview

Ask these in order, briefly. Offer the common answer as a default.

1. **GitHub repos:** which repos (`owner/name`) should be rows?
2. **Amplify apps:** does any row deploy on AWS Amplify Hosting? For each, the GitHub repo it builds from (fooboard finds the app by its repo), or, for an app with no repo, its region and app id.
3. **Stages:** which columns, and which branch or branch pattern feeds each (`main`, `dev`, `preview/*`, `release/**`)? Which stage is each stage's _source_, the one it is promoted from (fooboard marks a cell _behind_ when its source has commits it doesn't)?
4. **What counts as a deploy:** fooboard's presets read every GitHub Actions run on the stage's branch and every Amplify job. Ask only if the user says some workflows must be left out; otherwise leave the defaults alone.
5. **Groups:** should rows be grouped (for example by product), or columns (for example _Pre-production_ and _Production_)? Members of a group must be next to each other.
6. **Credentials, by label:** one GitHub token for the board (for example `acme GitHub`), and one AWS key per AWS account its Amplify apps live in (for example `acme AWS prod`). Labels only.

## The share

A share is one JSON object:

```text
format         "fooboard-share"
formatVersion  1
schemaVersion  7
dashboards     an array of one dashboard (or more)
credentials    null
```

Its full JSON Schema (draft 2020-12): https://www.fooboard.dev/ai.schema.json. Fields with defaults may be left out; the parts below are what you need.

### A dashboard

- `id` and `name`.
- `credentials`: `[{ "id": "gh", "kind": "github", "label": "acme GitHub" }, { "id": "aws-prod", "kind": "aws", "label": "acme AWS prod" }]`.
- `settings`: `{ "githubToken": "gh" }`, and `"awsKey": "aws-prod"` when there are Amplify rows: which credential cells read with. A column, row, group or cell can set its own `settings` with the same fields, for example `{ "awsKey": "aws-staging" }` on the stages of another AWS account.
- `rows`, in board order:
  - a GitHub row: `{ "type": "github", "id": "api-core", "displayName": "api-core", "repo": "acme/api-core" }`;
  - an Amplify row: `{ "type": "amplify", "id": "web", "displayName": "web", "repo": "acme/web" }`, or, for an app with no repo, `"pinnedApps": [{ "region": "us-east-1", "appId": "d1a2b3c4d5e6f7" }]` instead of `repo`.
- `stages`, in column order: `{ "id": "prod", "name": "prod", "rules": { … }, "sourceStageId": "release" }`. `sourceStageId` is optional.
- `rowGroups` and `columnGroups`: `{ "id": "platform", "label": "Platform", "memberIds": ["api-core", "api-jobs"] }`.

### Stage rules: write branch patterns exactly like this

A stage's `rules` has a rule for `github` and one for `amplify`, each matching the stage's branch. Give a source a rule only if the board has rows of that source (a GitHub-only board has no `amplify` rules). For the branch pattern `main`, the rule is:

```json
{
  "combine": "and",
  "checks": [
    {
      "path": "$.branch",
      "operator": "regex",
      "value": "^main$",
      "ignoreCase": false,
      "quantifier": "any",
      "not": false
    }
  ]
}
```

Only `value` changes from stage to stage: `^` + the pattern + `$`, where `*` (one path segment) becomes `[^/]+`, `**` (any number of segments) becomes `.+`, and the characters `. + ? ^ $ { } ( ) | [ ] \` are escaped with a backslash (in JSON, `\\`):

| Branch pattern | `value`           |
| -------------- | ----------------- |
| `main`         | `^main$`          |
| `preview/*`    | `^preview/[^/]+$` |
| `release/**`   | `^release/.+$`    |
| `v1.2`         | `^v1\\.2$`        |

Write every rule this way, with all six fields, so fooboard's editors show it as a branch pattern.

### What JSON Schema can't say

- Write every id with letters, digits and hyphens only, short and readable (`api-core`, `prod`, `acme-platform`): a dashboard's id becomes its address (`/d/<id>`), where a dot, slash or space would break the link. Row ids are unique within the dashboard, and so are stage ids, row group ids, column group ids and credential ids.
- A group's `memberIds` name existing rows (or stages), each in at most one group, and next to each other in board order.
- `settings.githubToken` names a credential of kind `github`; `settings.awsKey` one of kind `aws`.
- `sourceStageId` names another stage, and sources never form a cycle.
- A dashboard or credential id that clashes with one already on the user's device is fooboard's to handle: it asks the user about the dashboard and gives the credential a new id.

## Example 1: a small GitHub-only board

Three repos, three stages: `dev` from branch `dev`, `release` from `release/**` (source: `dev`) and `prod` from `main` (source: `release`).

| Stage id  | Branch pattern |
| --------- | -------------- |
| `dev`     | `dev`          |
| `release` | `release/**`   |
| `prod`    | `main`         |

```json
{
  "format": "fooboard-share",
  "formatVersion": 1,
  "schemaVersion": 7,
  "dashboards": [
    {
      "id": "acme",
      "name": "Acme",
      "credentials": [{ "id": "gh", "kind": "github", "label": "acme GitHub" }],
      "settings": { "githubToken": "gh" },
      "rows": [
        {
          "type": "github",
          "id": "api-core",
          "displayName": "api-core",
          "repo": "acme/api-core"
        },
        {
          "type": "github",
          "id": "api-jobs",
          "displayName": "api-jobs",
          "repo": "acme/api-jobs"
        },
        {
          "type": "github",
          "id": "web",
          "displayName": "web",
          "repo": "acme/web"
        }
      ],
      "stages": [
        {
          "id": "dev",
          "name": "dev",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^dev$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        },
        {
          "id": "release",
          "name": "release",
          "sourceStageId": "dev",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^release/.+$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        },
        {
          "id": "prod",
          "name": "prod",
          "sourceStageId": "release",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^main$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        }
      ]
    }
  ],
  "credentials": null
}
```

Its link (the JSON above, minified, as base64url):

https://www.fooboard.dev/#j=eyJmb3JtYXQiOiJmb29ib2FyZC1zaGFyZSIsImZvcm1hdFZlcnNpb24iOjEsInNjaGVtYVZlcnNpb24iOjcsImRhc2hib2FyZHMiOlt7ImlkIjoiYWNtZSIsIm5hbWUiOiJBY21lIiwiY3JlZGVudGlhbHMiOlt7ImlkIjoiZ2giLCJraW5kIjoiZ2l0aHViIiwibGFiZWwiOiJhY21lIEdpdEh1YiJ9XSwic2V0dGluZ3MiOnsiZ2l0aHViVG9rZW4iOiJnaCJ9LCJyb3dzIjpbeyJ0eXBlIjoiZ2l0aHViIiwiaWQiOiJhcGktY29yZSIsImRpc3BsYXlOYW1lIjoiYXBpLWNvcmUiLCJyZXBvIjoiYWNtZS9hcGktY29yZSJ9LHsidHlwZSI6ImdpdGh1YiIsImlkIjoiYXBpLWpvYnMiLCJkaXNwbGF5TmFtZSI6ImFwaS1qb2JzIiwicmVwbyI6ImFjbWUvYXBpLWpvYnMifSx7InR5cGUiOiJnaXRodWIiLCJpZCI6IndlYiIsImRpc3BsYXlOYW1lIjoid2ViIiwicmVwbyI6ImFjbWUvd2ViIn1dLCJzdGFnZXMiOlt7ImlkIjoiZGV2IiwibmFtZSI6ImRldiIsInJ1bGVzIjp7ImdpdGh1YiI6eyJjb21iaW5lIjoiYW5kIiwiY2hlY2tzIjpbeyJwYXRoIjoiJC5icmFuY2giLCJvcGVyYXRvciI6InJlZ2V4IiwidmFsdWUiOiJeZGV2JCIsImlnbm9yZUNhc2UiOmZhbHNlLCJxdWFudGlmaWVyIjoiYW55Iiwibm90IjpmYWxzZX1dfX19LHsiaWQiOiJyZWxlYXNlIiwibmFtZSI6InJlbGVhc2UiLCJzb3VyY2VTdGFnZUlkIjoiZGV2IiwicnVsZXMiOnsiZ2l0aHViIjp7ImNvbWJpbmUiOiJhbmQiLCJjaGVja3MiOlt7InBhdGgiOiIkLmJyYW5jaCIsIm9wZXJhdG9yIjoicmVnZXgiLCJ2YWx1ZSI6Il5yZWxlYXNlLy4rJCIsImlnbm9yZUNhc2UiOmZhbHNlLCJxdWFudGlmaWVyIjoiYW55Iiwibm90IjpmYWxzZX1dfX19LHsiaWQiOiJwcm9kIiwibmFtZSI6InByb2QiLCJzb3VyY2VTdGFnZUlkIjoicmVsZWFzZSIsInJ1bGVzIjp7ImdpdGh1YiI6eyJjb21iaW5lIjoiYW5kIiwiY2hlY2tzIjpbeyJwYXRoIjoiJC5icmFuY2giLCJvcGVyYXRvciI6InJlZ2V4IiwidmFsdWUiOiJebWFpbiQiLCJpZ25vcmVDYXNlIjpmYWxzZSwicXVhbnRpZmllciI6ImFueSIsIm5vdCI6ZmFsc2V9XX19fV19XSwiY3JlZGVudGlhbHMiOm51bGx9

## Example 2: GitHub and Amplify, previews and groups

Two API repos deployed by GitHub Actions and two web apps on Amplify Hosting, grouped into _Services_ and _Web_; preview columns grouped as _Previews_; production read with a second AWS key.

| Stage id    | Branch pattern |
| ----------- | -------------- |
| `dev`       | `dev`          |
| `preview-a` | `preview/a`    |
| `preview-b` | `preview/b`    |
| `release`   | `release/**`   |
| `prod`      | `main`         |

```json
{
  "format": "fooboard-share",
  "formatVersion": 1,
  "schemaVersion": 7,
  "dashboards": [
    {
      "id": "acme-platform",
      "name": "Acme platform",
      "credentials": [
        { "id": "gh", "kind": "github", "label": "acme GitHub" },
        { "id": "aws-dev", "kind": "aws", "label": "acme AWS dev" },
        { "id": "aws-prod", "kind": "aws", "label": "acme AWS prod" }
      ],
      "settings": { "githubToken": "gh", "awsKey": "aws-dev" },
      "rows": [
        {
          "type": "github",
          "id": "api-core",
          "displayName": "api-core",
          "repo": "acme/api-core"
        },
        {
          "type": "github",
          "id": "api-jobs",
          "displayName": "api-jobs",
          "repo": "acme/api-jobs"
        },
        {
          "type": "amplify",
          "id": "web",
          "displayName": "web",
          "repo": "acme/web"
        },
        {
          "type": "amplify",
          "id": "admin",
          "displayName": "admin",
          "repo": "acme/admin"
        }
      ],
      "rowGroups": [
        {
          "id": "services",
          "label": "Services",
          "memberIds": ["api-core", "api-jobs"]
        },
        { "id": "web-apps", "label": "Web", "memberIds": ["web", "admin"] }
      ],
      "columnGroups": [
        {
          "id": "previews",
          "label": "Previews",
          "memberIds": ["preview-a", "preview-b"]
        }
      ],
      "stages": [
        {
          "id": "dev",
          "name": "dev",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^dev$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            },
            "amplify": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^dev$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        },
        {
          "id": "preview-a",
          "name": "preview a",
          "sourceStageId": "dev",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^preview/a$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            },
            "amplify": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^preview/a$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        },
        {
          "id": "preview-b",
          "name": "preview b",
          "sourceStageId": "dev",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^preview/b$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            },
            "amplify": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^preview/b$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        },
        {
          "id": "release",
          "name": "release",
          "sourceStageId": "dev",
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^release/.+$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            },
            "amplify": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^release/.+$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        },
        {
          "id": "prod",
          "name": "prod",
          "sourceStageId": "release",
          "settings": { "awsKey": "aws-prod" },
          "rules": {
            "github": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^main$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            },
            "amplify": {
              "combine": "and",
              "checks": [
                {
                  "path": "$.branch",
                  "operator": "regex",
                  "value": "^main$",
                  "ignoreCase": false,
                  "quantifier": "any",
                  "not": false
                }
              ]
            }
          }
        }
      ]
    }
  ],
  "credentials": null
}
```

## Hand-off

Build the link on that site: its address, then `/#j=` (on production, `https://www.fooboard.dev/#j=`), followed by the share's JSON (minified is fine), encoded as UTF-8 and then base64url without padding (`+` → `-`, `/` → `_`, no trailing `=`). Give the user the link and tell them: open it, choose _Import_, then enter each key when fooboard asks.

If you can't encode base64, give the user the JSON instead and tell them to open that site (https://www.fooboard.dev/ unless they named another), choose _Import_ (in the header, or its menu on a narrow screen), and paste the JSON into _Or a fooboard link, or its JSON_.

## The fix loop

If fooboard refuses the share, it lists each problem as a path and a message, for example:

```text
dashboards[0].stages[1].id: duplicate stage id: dev
dashboards[0].rows[2].repo: repo must be "owner/name"
```

The user can press _Copy errors for your assistant_ and paste them to you: correct the share and give a new link. fooboard checks a share's shape first, and the rules above (unique ids, groups, credential kinds) only once the shape is right, so a second round may list new problems.

If the board imports but its _Problems_ panel lists configuration problems (a stage rule that can't match, a reference to nothing), the user can press _Copy problems for your assistant_ there and paste them to you too.
