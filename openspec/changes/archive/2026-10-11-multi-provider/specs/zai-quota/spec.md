# Spec Delta

## MODIFIED Requirements

### Requirement: Quota pull

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

### Requirement: Configuration

The system SHALL accept configuration at three layers (built-in
defaults, `OPENCODE_QUOTA_RUNWAY_*` environment variables, plugin
options object), where later layers override earlier ones and any
invalid value falls back to that key's default with a recorded
warning instead of throwing. Keys SHALL include `tightFactor`
(finite, >= 1, default 1.5), `glyphs` ("unicode" | "ascii", default
"unicode"), `detail` ("always" | "auto", default "always"), and
`gaugeWidth` (int clamp 4..40, default 16), in addition to the
legacy keys. The legacy `ZAI_QUOTA_*` environment variable names
SHALL continue to work for backward compatibility and SHALL apply
to the Zhipu provider.

#### Scenario: invalid override

- **WHEN** an environment variable or option object value is
  malformed for its key
- **THEN** the key falls back to its built-in default and a single
  warning toast lists the rejected keys at startup

#### Scenario: tight factor validation

- **WHEN** `tightFactor` is non-finite or below 1
- **THEN** the value is replaced with 1.5 and the warning toast
  records the rejection

### Requirement: Theme-native rendering

The system SHALL render a borderless sidebar panel aligned with the
native sidebar sections (zero box padding, first section position) on
a fixed 38-column grid: label column at 0, gauge at columns 4-19,
right-aligned percent at 21-24, right-aligned usage pair at
26-34, right-aligned verdict glyph in a two-character slot at
36-37, detail line flush at column 0, and header suffix
(level/freshness) right-aligned ending at column 37. The panel
header's title and chip prefix SHALL be the active provider's
display label and chip prefix, not a hard-coded literal.

#### Scenario: theme purity

- **WHEN** any rendered element picks a color
- **THEN** the value comes from `api.theme.current` via the single
  role-mapping module, and every text element carries an explicit
  fg — no text relies on the terminal or theme default foreground

#### Scenario: readable on light themes

- **WHEN** the active theme has a light background (e.g.
  solarized-light)
- **THEN** all text remains visible because every element uses its
  theme's semantic foreground, never the renderer default

#### Scenario: grid alignment

- **WHEN** the panel renders any line (header, window, detail,
  error, loading)
- **THEN** the line occupies exactly 38 columns when target width
  = GRID.width

#### Scenario: worst-case values never overflow

- **WHEN** any field hits its width cap (long level, long freshness,
  wide usage)
- **THEN** the fixed boundary ladder removes the overflowing field
  in the documented order and the line still ends at or before
  column 37

#### Scenario: plan name keeps title role while freshness changes

- **WHEN** the panel is updating or stale and a plan level is
  present
- **THEN** the title, the `·` separator, and the level segment all
  carry the text role, and only the freshness tail carries the
  warning role

#### Scenario: plan name keeps title role in idle state

- **WHEN** the panel is idle (not updating, not stale) and a plan
  level is present
- **THEN** the title, the `·` separator, and the level segment all
  carry the text role, and the freshness tail carries the textMuted
  role

#### Scenario: provider label drives the header

- **WHEN** the active provider is `minimax-coding-plan`
- **THEN** the panel header reads the MiniMax provider's display
  label (or that label with no level when the payload does not
  supply one), not the literal `Z.ai Runway`

#### Scenario: provider prefix drives the chip

- **WHEN** the active provider is `minimax-coding-plan`
- **THEN** the chip renders the MiniMax provider's configured chip
  prefix in place of the Zhipu provider's ` zai ` prefix
