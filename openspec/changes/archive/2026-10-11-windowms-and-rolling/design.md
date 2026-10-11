# Design

## Context

The pace-marker contract is the deepest provider-specific artefact in the
data model. `marker.ts` keys on `WINDOW_MS[unit]` where `unit: 3 → 5h` and
`unit: 6 → 7d` are the Z.AI / Zhipu coding-plan codes. The
`QuotaRow.unit` field in `src/api.ts:1` exists for that lookup. To
introduce a second provider whose windows are positional (current /
weekly) rather than unit-coded, the data model has to either learn the new
codes or stop carrying the code. Stopping is the right answer: a
`windowMs` integer is what the marker actually consumes, and a 5h or 7d
window duration is provider-independent. Separately, the 5h Zhipu window
has no `nextResetTime` (it is rolling, anchored to first consumption per
the Z.AI docs: "credit quota resets 5 hours after consumption"). Today
this collapses to "no marker, `reset ?`" — silent and looks like a bug.
The change names this state and fixes the data-model leak in one go.

## Goals / Non-Goals

**Goals:**
- `QuotaRow` carries `windowMs: number` and no `unit` field visible to
  the data model. Adapters translate provider-specific identifiers into
  `windowMs` at the boundary.
- A row with `resetAt == null` and a known `windowMs` is rendered as a
  rolling window: no marker, detail line shows `rolling` (or
  `rolling <label>` when a label is available).
- The detail-line ladder and the right-alignment contract are preserved
  (verified empirically: `rolling 5h` occupies 25 of 38 columns with
  runway at column 15, comfortably inside the ladder).

**Non-Goals:**
- Computing `resetAt` for a rolling window by tracking when
  `currentValue` first rose from zero. That is a separate feature with
  its own math and its own phase-shift bug surface.
- Changing the runway math. The runway input (`usage`, `limit`,
  `resetAt`) is unchanged.
- Changing the chip or the command.

## Decisions

- **Decision: drop `QuotaRow.unit` and `WINDOW_MS`; add `windowMs`.**
  Alternatives considered:
  - Keep `unit`, add a new `windowMs?` field: rejected — two ways to
    express the same thing. Future providers will pick one and the other
    will rot.
  - Move `WINDOW_MS` into each adapter and let the marker look it up by
    provider: rejected — the marker is pure; threading provider
    knowledge into it inverts the layering.

- **Decision: rolling state lives in the row, not the renderer.** A
  blank detail-line reset cell (`reset ?`) is ambiguous: it could mean
  "no data", "still loading", or "rolling". Renaming it to `rolling`
  (or `rolling 5h`) makes the state explicit and the marker absence
  intentional.

- **Decision: rolling state is a verb on the row, not a new verdict.**
  `classifyWindow` already returns `unknown` when `resetAt == null`; the
  marker absence and the `rolling` text are the *visual* consequences,
  not a new Verdict enum value.

## Risks / Trade-offs

- [`QuotaRow.unit` removal is breaking for any caller that reads it] →
  exhaustive grep across `src/` shows only `api.ts:8` (the type
  definition) and `model.ts:165` (the lookup); both are touched by this
  change. No tests read `.unit` directly outside the api.test.ts
  fixture's expected objects, and those are updated.
- [A non-Z.AI unit code (e.g. `unit: 4`) silently falls into the new
  `windowMs == undefined` branch in the adapter] → adapter logs the
  unknown code once and emits `windowMs: undefined` (rolled to the
  existing `no marker` behavior, which the rolling case now also
  covers).
- [The `rolling` literal lands in `format.ts` and gets hardcoded across
  the codebase] → it stays in the model layer; the renderer is told
  `resetText` and just prints it.

## Migration Plan

Single commit, no migration. The change is observable as: a 5h row in
the Zhipu payload now reads `rolling 5h` instead of `reset ?`, and
the data model no longer carries the Z.AI `unit` field.
