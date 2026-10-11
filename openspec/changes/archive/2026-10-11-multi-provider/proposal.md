# Proposal

## Why

The plugin hardcodes Z.AI / Zhipu at every layer: the endpoint, the
authKeys, the `unit: 3|6` parsing, the chip prefix, the error text, the
command name. A second subscription (MiniMax Token Plan) exposes a
real, public, live quota endpoint
(`https://api.minimax.io/v1/token_plan/remains` for `.io`,
`api.minimax.cn` for `.cn`) with a structurally similar 5h + weekly
window, but the wire format is incompatible: no `usage`/`limit`
counts, `*_remaining_percent` (inverse of the Z.AI direction), no
`unit` code, no `data.level`. Probing both backends on the user's own
machine shows the existing `parseQuota` returns zero rows on the
MiniMax payload and the panel shows `loading…` forever, so the
plugin today cannot be pointed at the second endpoint through any
config change. A user with an active MiniMax model and the panel
enabled would either see the wrong provider's data (Z.AI / Zhipu on
the active Zhipu key, when a MiniMax model is selected) or no data
at all (on the active MiniMax key). Generalizing the data path
through a provider interface fixes both at once.

## What Changes

- A new `providers/` module tree holds the unified contract and one
  module per provider. The contract covers: id, display label, chip
  prefix, authKeys, tokenEnv, endpoints, payload parser, and
  per-provider error text.
- `providers/zhipu.ts` is the existing behaviour moved as-is. It
  serves the provider ids `zai`, `zai-coding-plan`, and
  `zhipuai-coding-plan`. Probing confirms the two keys and the two
  hosts return identical payloads on the user's machine, so one
  module covers all three ids.
- `providers/minimax.ts` is new. It serves the provider ids
  `minimax`, `minimax-coding-plan`, `minimax-cn-coding-plan`. The
  parser inverts `*_remaining_percent` to usage percent, computes
  `windowMs` from `end_time - start_time` (verified exactly 5h and
  7d), sets `resetAt` from `end_time` / `weekly_end_time`, and
  synthesises a 0-100 percent-scale row (usage = `100 - remaining`,
  limit = 100) so the existing runway math works without change.
  Region detection probes `.io` first, falls back to `.cn` on a
  non-zero `base_resp.status_code`, and remembers the winner.
- The provider is selected per session from the active model in
  OpenCode: `api.state.session.get(sessionID)?.model?.providerID`
  (initial value) plus `api.event.on("session.next.model.switched")`
  (updates). Events keep the signal reactive without depending on
  slot-prop re-invocation semantics.
- A provider id that the registry does not recognise hides the panel
  and the chip (the sidebar slot is not registered) and the command
  toasts `no quota provider for <providerID>`. The history maps are
  keyed by `${providerId}:${label}` so switching providers does not
  mix their burn-rate samples.
- The header title becomes dynamic: the active provider's display
  label, not the literal `"Z.ai Runway"`.
- The chip prefix becomes dynamic: the active provider's chip
  prefix, not the literal `" zai "`.

## Capabilities

### New Capabilities

- `provider-resolution`: the plugin resolves the active OpenCode
  model provider id to a registered quota provider, hides the panel
  and chip when no provider matches, and exposes a command that
  toasts the current provider status.

### Modified Capabilities

- `zai-quota`: the "Quota pull", "Configuration", and
  "Theme-native rendering" requirements gain provider-agnostic
  language. The literal "Z.AI" / "zai" / "Z.ai Runway" strings are
  no longer the canonical identifiers; they are the Zhipu
  provider's display values.

## Impact

- New files: `src/providers/types.ts`, `src/providers/zhipu.ts`,
  `src/providers/minimax.ts`, `src/providers/index.ts` (registry).
- `src/api.ts` — `parseQuota` is reduced to a one-line dispatch
  on the active provider; the SCAN_FIELDS deep scanner is removed
  (each provider's parser is responsible for its own payload).
- `src/config.ts` — `endpoint` keeps its current meaning (Zhipu
  override); no new config keys.
- `src/tui.tsx` — provider resolution, history key, dynamic title
  and chip prefix. `api.state.session.get`, `api.event.on(
  "session.next.model.switched", ...)`, and `api.event.on(
  "tui.session.select", ...)` are introduced here.
- `src/model.ts` — `title` and `chipPrefix` come from
  `ModelInput`, not literals.
- `src/render.ts` — `errorText` is provider-supplied.
- Tests: new `src/providers/zhipu.test.ts`,
  `src/providers/minimax.test.ts`, `src/providers/types.test.ts`
  where the contract is exercised; `src/api.test.ts` shrinks to
  the dispatch case.
