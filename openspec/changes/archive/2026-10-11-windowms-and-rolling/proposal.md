# Proposal

## Why

The current pace-marker contract keys the window duration through a numeric
`unit` code (`3` for 5h, `6` for 7d) looked up in a hardcoded `WINDOW_MS`
table. The table is provider-specific to Z.AI / Zhipu, and it leaks a
non-portable code into the data model. A new provider cannot adopt the
panel without either (a) reverse-engineering the Z.AI unit code space or
(b) carrying a parallel lookup. Separately, the 5h window has no
`nextResetTime` in the live Zhipu payload (the window is rolling, anchored
to first consumption, not the calendar), so the marker is silently
dropped and the detail line shows `reset ?` — looking like a bug rather
than a known rolling window.

## What Changes

- The quota row carries `windowMs: number` directly. The pace marker
  takes its duration from `row.windowMs`, not from a unit-code lookup.
- The Z.AI unit-code lookup table is removed from the data model; the
  adapter that produces rows converts `unit: 3` to `windowMs: 5h` and
  `unit: 6` to `windowMs: 7d` at the boundary.
- A row whose `resetAt` is unknown produces `resetText: "rolling"` (with
  the window's label appended when available) and no pace marker. This is
  a deliberate, named state, not a silent degradation.
- The detail-line ladder and the right-alignment contract are unchanged.
- The pace-marker requirement gains an explicit "rolling window" branch.

## Capabilities

### Modified Capabilities

- `zai-quota`: the "Pace marker" requirement is rewritten to use
  `windowMs` instead of `unit: 3|6`; a new requirement "Rolling window"
  formalizes the rolling-5h case.

## Impact

- `src/api.ts` — `QuotaRow` gains `windowMs: number`; `entryLabel` and
  the SCAN_FIELDS heuristics are unchanged.
- `src/marker.ts` — `WINDOW_MS` lookup removed; `markerIndex` signature
  takes `windowMs` directly.
- `src/model.ts` — `buildWindow` passes `row.windowMs` to the marker and
  decides "rolling" when `resetAt == null`.
- `src/marker.test.ts`, `src/model.test.ts`, `src/render.test.ts` —
  fixtures gain `windowMs`; the rolling case is pinned.
- No effect on the chip, the command, the refresh engine, or the
  config layer.
