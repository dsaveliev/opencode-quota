# Design

## Context

The plugin is Z.AI / Zhipu at every layer. The user has a real
MiniMax Token Plan subscription whose quota endpoint
(`api.minimax.io/v1/token_plan/remains`) returns a structurally
similar 5h + 7d window but with a different wire format. Probing
the live payload through the existing `parseQuota` returns zero
rows and the panel shows `loading…` forever, so a second
provider is not reachable through any config change today. The
data model already has a clean seam: the parser produces
`QuotaRow[]` and `level` and the rest of the pipeline is pure.
Generalizing through a provider interface keeps the seam and
moves the provider-specific bits behind it. The active provider
is reachable through OpenCode's per-session model state and the
`session.next.model.switched` event.

## Goals / Non-Goals

**Goals:**
- Two providers (Zhipu, MiniMax) behind a unified contract.
- Provider selection reactive to the active session's model.
- History maps keyed by `${providerId}:${label}` so a provider
  switch does not mix burn-rate samples.
- Unknown provider id hides the panel and chip; the command
  toasts a message naming the provider.
- Header title and chip prefix are provider-driven, not
  hard-coded.

**Non-Goals:**
- Three or more providers. The registry is shaped so a third
  provider is a one-file addition, but a third provider is not
  part of this change.
- npm publishing or backward-compat aliases. The plugin is
  installed from source today; rename to `opencode-quota-runway`
  is its own change.
- Region auto-detection for Zhipu. The Zhipu module is
  monolithic on the user's machine; both keys and both hosts
  return identical payloads, so the single endpoint is correct
  for every id it serves.
- A new chip shape. The chip is rendered from the active
  provider's prefix and a fixed layout.

## Decisions

- **Decision: one interface, one registry, one resolution
  function.** Alternatives considered:
  - Per-provider factory function: rejected — the abstract factory
    of a single factory is the same code, harder to read.
  - A discriminated union with a `kind` field: rejected — same
    expressiveness, harder to add providers to (each addition
    touches the union and the dispatch).

- **Decision: provider id is the OpenCode provider id, not a
  custom name.** The active session's `model.providerID` is the
  only thing the plugin needs to identify the active provider,
  and using the same string in the registry means no extra
  translation table.

- **Decision: history is keyed `${providerId}:${label}`.**
  Alternatives considered:
  - Clear on switch: fewer lines, but the runway warmup on
    re-switch is lost.
  - Per-provider `Map<label, history>`: the same effect, but
    one extra map; the composite key is two characters cheaper.

- **Decision: MiniMax region detection is on-demand with sticky
  memory.** The first refresh for a MiniMax provider probes the
  first host; on a non-zero `base_resp.status_code` it tries the
  next host; the winner is remembered for the plugin lifetime.
  No probe in the constructor (cold start cost), no probe on
  every refresh (waste).

- **Decision: MiniMax's "no usage/limit" is papered over with
  pseudo-usage in 0-100 percent space.** The user's request was
  "two modules behind one interface, details under the hood";
  the runway feature is the central value of the plugin, and
  inverting `*_remaining_percent` and using limit:100 gives
  percent-space runway math through the existing
  `computeRunway`. The alternative (`usage: null, runway: no-data`)
  is honest but loses the central feature. The pseudo-usage is
  documented in the adapter's JSDoc so it is not a secret.

- **Decision: MiniMax's missing `level` becomes `level: null`.**
  The header has a named cluster for level; `null` cleanly means
  "no level supplied", and the existing ladder drops the cluster
  in that case.

## Risks / Trade-offs

- [The Zhipu module covers three OpenCode provider ids, but
  one of them is `zai` which currently lives on `api.z.ai` while
  `zhipuai-coding-plan` lives on `open.bigmodel.cn`] → the Zhipu
  module declares both hosts in its `endpoints[]`, probes in
  declaration order, and remembers the winner. The
  `ZAI_QUOTA_ENDPOINT` env override remains the Zhipu endpoint
  override and bypasses the probe for the legacy Zhipu ids
  only.
- [Region detection races with the `intervalMs` tick if a
  refresh is in flight] → the in-flight deduplication that
  already exists in `scheduleRefresh` covers this; a probe is
  one fetch, in-flight means we wait, no duplicate.
- [A bug in MiniMax's parser silently maps percent-remain
  to a positive number] → the parser is checked in the new
  `src/providers/minimax.test.ts` against a real payload
  captured at probe time and pinned as a fixture.
- [Removing the SCAN_FIELDS deep scanner tightens the parser
  contract] → the scanner was a defensive escape hatch for
  provider payloads the parser did not understand; with two
  known providers and an explicit unknown-provider case, the
  escape hatch is dead code.

## Migration Plan

Single change, two phases inside it: the Zhipu module is
extracted first, the test suite stays green at that commit
(refactor with no behaviour change); the MiniMax module is
added at the same commit (parser + region probe + tests). The
sidebar slot, the chip slot, and the command are wired to the
registry. A `provider-not-found` case in the smoke test pins
the hide-and-toast behaviour for an unknown provider id.
