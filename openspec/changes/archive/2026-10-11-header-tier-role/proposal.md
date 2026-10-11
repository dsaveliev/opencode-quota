# Proposal

## Why

The header's plan name (e.g. "Pro") and the freshness age currently share the
same role segment, so they recolor together when the panel is updating or
stale. The plan name is a static property of the subscription, not a freshness
signal, and must not be re-colored by state. The bug was explicitly fixed
once before (commit 9051116, "colors untouched") and is pinned by a test
(render.test.ts:528) that asserts the broken behavior, so the contract
reversal needs its own change.

## What Changes

- The header sep + level segments take the title's role (`text`, with bold),
  not the state role. The freshness tail keeps the existing `warning` /
  `textMuted` role.
- The header width contract is unchanged: the suffix is still
  right-aligned ending at column 37 and the existing ladder (drop level,
  then strip "stale · " prefix) still runs.
- The test that asserts the broken behavior is removed and replaced with
  cases that pin the new behavior.

## Capabilities

### Modified Capabilities

- `zai-quota`: the "Theme-native rendering" requirement gains an explicit
  rule that the level segment and the freshness tail carry **different**
  roles, and the level segment inherits the title's role, not the state role.

## Impact

- `src/render.ts` — `renderHeader` assigns `role: "text"` to the `sep` and
  `level` segments (was the shared `role` variable).
- `src/render.test.ts` — the case at line 528 is removed; new cases pin
  the corrected role split.
- Behavior of every other surface is unchanged.
