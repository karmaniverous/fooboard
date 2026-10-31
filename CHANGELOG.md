# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-10-31

### 🚀 Features

- *(app)* Show Page not found for addresses with no route
- *(header)* Release notes links to the releases page; drop the bundled What's new
- *(board)* Board actions as icon buttons named and tooltipped by their panels
- *(first-run)* The note shows Problems' and Edit dashboard's icons before their names, as for Unmapped runs
- *(engine)* Boost a row's polling when the user shows interest in it (spec 0.2.0 §3.H)
- *(board)* Boost a row on a click, a key or a dwell, and on opening its settings (spec 0.2.0 §3.H)
- *(config)* Dismissed unmapped-run patterns, data model v7 (spec 0.2.0 §3.I)
- *(unmapped)* Dismiss unmapped runs by pattern, show and undo (spec 0.2.0 §3.I)
- *(board)* A dot on the key marks Add a credential (Decision 105)
- *(hosting)* Serve /ai from /ai.md as markdown, with a Link header on every path (spec 0.2.0 §3.J)
- *(share)* Read #j= links and pasted JSON, refuse with field-level errors, ask for keys on arrival (spec 0.2.0 §3.J)
- *(ai)* Add Set up with an AI assistant to the header, menu, footer and home page (spec 0.2.0 §3.J)
- *(ai)* Publish /ai, /ai.schema.json and /llms.txt, with discovery pointers (spec 0.2.0 §3.J)
- *(ai)* A styled loading screen carrying the assistant pointer (Decision 106)
- *(ai)* The AI dialog uses the site it runs on; Copy instructions off production (Decision 107)
- *(docs)* Npm run screenshots retakes every README screenshot from the build (R4)
- *(ai)* The AI dialog's two rows and icon copy buttons (Decision 108, R4)
- *(budgets)* Battery readings survive a reload (Decision 109, R4)

### 🐛 Bug Fixes

- *(engine)* Window hint only where a matching branch's own read came back full
- *(persist)* Write the cache at once after a removal
- *(engine)* Custom Amplify rules keeping the built-in branch mapping get the per-branch window hint
- *(first-run)* A saved dashboard at an unknown step shows Page not found
- *(build)* ZodJitless goes in zod's chunk, so it runs before any shared app chunk
- *(persist)* A removal heard while the cache is restored is written as soon as the tab takes the persisting lock
- *(test)* The timeout scan takes a factor as a name only if it is one, else a decimal literal of at least 1, so .5 and 0x0 are refused
- *(unmapped)* Name the preset choice Which runs to dismiss
- *(unmapped)* Count only the entries shown in the Dismiss form's match count
- *(unmapped)* Focus the restored entry's Dismiss button after Undo
- *(unmapped)* Show Show dismissed pressed as filled with a check, unlike its hover
- *(engine)* Never let a dwell's restart postpone the running step's poll
- *(engine)* End a deferred restart whose poll lands 75 s or more after the dwell
- *(engine)* Judge a dwell's restart at the row's budget pace
- *(board)* Focus the entry Undo restores only if it is shown
- *(hosting)* Serve the Amplify rewrites and headers from npm run dev too, so /ai works locally
- *(ai)* Read /ai.md as a virtual module, since Vite refuses imports from public/
- *(budgets)* A battery's reading moves only forward (Decision 109, R4)
- *(engine)* Opening a board polls every row at once (Decision 109, R4)
- *(share)* A not-JSON message gives only the error's position (#61 review B1)
- *(share)* A pasted percent-encoded #j= link ends at its closing brace (#61 review B2)
- *(share)* A refusal's dark red is the theme's destructive token (#61 review B3)
- *(share)* Refused pasted JSON is called a share, not a link (#61 review B4)
- *(pages)* An import replacing the open board lands on it afresh, asking for its key (#61 review B6)
- *(ai)* Copied instructions name their site, and /ai.md builds links there (#61 review A-S1, B)
- *(budgets)* Loading deletes the readings of credentials not kept (#61 review A-N2)
- *(import)* Every import landing opens the imported dashboard afresh, asking for a key or not (#61 second review 1)
- *(share)* A stray malformed escape after a pasted link no longer stops the link decoding (#61 second review 3)
- *(hosting)* Read the console's redirects in amplify-rewrites.json (Decision 110)
- *(hosting)* Read 301 and 302 redirects only, refusing 307 by name
- *(hosting)* Accept a condition on any rule; local servers skip conditioned rules
- *(hosting)* Refuse a full-URL redirect source with a path or query
- *(hosting)* Refuse a redirect to itself
- *(hosting)* Carry the query string over on a local path redirect

### 🔨 Refactoring

- Remove unused branchPatternPrefix and correct stale module comments
- One board-action panel and label module, release-notes state in its own hook; docs agree
- *(pages)* The home and dashboard addresses named once in pages/paths; Page not found asserted inside the shell
- *(pages)* The home, demo and first-run addresses named once, in the header and the test routers too
- *(board)* The Problems and Notes names and counted labels come from actionLabels, in the board and the first-run note
- Share the dismissal reason choices and text fields; read completions only for boosted rows; unexport internals
- *(engine)* Drop attend's redundant row check; test that a destroyed board polls nothing
- *(unmapped)* Move focus-to-title after the last dismissal to DashboardView, on the panel's close
- *(share)* Keep repeatedIds private to the envelope
- *(hosting)* Move the rules' parser to vite/hostingRules.ts

### ⚡ Performance

- *(engine)* Poll every root in one cache pass, a shared root once (#61 review A-N1)

### 📚 Documentation

- *(readme)* Live at fooboard.dev, shorter paragraphs, real screenshots
- *(readme)* Add the live-demo badge
- *(readme)* Restore the characters a Windows-1252 round trip garbled; test the docs for mojibake
- *(readme)* Follow-on bullets nest under their item, so each list has the items its lead-in names
- *(readme)* Lead-in labels match their items
- *(readme)* Hero and settings-editor alt text say what the screenshots show
- *(screenshots)* Compress the PNGs losslessly (oxipng -o 4 --strip safe)
- *(readme)* Say which custom Amplify rules keep the app-wide window hint
- *(privacy)* The release-notes version is stored on a first visit and again after Reset
- *(build)* Reflow vite.config.ts's header comment
- Interaction poll boost, dismissing unmapped runs, data model v7, board actions; e2e and demo tests
- *(config)* Remove an orphan doc comment
- *(readme)* Note that another tab's save can drop a dismissal and an old tab can't save until reloaded
- *(readme)* A dwell's restart keeps a poll already due sooner
- *(test)* A literal TAB for title, and over-long doc lines re-wrapped (PR #60 final review #2, #3)
- Set up with an AI assistant, #j= links, field-level errors, keys on arrival, hosting rules and headers (spec 0.2.0 §3.J)
- *(screenshots)* Retake every README screenshot, light and dark, with the AI nav item (Decision 102)
- *(ai)* Say where Import is on a narrow screen
- *(privacy)* A battery reading also goes with its credential or dashboard (#61 review A-N3)
- *(vite)* The instructions chunk loads on every site (#61 review A-N4, B7)
- *(ai)* Ids are letters, digits and hyphens, since a dashboard's becomes its address (#61 review A-N5)
- *(privacy)* Effective 30 October 2026, the 0.2.0 release (R4)
- *(contributing)* Screenshot reruns can differ by a few antialiased pixels (#61 second review)
- *(hosting)* The hidden-file build check covers rewrites only

### 🧪 Testing

- No Playwright timeout under 30 s; the release runs e2e on a server of its own
- *(e2e)* The timeout scan checks every Playwright timeout option and setter, and allows only the floor or a multiple of it
- *(persist)* The late-granting locks keep the shared locks' type
- *(build)* ManualChunks in its own module, with a test that zodJitless shares zod's chunk
- *(pages)* Test routers start at DEMO_PATH and HOME_PATH, as paths.ts says
- *(e2e)* Undo focuses the restored entry's Dismiss button
- *(components)* A side panel's close handler keeps focus off the trigger
- *(engine)* A dwell never postpones the poll of a row's token under its share (PR #60 final review #1)
- Cover #j= links, field-level errors, keys on arrival, the AI dialog and copying for an assistant (spec 0.2.0 §3.J)
- *(e2e)* Serve /ai and point to it, import /ai's #j= example and pasted JSON, axe the AI dialog and a refusal (spec 0.2.0 §3.J)
- Kill surviving mutants (literal % in raw #j= JSON, the board's copy of config problems); refactor(hosting): one path character class
- *(e2e)* Say what the shell suite checks of the AI dialog (Decision 107)
- *(ai)* The AI dialog's icon buttons show their names as tooltips on hover too (R4)
- *(pages)* A reload carries the state history holds, so it proves keys aren't asked twice (#61 review B5)
- *(hosting)* Add a redirect by parsing the committed rules, not by regex

### 🎨 Styling

- *(board)* Batteries first; board actions ghost, emphasis by icon colour (Decision 104)
- *(unmapped)* Show Show dismissed's pressed state

### 🔧 Build & CI

- *(screenshots)* Compress with WebAssembly oxipng (@jsquash/oxipng), dropping oxipng-bin and its install script (#61 second review 2)

### 💼 Other

- Updated rewrites
## [0.1.0] - 2026-10-28

### 🚀 Features

- Scaffold fooboard as a static Vite + React app
- *(domain)* Config schema, presets and migration (PR A step 1)
- *(domain)* Branch pattern and match-test matching primitives (PR A step 2)
- *(domain)* GitHub and Amplify cell derivation, staleness, unmapped reasons (PR A step 3)
- *(github)* GitHub adapter and spike page (step 4)
- *(amplify)* Amplify provider (step 5)
- *(demo)* Demo board and demo providers (step 6)
- *(engine)* Board engine and poll scheduler (step 7)
- *(config)* Dashboard default credentials with per-row overrides
- *(storage)* Local persistence (step 8)
- *(brand)* Adopt the green/gray logo and favicon
- *(board)* Board rendering and Try the demo (step 9)
- *(board)* Fit, zoom and row height (step 10)
- *(board)* Board chrome and tagline (step 11)
- *(credentials)* Credential entry, guide and saved dashboards (step 12)
- *(editors)* Create and edit dashboards (step 13)
- *(board)* Unmapped runs panel with Add test (step 14)
- *(board)* C-13 board layout (step 11a)
- *(board)* Icon-only rung, in-cell packing, transparent badges
- Row and column groups with branch-pattern overrides (schema v2)
- Add override for unmatched branches; Follow and Share
- *(editors)* Drag and move across group edges; branch lists in override editors
- Pinned app header, theme choice and footer
- A battery for every GitHub token from the start
- Framed column groups with pinned, left-aligned labels
- Status sets, documents and bundled presets (statuses core, part 1)
- Relevant jobs per status set (option A)
- Status-set references, resolution and v3 migration (statuses core, part 2)
- The board shows configurable statuses (part 3)
- Summary chips in their status set's order
- Status-test form model
- Status-set editor
- Status-set choices for row groups, rows and cells
- Add a status for a run no status matches
- Board legend; README for status sets
- Rule checks (JSONPath, glob, regex, exists)
- Source rules, built-in rules and cell placement
- Status sets on rules; data model v4
- Placement rules replace branch patterns and row keys
- Source rules in the dashboard; Sources tab
- Rule problems, marked on the board
- Unmapped reasons per row; Add rule
- Rule preview and field picker
- Stage and row rule editors
- Translation editor; only items where
- Unknown rule references tolerated as problems; consistency check covers source rules, unchecked paths and unused sources
- Amplify apps read once per poll across rows; unmapped Amplify jobs; Amplify window hint
- Problem markers open the editor at the item; Customise from problems; Add rule drafts checks; overrides as rules; field picker tree and raw previews
- Editor lists collapse to their headers, one item open at a time
- Borders reach 3:1 and muted text 4.5:1 in both themes, checked by a test
- Keys, cell statuses, column groups and Unknown runs collapse like the other lists
- Animated drag reordering on dnd-kit
- *(rules)* Hint to test a field inside when a glob or regex path finds an object or array (N1c)
- *(query)* Fetch layer, per-credential limiter, query keys and client
- *(engine)* Board model deriving per row from the query cache
- *(config)* Data model v5 with requests in flight
- *(board)* Provisional and refreshing marks, query provider wiring
- *(query)* Only a root read's first load and editor lookups jump the queue
- Add a demo run after load so the demo shows the refreshing dot
- List Amplify apps across regions on apps queries; optional repo on Amplify rows
- All-regions Amplify app picker; add apps without a GitHub repo
- Full commit message and copyable SHA in cell detail; empty order key counts as missing
- Name an Amplify source whose AWS key can't be resolved in a problem
- Row tooltip and editor summary for an Amplify row without a repo
- One demo commit message has a body, shown in full in the detail sheet
- Skip a network failure in an opt-in region when listing Amplify apps
- The problem for an Amplify source whose AWS key can't be resolved can be dismissed
- *(board)* Space on a focused cell opens its detail sheet
- *(board)* A status cell without a link opens its sheet as a button
- *(persist)* Persisted query cache, removals across tabs and Reset
- *(panels)* Pin the header over a scrolling body in every side panel and the cell detail sheet
- *(config)* Data model v6 with the settings object and pinned apps
- *(settings)* One resolver over the fixed lattice, read per cell
- *(editors)* SettingsEditor at every level of the dashboard editor
- *(amplify)* Skip regions by the app search rules and keep its lists
- *(domain)* Repo matching, pin changes, problem actions and No app
- *(engine)* Read Amplify apps found by repo
- *(ui)* No app cells, Pin and Unpin in problems, the picker by repo
- *(credentials)* Copy AWS policy per key
- *(amplify)* Cancel an opt-in region's app search after OPT_IN_REGION_TIMEOUT_MS and skip it as unreachable
- *(board)* Settings gears and the settings popup (N3d)
- *(board)* One shared cell gear; no header gears under 640 px (Decision 60)
- *(transport)* Send every reader through an injected transport
- *(demo)* Simulate GitHub and Amplify from a declarative scenario
- *(demo)* Play the acme scenario on the real board, with its editor
- *(credentials)* Collapse the credentials panel, one credential open at a time
- *(board)* Group frames and gutters drawn once (N5)
- *(credentials)* [**breaking**] Remove the token expiry warning
- *(board)* No board text under 13 px on a phone
- *(board)* Cut a long row-group label before the first frame line on a phone
- *(board)* No board text or summary chip under 13 px on any screen
- *(share)* Share envelope, passphrase encryption, links and import planning
- *(share)* Share / Export and Import dialogs, links opening on load
- *(share)* Updating a board by importing it again
- *(share)* Replace hint describes its choice; tab-only hint tells the truth
- *(share)* Import from a pasted link as well as a file
- First run (N7)
- *(share)* Ask before replacing a secret that differs from this device's
- *(hosting)* Amplify build spec, CSP and security headers, served by vite preview
- *(app)* What's new, the error screen with Report an issue, and the version in the menu
- *(board)* Comma hint on a focused badge; commit counts agree with their noun (Decision 74)
- *(perf)* The reload target bounds the median reload (Decision 74 item 3)
- *(board)* Drop double-tap zoom on touch screens

### 🐛 Bug Fixes

- *(domain)* Determining job supplies the cell's phase label
- *(domain)* Address Copilot review on PR A
- *(github)* Address Copilot review on the HTTP client and reader
- *(amplify)* Address Copilot review on paging and repeated reads
- *(engine)* Address Copilot review on the board engine
- *(board)* Labelled row dividers draw their line above the group label
- *(board)* Address Copilot review on the board
- Address Copilot review on credentials and editors
- *(board)* Unwrap cells by truncating branch and message in every format
- *(board)* Zoom range, percentage zoom label, badge after the commit
- *(board)* Scroll the grid with the main window; remove the mini-map
- *(board)* 10% zoom steps, height-budget zoom, pinned chrome, review fixes
- *(board)* Measure the grid area from the window; size the badge slot from actual badges
- *(board)* Zoom-in budget relative to the board at 100%; narrower row names on phones
- *(board)* Coloured badges, centred icons, reset icon, left-wrapping counter
- *(board)* Separate diverged summary chip
- *(board)* Compact toolbar, centred headers, centre wrapped header and toolbar
- *(board)* Centre the summary chips between title and counter
- *(board)* Space-between header and toolbar, battery budget meter, ringed chips, non-modal menu
- *(board)* Wide and narrow header layouts, density icons, pinned row-group names
- *(board)* Measured header layout, chip tooltips, home page fits narrow screens
- *(ui)* Selects fit their options; show/hide secrets; clearer credential choices
- Gaps from the spec review (dark theme, full run window, demo coverage)
- Address Copilot review on groups, overrides, migration and sharing
- Address Copilot review on #10
- Address second Copilot review on #10
- Pin column group labels and close their frame gap
- Copilot review on configurable statuses
- Amplify applies its source rule's keep; README to the code; coverage
- Branch * needs a character; newer-version refusal wording; badges need a commit
- Suggested and picked paths escape quotes and backslashes in key names
- Only items where writes paths that parse for regex characters, backslashes and non-identifier keys
- Key a cell's lead so React doesn't warn when an item shares its line
- Strip byte-order marks and repair a garbled section sign
- A translation's value can be cleared to empty text
- Share one glob translation between glob checks and only items where
- Label each source's branch pattern when a stage's patterns differ
- Identify unmapped Amplify jobs by the branch Amplify read
- List credentials by name, case-insensitive, ties by id
- Copy a working account-wide AWS policy before apps are picked, drop GetJob
- Choose the token for a new GitHub row and list each credential once
- Collapsible lists follow focus, keep key identity and open statuses added for unknown runs
- *(ci)* Prod PR guard runs on pull_request_target so a PR can't replace it
- *(ci)* Rerun CI when a PR is retargeted, and test the workflow config
- *(perf)* Hold reader wrappers weakly so fresh readers aren't retained
- *(perf)* Attribute Amplify reads by their effective AWS key too
- *(perf)* Count a closed board's late reads as stray for the next board
- Current-version defect fixes (N1a)
- *(credentials)* Close every tab before clearing site data; forget drops the tab copy first
- *(engine)* Show a row that fails to derive as Error with a dismissable problem
- Keep adapter error names through minification
- Show only the message on error cells, not the error's class name
- Mark cells refreshing only while their reads are fetching or overdue
- Show the refreshing dot for a fetch only once it has run longer than 300 ms
- Refuse a malformed v4 dashboard list instead of migrating it to an empty configuration
- Freeze the v5 requests-in-flight default inside the v4 to v5 migration
- Request a run's jobs for the attempt they are cached under
- Mount a query environment's client only while its provider is mounted
- Forget a token's budget when its secret is replaced or forgotten
- Copy status in the sheet's own font, not the SHA's
- *(board)* Drop copy feedback when a poll swaps the sheet's commit
- *(persist)* Keep only answers read with the remembered secret, coordinate Reset, report a refused lock
- *(panels)* Focus the selected tab itself on open (a browser doesn't pass a tab list's focus on)
- *(config)* Refuse a malformed v5 field instead of migrating without it
- *(config)* Merge a per-source v6 setting with its v5 value source by source
- *(editors)* Warn that a column group's settings go with its last stage
- *(editors)* Keep a pin's key control mounted while its key changes
- *(editors)* Don't pin the same app under the same key twice
- *(engine)* Judge unmapped runs against only the cells reading with each token
- *(ui)* Tell apart same-named apps in the several-match problem
- *(amplify)* Skip an opt-in region's untyped 403 in the app search
- *(board)* Put a row group's label and gear in a grid row
- *(settings)* Give an unlabelled group's origin link the link colour
- *(board)* Self-review of the shared cell gear
- *(demo)* Keep problem dismissals in the demo for the visit
- *(demo)* Promote at whole milliseconds; name every request the simulator refuses
- *(credentials)* Keep a secret for this tab only even when the device won't remove its copy
- *(credentials)* Drop data when remembering over another tab's secret; say what a refused removal left
- *(board)* Keep group lines and pinned covers in forced colours
- *(perf)* The demo full-board target is 11 s (Decision 61)
- *(board)* Wrap the board header controls on narrow screens
- *(board)* Clip the toolbar's measuring copy so it never widens the page
- *(share)* Self-review findings R1 and R2
- *(first-run)* Visible labels, Back after step 1, stage preview read aloud
- *(share)* Say why a pasted link needs no trim; one test window
- *(share)* The secret questions are required radio groups; clearer intro (self-review)
- *(hosting)* 404 a malformed URL escape, validate header names, within returns undefined (self-review)
- *(board)* Keep a cell's tooltip over its badge and gear
- *(whats-new)* A side panel with a pinned header
- *(app)* Keep the error screen in the main landmark; clean links to the app's own pages
- *(board)* Native touch scrolling; grid height from the small viewport
- *(board)* Forget a pointer that ends off the grid; self-review fixes

### 🔨 Refactoring

- SOLID/DRY pass over the scaffold
- *(domain)* Use radash max; share the excluded-event check
- Before-review SOLID/DRY, radash and trivial-test pass for PR B
- Before-review pass for PR C
- Before-review pass for PR D
- SOLID/DRY pass over groups, overrides and inheritance
- Split the board toolbar; tests and docs for groups and sharing
- *(ui)* Build controls from the component library
- SOLID/DRY pass on the app header, footer and modals
- SOLID/DRY pass on configurable statuses; fill test gaps
- One provider module for the source list, type and labels
- The empty rule and unset-if-empty once, in domain/rules/always
- Typed source rules, reader limits and built-in ids as named constants; shared cells and row reasons across the GitHub and Amplify refreshers
- Shared JSONPath AST kinds, fresh ids and JSON helpers
- Name the board's rungs, cell text lengths and preview limits; tests assert against them
- Build editor item keys from edit targets
- Name unmapped reasons, empty-cell states and preset ids; replace two tests that couldn't fail
- Name the layout's sub-pixel slack
- Workflow listing uses GITHUB_PER_PAGE
- Record keys, conformed states and key paths named once in domain/model/keys; case folding shared in rules/path
- One branch-pattern regex, shared by branch rules and branch matching
- Bundled status colours, preset summary ids and job words named; presets built from presetRules over the key paths; a never rule for new statuses
- Name the compare subject limit; branch listing uses GITHUB_PER_PAGE
- One row-order rank in amplifyGroups
- Library controls in place of native selects, checkboxes and details
- *(perf)* SOLID/DRY and test review of the timing instrumentation
- Name the polling share and the v4 step; record the Amplify Retry-After check
- Share row problems, failed derivations, window hints, retry hints, HTTP statuses, get-or-create and the dev-aids gate
- Keep the dev-aids test module-local so the build folds it
- Unexport AMPLIFY_MAX_ATTEMPTS now only the reader uses it
- Share the demo's deploy-and-test jobs and stage run ids, and move runAt to the payload helpers
- FirstLine beside shortSha in cellView; listKey in the app list
- *(panels)* PanelSheetContent takes SheetContent's own prop types; name the drag test's item pitch
- *(sources)* One sourcesWithItems for the editor and the cell sheet
- *(editors)* Build the column group's place target with placeKey
- *(test)* One set of canned SDK credentials; say what the browser gets from me-south-1
- *(amplify)* Self-review of the opt-in time limit: say what the limit covers, use ListIn, narrow the test signal type
- Share the validated save, media queries, first tabbable and close button
- *(editors)* Share the searchable repo list and repo names
- Shared cell-tooltip test helpers; per-target median note; verdict helper (self-review)

### ⚡ Performance

- Load board and spike pages lazily and split vendor chunks, clearing the chunk-size warning
- Development-only timing instrumentation for the board (N1 baseline)
- *(engine)* Read the reverse compare only when the cell has commits its source lacks
- *(engine)* Read one cold candidate's jobs per stage at a time, from measurement

### 📚 Documentation

- Add AGENTS.md with standing rules for contributors and coding agents
- *(agents)* Touched code is the starting point for reviews
- README status reflects the domain core landing (PR A)
- *(agents)* Use radash instead of hand-rolled utilities
- *(agents)* Pre-push PR check must include merged and closed PRs
- *(agents)* Judge the pre-push check by the newest PR on the branch
- README as the user and credential guide; PRIVACY, TERMS, CONTRIBUTING
- README for rules (PR R), for review before code
- README for rules, review decisions folded in
- README for rules, second review folded in
- README for rules, third review folded in
- README for rules, fourth review folded in
- README for problem markers, Customise, Add rule drafts, rule overrides, field picker and Amplify unmapped
- README reader limits, window hint, keep default, previews, branch-pattern shortcut and data model version match the code
- Restore the section sign and drop a stray BOM in rules/branch
- README says the Problems button reads Notes (N) when there are only notes
- README describes the repo picker's token choice and the credential choice's default option
- README describes collapsible editor lists
- README lists every collapsing list
- README describes animated and keyboard drag reordering
- Prod guard bootstrap is through the first release PR, then required
- Loading, polling, errors, requests in flight and the battery
- Provisional and refreshing precision, what PRIVACY keeps, DEV_AIDS in production notes
- Update PRIVACY's effective date for the two new storage rows
- Say the refreshing dot also shows briefly while a poll is in flight
- Data model 5, unreadable boards left unchanged, battery and back-off reset on a credential change, explicit return types
- Say the GitHub schemas module also defaults omitted run attempts
- All-regions Amplify picker, apps without a repo, commit detail, unresolvable sources
- Opt-in regions' network failures and the dismissable unresolved-key problem
- Offer Reset and describe the persisted cache
- Kept answers are bound to the remembered secret; how Reset runs across tabs and fails
- *(panels)* Pinned panel headers in README and CONTRIBUTING; focus on open without preventScroll
- Settings, pinned apps and data model v6
- Where AWS keys and tokens are set; the unresolved-key problems; migration modules
- Apps found by repo, No app, the notes and Copy AWS policy per key
- Settings on the board
- The shared cell gear and phone header gears in README and CONTRIBUTING
- The simulated demo, its account, and the spikes' removal
- The collapsing credentials panel, and what a tab-only credential leaves
- Group frames and gutters in README and CONTRIBUTING
- The board's controls wrap on a narrow screen
- *(perf)* Name Decision 61 and keep the real cold target interim
- *(perf)* The cold target is final
- Rewrap the comments the expiry removal left ragged
- Sharing, files, links and passphrases in README, PRIVACY and TERMS
- *(readme)* Getting started walks through the first run
- *(hosting)* Three origins (dev, release, production) and main's deploy to dev.fooboard.dev
- *(hosting)* Production is served at www.fooboard.dev; the apex redirects there
- *(contributing)* The hosted sites, their branches and logins
- *(hosting)* Keep Amplify's domain redirects; replace only the default SPA rule
- *(board)* Where the cover's focus goes; controlHasFocus counts any focus
- *(readme)* The first release names its version (npm run release -- 0.1.0)

### 🧪 Testing

- Lint fixes in review regression tests
- Pre-review pass on docs, batteries and column frames
- Freeze PR S statuses as parity fixtures
- Cover unmapped Amplify jobs, the Unmapped panel, only items where and a custom source rule's reader
- Cover the Stages tab; build dashboard rule keys from edit targets
- Preload the lazy pages in the app shell test so it holds under coverage load
- DashboardPage wiring (problems and notes, Fix, Customise, Edit) over one page render helper
- CheckRow controls, problem dismissal and dashboard delete
- KeysEditor translations and keys; drop an unreachable empty-path fallback
- Lighter Sources tab test that no longer times out under coverage
- Cover the query layer, board model and data model v5
- Fix React act(...) warnings and fail tests that log one ([#23](https://github.com/karmaniverous/fooboard/pull/23))
- One request at a time at 1 in flight, reconnect refetch, idempotent v5 step
- Cover the GitHub API port, window hints, rule-steered rows, warm-cache refreshing and dev Devtools
- Kill mutation survivors in fetchers, board model, failedRow and requests in flight
- Cover the empty-region app list and the dashboard editor's save-error alert
- Cover nameless and id-less apps, toggling the repo question, unresolved sources' groups
- Row header tooltip for an Amplify row without a repo
- Hold and settle every promise a test starts
- *(panels)* Pinned header, tab order, focus on open, fix scrolling and drag autoscroll in the body
- *(editors)* A pin in another region is another app
- *(editors)* Branch discovery reads with the first token that has a secret
- Share the demo page's render timeout
- *(board)* Viewport gestures and the board width with gutters
- *(perf)* Prettier
- *(perf)* A missed demo full board is over 11 s
- *(board)* Every board text on a 390 px phone at rung 0 is 13 px or more
- Read named size classes, and pick badges by their text
- *(share)* Opening and pasting a share link have the same effect
- *(e2e)* Playwright smoke and accessibility tests under the served CSP; fix reduced motion and sheet contrast
- *(e2e)* Cross-engine fixes; docs
- *(e2e)* Hero screenshots; WebKit and Firefox fixes
- Keep the last version seen in a build with no release; Reload in e2e
- *(e2e)* Wait for the drop to settle; 15 s for expectations
- *(e2e)* Wait for late focus returns; retry a keyboard move the sensor missed
- *(e2e)* The phone test measures the board once every cell has filled in
- *(engine)* Freeze the clock in the refreshing tests so a slow fill can't age the data
- No timeout under 30 s (tests, hooks and waits)

### 🎨 Styling

- Gray app header and footer; quiet, consistent pressed toggles
- *(docs)* Format Markdown with Prettier and check it in lint

### 🔧 Build & CI

- Lint against native selects, checkboxes and details outside the wrappers
- Run the Playwright tests in Chromium

### ⚙️ Chores

- Before-review pass for PR B
- Lint unsafe type assertions and files over 300 lines
- *(perf)* Interim full-board targets, confirmed cold candidates and back-off (Decision 45)
- Require explicit return types on every export, test utilities included
- *(lint)* No floating promise in app code, not even with void
- *(lint)* Apply every rule to tests
- *(lint)* Apply the library-controls rule to tests in src/components
- Update copilot review instructions
- Reflow boardText's doc, name the test layout's text size once
- Lint and knip fixes

### 💼 Other

- Initial commit
