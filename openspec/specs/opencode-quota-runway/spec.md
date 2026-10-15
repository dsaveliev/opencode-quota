# opencode-quota-runway Specification

## Purpose
Displays coding-plan quota (5-hour window and weekly allowance) for
multiple OpenCode model providers inside the OpenCode TUI with
timer-based pull, derived runway projection, theme-native rendering,
and layered configuration. The plugin is provider-agnostic; the
provider is selected from the active session's model.

## Requirements

### Requirement: Plugin identity

The plugin SHALL be registered with the OpenCode plugin id
`opencode-quota-runway`, the slash command name `quota-runway`
(alias `qr`), the keymap command name `opencode-quota-runway.refresh`,
and the human-readable name "OpenCode Quota Runway".

#### Scenario: plugin loads under the new id

- **WHEN** OpenCode reads the plugin's `default` export
- **THEN** the plugin is identified by `id: "opencode-quota-runway"`
  and the slash command list shows `quota-runway` (with `qr` as
  an alias) in the command palette

#### Scenario: legacy slash command is gone

- **WHEN** the user opens the command palette
- **THEN** `zai-quota` and `zq` no longer appear; the entry is
  `quota-runway` (and `qr`)

### Requirement: Provider-agnostic quota pull

The system SHALL fetch the active session's quota provider's quota
(5-hour window and weekly allowance from the provider's payload) on
a timer, on session-idle (throttled), on session-error (forced), and
on explicit user command, using a bearer token resolved from the
provider's auth.json keys and environment variables. The refresh
engine SHALL track and reset burn-rate histories per provider so
samples from one provider do not pollute another.

#### Scenario: timer pull

- **WHEN** the plugin is loaded, a token resolves, and the active
  session has a registered provider
- **THEN** a fetch is scheduled immediately and repeated every
  `intervalMs` (clamped to at least 10 s), with in-flight dedupe so
  overlapping triggers produce exactly one request

#### Scenario: missing token

- **WHEN** no token resolves from the active provider's auth.json
  keys or environment variables
- **THEN** the plugin enters the `no-token` error state, renders
  the chip in the error shape, and never throws or logs the token
  value

#### Scenario: provider switch resets burn history

- **WHEN** the active session's model provider changes
- **THEN** the next refresh starts a fresh burn-rate history; the
  new provider's samples are not aggregated with the previous
  provider's samples

### Requirement: Runway projection

The system SHALL derive, per limit, a burn-rate-based runway
(projected time-to-quota-exhaustion from in-window usage samples)
and distinguish the states no-limit, no-reset, no-data, no-burn,
ok, and warn, where warn means projected exhaustion before the
window reset time.

#### Scenario: projected exhaustion before reset

- **WHEN** two or more samples exist in the current 5-hour window,
  the derived burn rate is positive, and runway is shorter than
  time-to-reset
- **THEN** the row is marked warn and the panel shows the runway
  estimate

#### Scenario: window boundary

- **WHEN** the reset timestamp changes between samples or
  in-window usage decreases
- **THEN** the sample history resets so burn rate is never
  computed across windows

### Requirement: Status verdict

The system SHALL classify each window's state into one of
`ok`, `tight`, `short`, `blocked`, or `unknown` based on usage,
limit, runway, reset distance, span, and the configured tight
factor; the panel header SHALL surface the worst verdict as the
chip glyph.

#### Scenario: exhaustion before reset

- **WHEN** `runwayMs < resetInMs` and the run is shorter than
  the reset distance
- **THEN** the row is `short` and the chip reflects the worst
  verdict across rows

#### Scenario: blocked independent of runway

- **WHEN** `usage >= limit` (hard exhaustion) regardless of the
  runway projection
- **THEN** the row is `blocked` and the chip reflects the worst
  verdict

#### Scenario: stale invalidates verdict only

- **WHEN** the panel is in a stale state (cached rows beyond
  two refresh intervals)
- **THEN** per-row verdicts degrade to `unknown` but rows are
  not removed from the panel

### Requirement: Pace marker

The system SHALL render, for each window row, a pace marker on
the gauge whose horizontal position represents elapsed time within
the window. The window duration SHALL be carried on the row itself
as `windowMs: number`, and the marker SHALL be drawn at column
`floor((elapsed / windowMs) * gaugeWidth)`, clamped to
`[0, gaugeWidth-1]`, where `elapsed = now - (resetAt - windowMs)`.
When `resetAt` is unknown (rolling window), no marker SHALL be
drawn and the detail line SHALL show `rolling` (with the window's
display label appended when available) in place of a reset time.
A non-finite elapsed, a non-positive windowMs, or a gauge width
below 2 SHALL suppress the marker. The marker SHALL be rendered as
a single theme-resolved foreground color distinct from the gauge
fill.

#### Scenario: burning faster than time

- **WHEN** elapsed exceeds the linear expectation at the
  configured tight-band factor
- **THEN** the row's verdict is `short` and the runway line
  carries the shortfall annotation; the marker still renders at
  its computed column

#### Scenario: unknown window duration

- **WHEN** a row has no `windowMs` or `windowMs <= 0`
- **THEN** no marker is drawn and the row falls through to the
  unknown verdict

#### Scenario: rolling window

- **WHEN** a row has a `windowMs` but no `resetAt` (rolling
  window anchored to first consumption, not the calendar)
- **THEN** no marker is drawn, the row's verdict is `unknown`,
  and the detail line shows `rolling` (or `rolling <label>` when
  a label is available) in place of a reset time

### Requirement: Window duration is row-owned

The system SHALL carry the pace-marker window duration on each
quota row as `windowMs: number` and SHALL NOT maintain a
per-provider unit-code lookup table inside the data model.
Adapter code that converts a provider's payload into rows is
responsible for translating any provider-specific unit identifier
into `windowMs` at the boundary.

#### Scenario: provider-specific unit translated at the boundary

- **WHEN** a provider's payload names a window by a
  provider-specific unit code (for example `unit: 3` for the 5h
  Z.AI window)
- **THEN** the adapter produces a row with
  `windowMs: 300 * 60_000` (and the corresponding value for 7d),
  and the row carries no `unit` field visible to the renderer
  or the data model

#### Scenario: rolling window without reset

- **WHEN** a provider's payload gives a window duration but no
  `nextResetTime` (for example the rolling 5h Zhipu window)
- **THEN** the adapter produces a row with `windowMs` set and
  `resetAt: null`, and the panel renders the rolling state per
  the Pace marker requirement

### Requirement: Interactive refresh

The system SHALL refresh quota on click anywhere in the panel
(including the error state) via mouseup without a preceding drag;
a forced click refresh SHALL bypass the idle throttle but respect
in-flight deduplication and a 1-second click-force cooldown; the
panel SHALL show an updating indicator while a refresh is in
flight, and the header SHALL NOT show a misleading fresh
timestamp: during failures it ages from the last attempt and
marks staleness after 2× the refresh interval, while healthy
data ages from the last successful refresh. The chip SHALL NOT
be clickable.

#### Scenario: click during in-flight refresh

- **WHEN** a refresh is in flight and the user clicks the panel
- **THEN** the in-flight request is reused (deduplication), the
  click is rate-limited by the 1-second cooldown, and the panel
  re-renders the updating indicator without producing a duplicate
  fetch

#### Scenario: text selection does not refresh

- **WHEN** the user drags the mouse to select text inside the
  panel and releases
- **THEN** no refresh is triggered; only a true click (mouseup
  without a preceding drag) triggers one

### Requirement: Theme-native rendering

The system SHALL render a borderless sidebar panel aligned with
the native sidebar sections (zero box padding, first section
position) on a fixed 38-column grid: label column at 0, gauge at
columns 4-19, right-aligned percent at 21-24, right-aligned
usage pair at 26-34, right-aligned verdict glyph in a
two-character slot at 36-37, detail line flush at column 0, and
header suffix (level/freshness) right-aligned ending at column
37. Every rendered line SHALL stay within the panel width in
every state and glyph mode via explicit boundary rules: freshness
capped at 8 characters with tiered units, percent display
clamped to 0..999, over-wide usage pairs dropped, detail lines
degraded by a fixed ladder (recovery time, then shortfall, then
reset) never exceeding the width, and error messages pre-sized
to fit. Every text element SHALL carry an explicit foreground
color from the five universal semantic theme tokens; an ASCII
fallback mode SHALL preserve the same grid and semantics. The
header's plan-level segment SHALL carry the title's text role
(not the freshness tail's warning or textMuted role) so the
plan name does not recolor when the panel is updating or stale.
The panel header's title and chip prefix SHALL be the active
provider's display label and chip prefix, not a hard-coded
literal.

#### Scenario: theme purity

- **WHEN** any rendered element picks a color
- **THEN** the value comes from `api.theme.current` via the
  single role-mapping module, and every text element carries an
  explicit fg — no text relies on the terminal or theme default
  foreground

#### Scenario: readable on light themes

- **WHEN** the active theme has a light background (e.g.
  solarized-light)
- **THEN** all text remains visible because every element uses
  its theme's semantic foreground, never the renderer default

#### Scenario: grid alignment

- **WHEN** the panel renders any line (header, window, detail,
  error, loading)
- **THEN** the line occupies exactly 38 columns when target
  width = GRID.width

#### Scenario: worst-case values never overflow

- **WHEN** any field hits its width cap (long level, long
  freshness, wide usage)
- **THEN** the fixed boundary ladder removes the overflowing
  field in the documented order and the line still ends at or
  before column 37

#### Scenario: plan name keeps title role while freshness changes

- **WHEN** the panel is updating or stale and a plan level is
  present
- **THEN** the title, the `·` separator, and the level segment
  all carry the text role, and only the freshness tail carries
  the warning role

#### Scenario: plan name keeps title role in idle state

- **WHEN** the panel is idle (not updating, not stale) and a
  plan level is present
- **THEN** the title, the `·` separator, and the level segment
  all carry the text role, and the freshness tail carries the
  textMuted role

#### Scenario: provider label drives the header

- **WHEN** the active provider is `minimax-coding-plan`
- **THEN** the panel header reads the MiniMax provider's
  display label (or that label with no level when the payload
  does not supply one), not the literal `Z.ai Runway`

#### Scenario: provider prefix drives the chip

- **WHEN** the active provider is `minimax-coding-plan`
- **THEN** the chip renders the MiniMax provider's configured
  chip prefix in place of the Zhipu provider's ` zai ` prefix

### Requirement: Configuration

The system SHALL accept configuration at three layers (built-in
defaults, `OPENCODE_QUOTA_RUNWAY_*` environment variables, plugin
options object), where later layers override earlier ones and any
invalid value falls back to that key's default with a recorded
warning instead of throwing. Keys SHALL include `tightFactor`
(finite, >= 1, default 1.5), `glyphs` ("unicode" | "ascii",
default "unicode"), `detail` ("always" | "auto", default
"always"), and `gaugeWidth` (int clamp 4..40, default 26), in
addition to the legacy keys. The legacy `ZAI_QUOTA_*` environment
variable names SHALL continue to work for backward compatibility
and SHALL apply to the Zhipu provider.

#### Scenario: invalid override

- **WHEN** an environment variable or option object value is
  malformed for its key
- **THEN** the key falls back to its built-in default and a
  single warning toast lists the rejected keys at startup

#### Scenario: tight factor validation

- **WHEN** `tightFactor` is non-finite or below 1
- **THEN** the value is replaced with 1.5 and the warning toast
  records the rejection

### Requirement: Modern TUI API only

The system SHALL register its command via
`api.keymap.registerLayer` and slots via `api.slots.register`,
using no deprecated `api.command.*` APIs, and SHALL dispose all
timers, event subscriptions, and the keymap layer on plugin
dispose.

#### Scenario: provider resolved after startup mounts the slots once

- **WHEN** the plugin loads with no resolvable quota provider (the
  OpenCode TUI booted on the home screen, the session cache has no
  model yet, or the provider is switched in later) and a session
  with a quota provider is selected afterwards
- **THEN** `api.slots.register` is called at that point and not at
  load time, the sidebar panel and status chip render for the whole
  session, a refresh is scheduled for the newly resolved provider,
  and further provider events do not register a second set of slots;
  an unrecognized provider still leaves the panel unregistered

#### Scenario: clean load and dispose

- **WHEN** the plugin is loaded and then OpenCode disposes it
  (host-driven dispose)
- **THEN** every `setInterval` is cleared, every event
  subscription is detached, the keymap layer is disposed, and
  no unhandled rejection or dangling fetch is left behind

### Requirement: Stable installation contract

The system SHALL register and load through a stable-path
indirection under the user's home so that source-tree renames
and moves do not break OpenCode's plugin load: a directory-level
symlink at `~/Sync/Repo/opencode-quota-runway-plugin` points at
the current source tree, and `~/.config/opencode/tui.json`'s
`plugin[]` entry references the plugin entry point as
`file://<symlink>/src/index.ts` (the symlink path, not the
source-tree path). Renaming or moving the source tree SHALL
leave the symlink as the only thing that needs touching. The
rename recovery recipe — relocate the source, run
`ln -sfn <new-location> ~/Sync/Repo/opencode-quota-runway-plugin`,
restart OpenCode — SHALL be documented in the repository README.

#### Scenario: plugin loads through the stable symlink

- **WHEN** OpenCode starts with `~/.config/opencode/tui.json`
  pointing at
  `file://~/Sync/Repo/opencode-quota-runway-plugin/src/index.ts`
  and the symlink resolves to the current source tree
- **THEN** OpenCode loads the plugin default export, the
  plugin id `opencode-quota-runway` is registered, and the
  quota sidebar and chip render under that id (not the
  directory name)

#### Scenario: source-tree rename keeps the load working

- **WHEN** the source tree is renamed from `opencode-quota` to
  `opencode-quota-v2`, the symlink is repointed with
  `ln -sfn ~/Sync/Repo/opencode-quota-v2 ~/Sync/Repo/opencode-quota-runway-plugin`,
  and OpenCode is restarted
- **THEN** `tui.json` is unchanged and the plugin still loads;
  the plugin id `opencode-quota-runway` (not
  `opencode-quota-v2`) is registered

#### Scenario: tui.json path matches the documented indirection

- **WHEN** the README's install section documents the
  stable-symlink path verbatim
- **THEN** the recorded `tui.json` value equals the documented
  value; a strict equality check between the README snippet and
  the live `tui.json` succeeds (catches drift at review time)

#### Scenario: rename recovery recipe is reproducible

- **WHEN** the README is followed step-by-step after a
  hypothetical rename
- **THEN** every command runs to completion in a POSIX shell
  without editing files outside the documented set; the
  resulting OpenCode session shows the quota sidebar and chip
  on first start
