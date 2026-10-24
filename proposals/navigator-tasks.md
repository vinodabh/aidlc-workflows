# Navigator tasks

Product behavior: `proposals/navigator.md`.
Build decisions: `proposals/navigator-plan.md`.
Progress: this file.

- Each task has an id, a status (`pending`, `in progress`, or `done`), a slice, a done-when line, and the files it touches.
- At most one task is `in progress`.
- Continue the first Build task whose status is `pending` or `in progress`. Leave a `done` task as it is.
- Before editing code for that task, set it to `in progress`. In the same commit as the work, set it to `done`.
- If a later decision changes scope, update `proposals/navigator-plan.md` and the affected tasks in that same commit.

A fresh clone does not include `aidlc/active-space` or `aidlc/spaces/*/intents/active-intent`. Those cursors are per person. When AI-DLC is running for this build, `aidlc-state.md` in the intent record tracks workflow stages. This file tracks implementation tasks.

## Build

Work N1 through N11 in that order.

| Id | Status | Slice | Done when | Files |
| --- | --- | --- | --- | --- |
| N0 | done | Spec | The one-pager matches the approved product surface: `app/navigator/`, light and dark themes, Settings (appearance, workflow command, model controls), the next-action order, missing cursors, the bolt rule, Mob Elaboration, and the metrics caption. | `proposals/navigator.md` |
| N1 | done | 1 | `app/navigator` is a private package with its own `package.json`, `tsconfig.json`, and test script. Bun runs that test script. Root `typecheck`, `lint`, and `check` still point at the framework. | `app/navigator/package.json`, `app/navigator/tsconfig.json`, the test entry |
| N2 | pending | 1 | Parser tests pass on fixture trees: missing `aidlc/`, several open intents, the six checkbox states, blank `[Answer]:` tags, and the next-action order. | Parser and fixtures under `app/navigator/` |
| N3 | pending | 1 | The dev window opens a project, reopens a recent project, picks a space and intent, shows the state summary and stage documents, renders markdown with raw HTML off, copies the open document path, and keeps an unsaved draft across a debounced refresh. | Electron main, preload, and renderer under `app/navigator/` |
| N4 | pending | 1 | Settings offers Light, Dark, and System (System default). Both themes keep body text and the next-action control readable. The workflow-command path can be set, and the resolver tests cover a PATH hit, the Windows fallback, the Unix fallback, and a missing binary. Preferences stay in the Electron user-data directory. | Theme tokens, Settings, and the resolver under `app/navigator/` |
| N5 | pending | 2 | `aidlc person answer` and `aidlc person gate` accept a clean pipe and a clean terminal, and refuse an agent-host mark and a session override. The four caller tests pass. The guide section is in `docs/guide/12-cli-commands.md`. | `core/tools/` command modules and dispatcher, the presence tests, `docs/guide/12-cli-commands.md` |
| N6 | pending | 3 | A blank answer and a `[?]` gate call those commands over pipes. A missing or refused command leaves status and documents up and shows the reason. Windows smoke: open a project with an `aidlc/` record, see the current stage, render one document, switch themes, submit one answer, approve or send back. | Action path under `app/navigator/` |
| N7 | pending | 4 | The window shows `aidlc unit status`, claims with a team name the person types, and releases. Ownership and dependency refusals from the existing command show as the reason. | Units UI under `app/navigator/` |
| N8 | pending | 5 | The window lists bolts from intent state and `.aidlc/worktrees/bolt-*` (not started, running, paused, waiting) and answers or continues a waiting bolt through the person commands. | Bolts UI under `app/navigator/` |
| N9 | pending | 6 | Settings reads `aidlc config models --show` and writes only through `aidlc config models`. One fixture per harness row offers only that row's controls. Cursor and Copilot show the host explanation with no apply button. A per-agent or preset change uses `--local` unless the person chooses "for this project". | Model section of Settings under `app/navigator/` |
| N10 | pending | 7 | `aidlc usage show --json` prints the same totals the statusline computes, and an empty result when the ledger is absent. Tests cover both. | Usage command and its tests, `docs/guide/12-cli-commands.md` |
| N11 | pending | 7 | The status header shows workflow figures from `aidlc engine runtime summary --json`, including "no session data yet" when the graph is missing. Tokens in, tokens out, and the list-price estimate show only when `aidlc usage show --json` returns totals, with the caption "List-price estimate, not a bill." A missing ledger hides the token row. | Status header under `app/navigator/` |

## Alongside

These do not take a turn ahead of the Build list.

| Id | Status | Starts | Done when | Files |
| --- | --- | --- | --- | --- |
| N12 | pending | After N4 is done | Windows NSIS, macOS dmg, and Linux AppImage configs exist. The Windows package is produced on a Windows machine. macOS and Linux packages are built when a machine for each is available. Packaging adds no feature that exists on only one system. | Packaging config under `app/navigator/` |
| N13 | pending | Any time after N0 | An RFC issue is open on `awslabs/aidlc-workflows` covering the desktop app and the two person commands. The pull request waits until that issue exists. | GitHub issue |
