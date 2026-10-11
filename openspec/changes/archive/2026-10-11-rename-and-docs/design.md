# Design

## Context

The multi-provider change in this set decoupled the plugin from
the Z.AI / Zhipu provider at the data-model level, but the
plugin's identity still says "zai": the package name
(`opencode-zai-quota`), the plugin id (`zai-quota`), the slash
command (`/zai-quota`, alias `/zq`), the keymap command name
(`zai-quota.refresh`), the GitHub repository URL
(`dsaveliev/opencode-zai-quota`), the README, and the OpenSpec
capability (`zai-quota`). The choice of `opencode-quota-runway`
was made during exploration: the name describes what the plugin
does (quota with runway projection) and what providers it spans
(an OpenCode plugin), and the npm package name is free (HTTP 404
on `opencode-quota-runway` confirmed during exploration). The
legacy `opencode-zai-quota` npm name is still claimed by an
upstream inspiration plugin, but this plugin is not published
today, so the rename is purely metadata.

## Goals / Non-Goals

**Goals:**
- One canonical name (`opencode-quota-runway`) for: GitHub
  repository, npm package, plugin id, slash command, OpenSpec
  capability, keymap command, README, and the
  `OPENCODE_QUOTA_RUNWAY_*` environment variable prefix.
- Backward compatibility for the legacy `ZAI_QUOTA_*`
  environment variable names: they continue to work and apply
  to the Zhipu provider.
- Repository redirect on GitHub so old clone URLs and the badge
  URL keep resolving.

**Non-Goals:**
- npm publication. The plugin is installed from a `file://` path
  today; the rename does not change that.
- A `package.json` `repository` redirect. The GitHub-side
  redirect covers it.
- Aliases in OpenCode (legacy `id: "zai-quota"` continued to
  work): the plugin is referenced through a `file://` path, not
  by id, so this is a clean break.

## Decisions

- **Decision: GitHub repository is renamed, not mirrored.**
  GitHub supports `Settings → General → Repository name → Rename`
  with an automatic redirect from the old name. The 32 unpushed
  commits are pushed first.

- **Decision: the OpenSpec capability is renamed through
  REMOVED + ADDED in the same change.** This is the only path
  OpenSpec supports for capability rename (verified in the
  `instructions specs` output: "Do not move or rename the
  capability"). The `opsx archive` step on this change
  will copy every requirement body from `zai-quota` into
  `opencode-quota-runway` and delete the old directory.

- **Decision: legacy `ZAI_QUOTA_*` env vars keep working for
  the Zhipu provider.** The legacy Zhipu users installed
  through those names should not break on upgrade. The
  `OPENCODE_QUOTA_RUNWAY_*` names are the new canonical
  prefix.

- **Decision: README is rewritten in one pass, not piecemeal.**
  A partial README that says `zai` in some places and
  `quota-runway` in others is worse than a clean rewrite. The
  README rewrite is one task in the task list.

- **Decision: the README's npm-collision caveat is removed.**
  With the new package name, `npm install opencode-quota-runway`
  would not collide. The plugin is still installed from source;
  the caveat shifts from "name is taken on npm" to "install from
  source".

## Risks / Trade-offs

- [GitHub rename is destructive for any forks or clones that
  pinned the old URL] → the GitHub redirect handles HTTP
  redirects for the repo page and `git clone`; anyone with a
  local clone needs to `git remote set-url origin
  <new-url>`.
- [The 32 unpushed commits block the rename being visible
  upstream] → the rename commit is the last thing to push, so
  the rename is the most recent commit on the new repo URL.
- [A stale link in a doc or comment still says `zai-quota`]
  → exhaustive grep over `README.md`, `package.json`, and
  `src/` is the verification step; the only file paths to
  update outside those are the spec and the badge URL.

## Migration Plan

Two-pass commit graph inside one change:

1. Code/spec changes land first (plugin id, command name,
   package.json, env var prefix, capability). Existing tests
   still pass; the new id and the old `ZAI_QUOTA_*` env
   prefix are both active.
2. README is rewritten to the new name, the new install path,
   the new badge URL, the new command reference, and the
   removal of the legacy npm-collision caveat.
3. `git push` to the renamed GitHub repository: the
   `dsaveliev/opencode-zai-quota` URL is configured as the
   GitHub remote; the user runs the rename on the GitHub side
   and the next push goes to the new URL. (The user explicitly
   opts in to the rename in the GitHub UI; the plugin does
   not perform the rename on the user's behalf.)

The `opsx archive` step deletes `openspec/specs/zai-quota/`
and writes the final `opencode-quota-runway/spec.md` from the
delta files in this change.
