# Design

## Context

See `proposal.md` (Why). The load mechanism is `file://...src/index.ts`
in `~/.config/opencode/tui.json` chosen in DECISIONS.md #18 to match
the original josvaal plugin's load pattern and to avoid the
"transitional dual plugin system" server-side ERROR log that the
plugins-dir route currently emits. OpenCode's TUI loads the file
through Bun's import() which handles `.ts` directly (DECISIONS.md #6).

Today's failure is a stale absolute path in the user's `tui.json`,
not a code defect in the plugin. The plugin's default-export shape
holds: `bun -e "import('./src/index.ts')"` returns `{ default: ... }`.

## Goals / Non-Goals

**Goals:**

- Make the load path stable across future source-tree renames.
- Make a rename's recovery be a single shell command, documented
  in the repo.
- Keep the load mechanism (tui.json + `file://`) unchanged — no
  drift from DECISIONS.md #18.

**Non-Goals:**

- Publishing the plugin to npm. (Per DECISIONS.md #18 the
  legacy name on npm is owned by josvaal's package; the new
  name is also pre-emptively checked and the plugin ships
  from source.)
- Changing the plugin code (`src/index.ts`) or its default
  export shape. The contract holds; the path is the bug.
- Moving the load front to `.opencode/opencode.json` or the
  global `opencode.jsonc` `plugin[]` array. Both have a
  different semantic (npm/installable) and would re-introduce
  the problem this change is fixing in a new place.

## Decisions

### 1. Stable-symlink indirection, located in the parent workspace

`~/Sync/Repo/opencode-quota-runway-plugin -> opencode-quota`.

- **Why here and not under `~/.config/opencode/`**: the
  parent-workspace `~/Sync/Repo/` is the directory the user's
  other repo dirs live in, so renames physically happen there.
  Hiding the symlink inside the config dir would mean a future
  rename would still need two updates (config dir + target
  resolution), and the symlink would be invisible from the
  side the user is looking at.
- **Why a sibling symlink and not `~/Sync/Repo/opencode-quota/install -> .`**
  (self-referential inside the source tree): a symlink inside
  the tree itself dies the moment the tree moves, defeating
  its purpose. The indirection has to be outside the moving
  target.
- **Alternative considered**: a recorded name in `.config/opencode/opencode.jsonc`
  pointing at the repo via `file://`. Rejected: that config
  file is the user's cross-machine settings file, not the
  repo's settings; mixing the repo's load path into it
  re-creates a stale-absolute-path problem when the repo
  moves, just in a different file.
- **Alternative considered**: a wrapper script in the repo
  (`bin/install.sh`) that updates `tui.json` on demand.
  Rejected: requires re-running the script on every rename;
  the symlink-only approach is repo-move-resilient without any
  script. The script also keeps a copy of the "real" location
  in two places (script's reference + target dir), which is
  the same problem in script form.

### 2. `tui.json` path stays `file://`, just retargets

The path becomes
`file:///Users/dmitrii.savelyev/Sync/Repo/opencode-quota-runway-plugin/src/index.ts`.

- **Why not migrate to the plugins-dir route**:
  DECISIONS.md #18 names the per-session server-side ERROR
  line as the reason that route was avoided. Renaming for the
  third time would re-litigate a closed decision.
- **Why not put the symlink elsewhere**: see Decision 1.

### 3. Drift check as a unit test, not a CI step

The "tui.json path matches the documented indirection"
scenario is implemented as a `bun test` case (`tui.test.tsx`
or a new `install.test.ts`). The test reads the README's
install snippet and the live `tui.json` (path resolved at
test time relative to `process.env.HOME`) and asserts byte
equality on the recorded path.

- **Why a test instead of a CI job**: this repo's CI is
  `.github/workflows/ci.yml` running `bun install` + tests
  (per the archived-coder notes in tasks.md for prior
  changes). A drift check that runs in CI requires
  `~/.config/opencode/tui.json` to exist on every CI machine
  — it doesn't. The test is therefore local-only and a
  pre-merge `bun run check:all` runs it on the developer's
  machine before pushing. README drift detected locally, not
  on CI.

### 4. Plugin id stays `opencode-quota-runway`

Per the existing spec's "Plugin identity" requirement and
DECISIONS.md #18, the id is independent of the directory
name. The symlink is named `opencode-quota-runway-plugin`,
not `opencode-quota` — naming consistency with the plugin's
load-time identity, not the source tree's directory name.

## Risks / Trade-offs

- [User deletes the symlink while cleaning `~/Sync/Repo/`]
  → Recipe in README recreates it (`ln -sfn ...`); the
    test will surface the issue on the next `bun run check:all`.
- [Repo is moved outside `~/Sync/Repo/` (the symlink's
  parent dir lives outside the source tree so the symlink
  itself survives, but the absolute target must update)]
  → Recipe in README covers this case explicitly: it asks
    for the new absolute path.
- [Bun import of a path through a directory symlink fails]
  → Standard POSIX behavior; the path Bun sees after symlink
    resolution is the canonical one. The test scenario
    "plugin loads through the stable symlink" verifies this
    empirically with `bun -e "import(...)"` so the risk is
    verified, not assumed.
- [Test reads `tui.json` from a hard-coded path]
  → Path is derived from `process.env.HOME` at test time;
    CI skips the test when `HOME` is unset or the file is
    unreadable. The repo's CI runs in a sandbox that has
    no `~/.config/opencode/tui.json` so the test marks
    `skip` in that environment.
- [Symlink is a Unix-only construct]
  → Plugin runtime is macOS/Linux only (per CLAUDE.md
    env note: Platform darwin, and OpenCode runtime
    target). Documented as Unix-only in the README; not a
    Windows-support cost.

## Migration Plan

1. Create the symlink:
   `ln -sfn ~/Sync/Repo/opencode-quota ~/Sync/Repo/opencode-quota-runway-plugin`
2. Replace the path in `~/.config/opencode/tui.json`:
   from `file:///.../opencode-zai-quota/src/index.ts`
   to `file:///Users/dmitrii.savelyev/Sync/Repo/opencode-quota-runway-plugin/src/index.ts`.
3. Verify in a fresh OpenCode TUI start: `/quota-runway`
   appears in the command palette, the sidebar panel is
   visible, the chip is in the prompt line.
4. Rollback: remove the symlink, restore the prior tui.json
   content from `git`/`pbcopy`/memory. Today's plugin load
   status is "absent", which is the same as a successful
   rollback to the prior path — i.e., the failure mode is
   benign if anything goes wrong.

## Open Questions

None. The load front, the indirection mechanism, and the
drift-check surface are all decided inside the constraints
already pinned by DECISIONS.md #18 and the existing spec's
"Plugin identity" requirement.
