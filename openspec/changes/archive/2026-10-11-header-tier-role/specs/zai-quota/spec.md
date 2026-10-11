# Spec Delta

## MODIFIED Requirements

### Requirement: Theme-native rendering

The system SHALL render a borderless sidebar panel aligned with the native
sidebar sections (zero box padding, first section position) on a fixed
38-column grid: label column at 0, gauge at columns 4-19, right-aligned
percent at 21-24, right-aligned usage pair at 26-34, right-aligned verdict
glyph in a two-character slot at 36-37, detail line flush at column 0, and
header suffix (level/freshness) right-aligned ending at column 37. Every
rendered line SHALL stay within the panel width in every state and glyph
mode via explicit boundary rules: freshness capped at 8 characters with
tiered units, percent display clamped to 0..999, over-wide usage pairs
dropped, detail lines degraded by a fixed ladder (recovery time, then
shortfall, then reset) never exceeding the width, and error messages
pre-sized to fit. Every text element SHALL carry an explicit foreground
color from the five universal semantic theme tokens; an ASCII fallback mode
SHALL preserve the same grid and semantics. The header's plan-level segment
SHALL carry the title's text role (not the freshness tail's warning or
textMuted role) so the plan name does not recolor when the panel is
updating or stale.

#### Scenario: theme purity

- **WHEN** any rendered element picks a color
- **THEN** the value comes from `api.theme.current` via the single role-mapping
  module, and every text element carries an explicit fg — no text relies on
  the terminal or theme default foreground (verified by a render-tree test)

#### Scenario: readable on light themes

- **WHEN** the active theme has a light background (e.g. solarized-light)
- **THEN** all text remains visible because every element uses its theme's
  semantic foreground, never the renderer default

#### Scenario: grid alignment

- **WHEN** the panel renders any line (header, window, detail, error, loading)
- **THEN** the line occupies exactly 38 columns when targets width = GRID.width

#### Scenario: worst-case values never overflow

- **WHEN** any field hits its width cap (long level, long freshness, wide usage)
- **THEN** the fixed boundary ladder removes the overflowing field in the
  documented order and the line still ends at or before column 37

#### Scenario: plan name keeps title role while freshness changes

- **WHEN** the panel is updating or stale and a plan level is present
- **THEN** the title, the `·` separator, and the level segment all carry the
  text role, and only the freshness tail carries the warning role

#### Scenario: plan name keeps title role in idle state

- **WHEN** the panel is idle (not updating, not stale) and a plan level is
  present
- **THEN** the title, the `·` separator, and the level segment all carry the
  text role, and the freshness tail carries the textMuted role
