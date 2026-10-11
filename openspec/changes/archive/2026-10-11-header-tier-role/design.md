# Design

## Context

`renderHeader` in `src/render.ts:208` builds the suffix as one cluster that
shares a single `role` variable: the `·` separator, the level text, and the
"pad + freshness tail" segment all use that `role` (warning when
`updating || stale`, else textMuted). The title segment already carries
`role: "text"`. The plan name and the freshness tail are two different
things — the plan name is a static property of the subscription, the
freshness tail is a state signal — and the current code re-colors them
together. The change is purely a role assignment inside one function; no
new public types, no layout change, no spec-level geometry change.

## Goals / Non-Goals

**Goals:**
- Assign the title's `text` role to the `·` separator and the level segment.
- Keep the freshness tail on the state role.
- Preserve the existing width contract and the existing ladder
  (drop level, then strip "stale · " prefix).

**Non-Goals:**
- New color, new role, new segment shape.
- ASCII mode / glyph mode changes.
- Chip prefix, error text, or any other surface.

## Decisions

- **Decision: keep the title cluster as `text` and lift the `sep` + `level`
  onto the same role.** Alternatives considered:
  - Use a dedicated new role (e.g. `tier`): rejected — adds a sixth
    universal theme token and changes the theme contract; the
    title-cluster is the right grouping.
  - Move the level into a separate visual cluster (badge left, parens,
    trailing after freshness): rejected — user already chose the
    layout, the bug is role assignment only.

- **Decision: bold stays on `sep` and `level`.** The targeted bold
  introduced in v5.1 is layout, not role; this change reverses the
  role decision of 9051116 ("colors untouched") and keeps the bold
  decision intact.

## Risks / Trade-offs

- [Pinned test 528 asserts the broken behavior] → that test is
  removed and replaced with cases that pin the corrected split.
- [Existing header rendering tests in `render.test.ts:336, 490, 497`]
  assert role on individual segments with the current scheme. After the
  fix they continue to pass because they only check `text`/`textMuted`
  for the idle case; updating/stale cases were the only ones sharing
  `warning` across the cluster, and the only test that asserted that
  is line 528.

## Migration Plan

Single commit, no migration. The change is observable only as: the
plan name in the header no longer turns red during click refreshes.
