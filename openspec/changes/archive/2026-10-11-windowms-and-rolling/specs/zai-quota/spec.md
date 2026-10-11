# Spec Delta

## MODIFIED Requirements

### Requirement: Pace marker

The system SHALL render, for each window row, a pace marker on the gauge
whose horizontal position represents elapsed time within the window. The
window duration SHALL be carried on the row itself as `windowMs: number`,
and the marker SHALL be drawn at column
`floor((elapsed / windowMs) * gaugeWidth)`, clamped to `[0, gaugeWidth-1]`,
where `elapsed = now - (resetAt - windowMs)`. When `resetAt` is unknown
(rolling window), no marker SHALL be drawn and the detail line SHALL show
`rolling` (with the window's display label appended when available) in
place of a reset time. A non-finite elapsed, a non-positive windowMs, or
a gauge width below 2 SHALL suppress the marker. The marker SHALL be
rendered as a single theme-resolved foreground color distinct from the
gauge fill.

#### Scenario: burning faster than time

- **WHEN** elapsed exceeds the linear expectation at the configured
  tight-band factor
- **THEN** the row's verdict is `short` and the runway line carries the
  shortfall annotation; the marker still renders at its computed column

#### Scenario: unknown window duration

- **WHEN** a row has no `windowMs` or `windowMs <= 0`
- **THEN** no marker is drawn and the row falls through to the unknown
  verdict

#### Scenario: rolling window

- **WHEN** a row has a `windowMs` but no `resetAt` (rolling window
  anchored to first consumption, not the calendar)
- **THEN** no marker is drawn, the row's verdict is `unknown`, and the
  detail line shows `rolling` (or `rolling <label>` when a label is
  available) in place of a reset time

## ADDED Requirements

### Requirement: Window duration is row-owned

The system SHALL carry the pace-marker window duration on each quota row
as `windowMs: number` and SHALL NOT maintain a per-provider unit-code
lookup table inside the data model. Adapter code that converts a
provider's payload into rows is responsible for translating any
provider-specific unit identifier into `windowMs` at the boundary.

#### Scenario: provider-specific unit translated at the boundary

- **WHEN** a provider's payload names a window by a provider-specific
  unit code (for example `unit: 3` for the 5h Z.AI window)
- **THEN** the adapter produces a row with `windowMs: 300 * 60_000`
  (and the corresponding value for 7d), and the row carries no `unit`
  field visible to the renderer or the data model

#### Scenario: rolling window without reset

- **WHEN** a provider's payload gives a window duration but no
  `nextResetTime` (for example the rolling 5h Zhipu window)
- **THEN** the adapter produces a row with `windowMs` set and
  `resetAt: null`, and the panel renders the rolling state per the
  Pace marker requirement
