# Tasks

## 1. Code identity

- [ ] 1.1 In `src/index.ts` change `id: "zai-quota"` to
  `id: "opencode-quota-runway"`. Verify by reading the file: the
  default export's `id` field is the new string and the comment
  reflects the new identity.
- [ ] 1.2 In `src/tui.tsx` update the keymap command:
  `name: "opencode-quota-runway.refresh"`, `slashName: "quota-runway"`,
  `slashAliases: ["qr"]`, `title: "OpenCode Quota Runway: refresh
  now"`, `desc: "Fetch current quota usage for the active provider"`,
  and the toast title `OpenCode Quota Runway`. Verify by reading
  the file: every literal matches the new naming.
- [ ] 1.3 In `src/tui.tsx` update the startup-warning toast title
  to `OpenCode Quota Runway config` and the comment that mentions
  the `/zai-quota` command to mention `/quota-runway`. Verify by
  reading the file.

## 2. Environment variable prefix

- [ ] 2.1 In `src/config.ts` add an `OPENCODE_QUOTA_RUNWAY_*` env
  var mapping that mirrors every `ZAI_QUOTA_*` mapping in
  `ENV_TO_KEY`, with the same key resolution. Verify by reading
  the file: the new mapping is in scope and resolves to the same
  config keys.
- [ ] 2.2 In `src/config.test.ts` add a test case asserting that
  `OPENCODE_QUOTA_RUNWAY_INTERVAL_MS=30000` resolves to
  `intervalMs: 30000` and that the legacy `ZAI_QUOTA_INTERVAL_MS`
  still resolves to the same value when both are unset. Verify by
  running `bun test src/config.test.ts` and seeing the new case
  pass.

## 3. package.json and GitHub

- [ ] 3.1 In `package.json` change `name` to `opencode-quota-runway`,
  update `description` to mention both providers, update the
  `repository.url` to the renamed GitHub URL, and add
  `keywords` entries (`["opencode", "plugin", "quota", "tui"]`).
  Verify by reading the file: `name` is the new string and the
  description is current.
- [ ] 3.2 Push the 32 unpushed commits to the existing GitHub
  remote (the user runs `git push` to
  `github` remote; the plugin does not run `git push` on the
  user's behalf). Verify by running `git log --oneline @{u}..HEAD`
  and seeing the output is empty.
- [ ] 3.3 Rename the GitHub repository on
  `github.com/dsaveliev/opencode-zai-quota` to
  `opencode-quota-runway` through the GitHub UI, with
  "Redirect traffic from the old URL" enabled. Verify by visiting
  the old URL and seeing the redirect land on the new one.
- [ ] 3.4 Update the local git remote: `git remote set-url github
  git@github.com:dsaveliev/opencode-quota-runway.git`. Verify by
  running `git remote -v` and seeing the new URL.

## 4. README

- [ ] 4.1 In `README.md` replace every occurrence of
  `opencode-zai-quota` with `opencode-quota-runway`, every
  occurrence of `/zai-quota` with `/quota-runway`, every
  occurrence of `zai-quota.refresh` with
  `opencode-quota-runway.refresh`, and remove the npm-collision
  caveat block (lines 144-147). Verify by `grep -n
  'zai-quota' README.md` returning no matches.
- [ ] 4.2 In `README.md` update the badge URL to the renamed
  GitHub repo, the install-path examples to use
  `opencode-quota-runway/src/index.ts`, the command reference
  to `/quota-runway` (alias `/qr`), the error-states section to
  reference the new toast title and the no-provider case, and
  the introduction to name both providers (Zhipu, MiniMax).
  Verify by reading the file end-to-end and confirming every
  named reference uses the new identity.

## 5. OpenSpec

- [ ] 5.1 Run `openspec validate rename-and-docs` and confirm the
  change is valid. Verify by the command exiting 0 with
  `Change 'rename-and-docs' is valid`.
- [ ] 5.2 Apply the change, then run `openspec archive
  rename-and-docs` to move the delta files into the main
  `openspec/specs/` tree. Verify by `ls openspec/specs/` showing
  `provider-resolution/` and `opencode-quota-runway/` and not
  `zai-quota/`.

## 6. Suite

- [ ] 6.1 Run `bun run check` and `bun test` from the repo root
  and verify the whole suite is green. Verify by the command
  exiting 0.
- [ ] 6.2 From the user's OpenCode TUI config (`~/.config/opencode/
  tui.json`), confirm the `file://` path is unchanged. Verify by
  reading the file: the entry still points at the local
  `src/index.ts` path.
