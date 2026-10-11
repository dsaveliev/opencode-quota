# Proposal

## Why

The plugin is no longer Z.AI-specific: it now serves two providers
(Zhipu and MiniMax) under a single interface, and the data model
no longer carries the Z.AI `unit` field. The plugin's name
(`opencode-zai-quota`), the npm package name, the plugin id, the
slash command, and the GitHub repository URL all still say "zai".
The README explicitly disambiguates the npm name from the upstream
inspiration (lines 144-147); the plugin is installed from source
through a `file://` path today, so the npm-collision story is
specific to the package name `opencode-zai-quota`, not the plugin
identity. Renaming to `opencode-quota-runway` (chosen during
exploration) makes the name describe what the plugin does
(quota with runway projection) and what providers it spans
(an OpenCode plugin), drops the upstream-collision caveat from
the README, and brings the GitHub repository URL, the npm
package name, the plugin id, the slash command, and the
OpenSpec capability into a single name.

## What Changes

- The GitHub repository is renamed from `dsaveliev/opencode-zai-quota`
  to `dsaveliev/opencode-quota-runway`. A repository redirect is
  configured on GitHub so old clone URLs and the badge URL keep
  working.
- The `package.json` `name` field changes from `opencode-zai-quota`
  to `opencode-quota-runway`. The `description` field is rewritten
  to name both providers.
- The OpenSpec capability `zai-quota` is renamed to
  `opencode-quota-runway` (REMOVED with migration in the same
  change, ADDED at the new path).
- The `package.json` `name` does not change for npm publication:
  the plugin is not published today. The README's npm-collision
  caveat is replaced with the new name and the new upstream
  reference.
- The plugin id (in `src/index.ts`), the slash command name
  (`/quota-runway` with `/qr` as alias, replacing `/zai-quota` /
  `/zq`), the keymap command name (`quota-runway.refresh`,
  replacing `zai-quota.refresh`), the toast titles, and the
  startup-warning toast titles are all updated to the new name.
- The README is rewritten to use the new name throughout, the
  new install path (`opencode-quota-runway`), the new badge URL
  (the GitHub redirect makes the old URL keep working; the
  README is updated to the new URL anyway for clarity), the
  new slash command, and the new provider list (Zhipu, MiniMax).
- The `openspec/specs/` directory tree is reorganized so the
  canonical capability lives at `opencode-quota-runway/`.

## Capabilities

### New Capabilities

- `opencode-quota-runway`: the new canonical capability. It is
  the same body of behaviour as `zai-quota` (the `Quota pull`,
  `Runway projection`, `Theme-native rendering`, `Configuration`,
  `Status verdict`, `Pace marker`, `Interactive refresh`,
  `Window duration is row-owned`, `Rolling window`, and
  `Modern TUI API only` requirements), with the renames
  applied. The `provider-resolution` capability from the
  multi-provider change is included.

### Modified Capabilities

- `provider-resolution`: the requirement names and scenarios
  use the new plugin id and slash command in the command
  toast and the keymap reference.

### Removed Capabilities

- `zai-quota`: superseded by `opencode-quota-runway`. **Reason**:
  the old name binds the capability to a single provider and
  misleads readers of the new spec tree. **Migration**: the
  `opsx archive` step copies every requirement from the old
  capability into the new one and deletes the old directory.

## Impact

- `package.json` — `name`, `description`, repository URL,
  keywords.
- `src/index.ts` — `id: "opencode-quota-runway"`.
- `src/tui.tsx` — keymap command name, slash name, alias,
  toast titles, warning toast title, comment.
- `README.md` — 257 lines updated for the new name, install
  path, badge URL, command reference, error states section,
  and the removal of the legacy npm-collision caveat.
- `openspec/specs/zai-quota/` — REMOVED (during archive).
- `openspec/specs/opencode-quota-runway/` — CREATED.
- `openspec/changes/` — old `zai-quota` and `opencode-quota-runway`
  change directories keep their names for traceability.
- The GitHub repository `dsaveliev/opencode-zai-quota` is
  renamed to `dsaveliev/opencode-quota-runway`. The 32
  unpushed commits are pushed first.
- The npm package name `opencode-zai-quota` continues to be
  claimed by the upstream inspiration. The plugin is not
  published, so no `npm deprecate` is required.
