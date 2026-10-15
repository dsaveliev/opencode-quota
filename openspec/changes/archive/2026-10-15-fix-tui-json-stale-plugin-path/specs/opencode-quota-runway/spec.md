# Spec Delta

## ADDED Requirements

### Requirement: Stable installation contract

The system SHALL register and load through a stable-path indirection
under the user's home so that source-tree renames and moves do not
break OpenCode's plugin load: a directory-level symlink at
`~/Sync/Repo/opencode-quota-runway-plugin` points at the current
source tree, and `~/.config/opencode/tui.json`'s `plugin[]` entry
references the plugin entry point as
`file://<symlink>/src/index.ts` (the symlink path, not the
source-tree path). Renaming or moving the source tree SHALL leave
the symlink as the only thing that needs touching. The rename
recovery recipe — relocate the source, run `ln -sfn <new-location>
~/Sync/Repo/opencode-quota-runway-plugin`, restart OpenCode — SHALL
be documented in the repository README.

#### Scenario: plugin loads through the stable symlink

- **WHEN** OpenCode starts with `~/.config/opencode/tui.json`
  pointing at `file://~/Sync/Repo/opencode-quota-runway-plugin/src/index.ts`
  and the symlink resolves to the current source tree
- **THEN** OpenCode loads the plugin default export, the plugin id
  `opencode-quota-runway` is registered, and the quota sidebar and
  chip render under that id (not the directory name)

#### Scenario: source-tree rename keeps the load working

- **WHEN** the source tree is renamed from `opencode-quota` to
  `opencode-quota-v2`, the symlink is repointed with
  `ln -sfn ~/Sync/Repo/opencode-quota-v2 ~/Sync/Repo/opencode-quota-runway-plugin`,
  and OpenCode is restarted
- **THEN** `tui.json` is unchanged and the plugin still loads; the
  plugin id `opencode-quota-runway` (not `opencode-quota-v2`) is
  registered

#### Scenario: tui.json path matches the documented indirection

- **WHEN** the README's install section documents the
  stable-symlink path verbatim
- **THEN** the recorded `tui.json` value equals the documented
  value; a strict equality check between the README snippet and
  the live `tui.json` succeeds (catches drift at review time)

#### Scenario: rename recovery recipe is reproducible

- **WHEN** the README is followed step-by-step after a hypothetical
  rename
- **THEN** every command runs to completion in a POSIX shell
  without editing files outside the documented set; the resulting
  OpenCode session shows the quota sidebar and chip on first start
