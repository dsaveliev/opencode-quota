# Proposal

## Why

`~/.config/opencode/tui.json` still points at the old source-tree path
`file:///.../opencode-zai-quota/src/index.ts`, so when OpenCode starts
the plugin silently fails to load and the quota sidebar is absent.
The repo was renamed in the `2026-10-11-rename-and-docs` change
(`opencode-zai-quota` → `opencode-quota`), but `tui.json` was not
updated; today every rename or move of the source tree would break
the load the same way. The plugin code itself is healthy (the
default-export contract from DECISIONS.md #18 still holds; `bun -e
"import('./src/index.ts')"` succeeds). A single edit repairs
today's symptom; a small additional guarantee (stable symlink +
documented recovery recipe) prevents the same silent failure on
the next rename.

## What Changes

- **BREAKING for the user's local install only.** The
  `~/.config/opencode/tui.json` `plugin[]` entry is rewritten from
  the stale `opencode-zai-quota/src/index.ts` path to the current
  `opencode-quota/src/index.ts` path. OpenCode loads both paths via
  `file://`; behavior is unchanged once the path resolves.
- A stable symlink is placed at
  `~/Sync/Repo/opencode-quota-runway-plugin -> opencode-quota`
  and the `tui.json` path is changed to point at the symlink
  (`.../opencode-quota-runway-plugin/src/index.ts`). Source-tree
  renames update only the symlink target; `tui.json` no longer
  needs touching.
- The `opencode-quota-runway` capability gains a new requirement
  ("Stable installation contract") that codifies the symlink-as
  load-front pattern and the rename recovery recipe (one shell
  command), so future renames are caught by tests/contract instead
  of by silence.
- README is updated with the rename recovery recipe and the
  symlink-based install snippet; the existing tui.json section
  is rewritten in terms of the symlink path.

## Capabilities

### New Capabilities

None. The change does not introduce a new durable behavior; it
repairs and locks down an existing one.

### Modified Capabilities

- `opencode-quota-runway`: add a new requirement, "Stable
  installation contract", covering the symlink as the durable
  path, the documented rename recovery recipe, and the load-time
  guarantee (plugin loads under the `opencode-quota-runway` id
  with the symlink as the load front, verified at openCode
  start).

## Impact

- Files inside the repo:
  - `README.md` — install section rewritten in terms of the
    symlink; rename-recipe section added.
- Files outside the repo (user's machine, not in any working
  copy):
  - `~/.config/opencode/tui.json` — `plugin[0]` path updated to
    the symlink.
  - `~/Sync/Repo/opencode-quota-runway-plugin` — new symlink
    (created by the apply step; lives outside the working tree).
- No public API or runtime behavior change beyond the load path.
- No dependency change. No spec/lockfile churn. No new npm
  package.
