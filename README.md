# opencode-quota

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/dsaveliev/opencode-quota/actions/workflows/ci.yml/badge.svg)](https://github.com/dsaveliev/opencode-quota/actions/workflows/ci.yml)
[![Bun](https://img.shields.io/badge/runtime-bun-F9F1CC.svg?logo=bun)](https://bun.sh)
[![opencode plugin](https://img.shields.io/badge/opencode-plugin-8A2BE2.svg)](https://opencode.ai/docs/plugins)


OpenCode TUI plugin that shows your coding-plan quota — the 5-hour window and the
weekly allowance — as a sidebar panel plus a status-line chip, and derives a **RUNWAY**
projection from your burn rate: at the current pace, will the quota last until the window
resets? Pulled on a timer, theme-native, fully configurable.

Supports the **Zhipu / Z.AI coding plan** (`zai`, `zai-coding-plan`, `zhipuai-coding-plan`)
and the **MiniMax Token Plan** (`minimax`, `minimax-coding-plan`, `minimax-cn-coding-plan`).
The active provider is detected from the OpenCode session's model; an unknown provider
hides the panel and toasts `no quota provider for <id>` on command.

This is a redesign of the [josvaal/opencode-zai-quota](https://github.com/josvaal/opencode-zai-quota)
concept, rebuilt on the modern keymap API — no deprecated `api.command`, so no deprecation
warnings at startup (cf. [PR #1](https://github.com/josvaal/opencode-zai-quota/pull/1)
against the original). The plugin was renamed from `opencode-zai-quota` to
`opencode-quota` when the second provider landed; the legacy `ZAI_QUOTA_*`
environment variables and the legacy `zai`/`zhipuai-coding-plan` auth.json keys continue
to work.

## What it looks like

Generated from code — `bun tmp/gen-mock.ts` prints this exact block via
`buildPanel` + `renderPanelLines` (unicode glyphs, `gaugeWidth` 26, the
render layer's own `GRID.width`) from the same inputs as the `model.test.ts`
ok-scenario; the README embed is byte-identical to the script output:

```
Z.ai Runway                    30s ago
5h  ████████████████▎░░░░░░░░░  62%  ✓
reset 1h 12m   runway ~2h 5m
7d  ██████████▋░░░░░░░░░░░░░░░  41%  ✓
reset 3d 4h    runway ~10d
```

Every line targets one fixed 38-column grid (`GRID` in `src/render.ts`):

| Field | Columns | Align |
| --- | --- | --- |
| window label | 0-2 | left |
| gauge bar | 4-29 | — |
| percent | 31-34 | right |
| verdict glyph | 36-37 | right |
| detail line | 0 | left |
| header suffix (`age`) | ends at 37 | right |

The panel registers as the FIRST sidebar section (slot `sidebar_content`,
order 50 — above Context) and renders its box without padding, so the grid
sits flush with the native Context/MCP/LSP sections.

Status chip in the prompt line (same scenario): ` zai 62%·41% ✓`

When a window is running short, the verdict glyph flips to `!!` and the
detail line annotates the projected shortfall (`bun tmp/gen-mock.ts short`;
under width pressure the ladder drops fields in order back → shortfall →
reset):

```
5h  ████████████████████████▉░  96% !!
reset 57m      runway ~5s  (56m short)
```

- Sidebar panel (slot `sidebar_content`): block gauges with partial-cell fill,
  reset countdown, and a runway line per row.
- Status chip (slot `session_prompt_right`): ` zai <5h>%·<wk>% <glyph>`, the
  glyph colored by the worst verdict across windows.

## Features

**Status verdicts.** Each window gets one of five verdicts; the glyph and the
bar/percent coloring follow it, not raw percentages:

| Glyph | Verdict | Meaning |
| --- | --- | --- |
| `✓` | ok | runway comfortably outlasts the reset |
| `!` | tight | runway lands within `tightFactor` × the reset distance |
| `!!` | short | at the current pace the quota runs dry before the reset |
| `✗` | blocked | usage is at (or over) the limit |
| `?` | unknown | stale sample, or not enough runway data yet |

**Pace marker.** The `│` pipe inside each gauge marks NOW within the window —
elapsed time since the window start, projected onto the bar. Fill left of the
marker is quota consumed so far; the distance from marker to the right edge is
how much window is left.

**Click-to-refresh.** Clicking the panel (mouseup; a drag/selection never
counts — the drag flag is consumed by the mouseup that saw it) forces a
refresh, with a 1 s cooldown between click-forced refreshes. Timer, session
and command triggers bypass the cooldown, and a click is never cooled down
while data is missing.

**Freshness header.** The panel header shows data age (`30s ago`); data older
than two refresh intervals is flagged `stale` and warning-colored. In an error
state the freshness tracks the last refresh *attempt* instead, so a live but
failing endpoint is not flagged while refreshes keep landing.

**ASCII mode.** `glyphs: "ascii"` renders 7-bit-only surfaces: `#`/`-` fill
(no partial blocks), `|` marker, and ascii substitutions for `·`, `∞`, `…`, `—`.

**State matrix.** What each state shows (short text form):

| State | Panel | Chip (Zhipu / MiniMax) |
| --- | --- | --- |
| ok | gauges + `✓` | ` zai 9%·1% ✓` / ` mmx 9%·1% ✓` |
| tight | gauges + `!` | ` zai …·… !` / ` mmx …·… !` |
| short | `!!` + `(37m short)` note | ` zai …·… !!` / ` mmx …·… !!` |
| blocked | `✗` + `back <local time>` | ` zai …·… ✗` / ` mmx …·… ✗` |
| unknown | muted gauges + `?` | ` zai …·… ?` / ` mmx …·… ?` |
| error | error text replaces gauges | ` zai:? ` / ` mmx:? ` |
| loading | `loading…` | ` zai …` / ` mmx …` |

## Install

> **Module contract** (OpenCode ≥ 1.18): the runtime entry detector reads
> `mod.default` — the entrypoint must `export default { id, tui }` (as
> `src/index.ts` does). Named exports are NOT detected.

### a) From a local copy — global, every project (TUI config)

Register in `~/.config/opencode/tui.json` with a `file://` URL:

```json
{ "plugin": ["file:///absolute/path/to/opencode-quota/src/index.ts"] }
```

### b) From a local copy — per-project (opencode.json)

```json
{ "plugin": ["./path/to/opencode-quota/src/index.ts"] }
```

Run `bun install` in the repo so `solid-js` / `@opentui` resolve for the test
suite; the OpenCode host provides them at runtime.

### c) With options

```json
{
  "plugin": [
    ["file:///abs/path/to/opencode-quota/src/index.ts", { "intervalMs": 300000, "gaugeWidth": 26 }]
  ]
}
```

## Configuration

Precedence: defaults < environment variables < options tuple. Invalid values never
crash the plugin — the key falls back and one warning toast lists everything rejected
or clamped.

Both the legacy `ZAI_QUOTA_*` env var prefix and the new `OPENCODE_QUOTA_RUNWAY_*`
prefix resolve to the same config keys (the new prefix wins when both are set).

| Key | Env var | Default | Validation |
| --- | --- | --- | --- |
| `intervalMs` | `ZAI_QUOTA_INTERVAL_MS` / `OPENCODE_QUOTA_RUNWAY_INTERVAL_MS` | `60000` | number, clamped to 10000–2147483647 |
| `endpoint` | `ZAI_QUOTA_ENDPOINT` / `OPENCODE_QUOTA_RUNWAY_ENDPOINT` | *active provider's first endpoint* (per-provider; no global default) | non-empty string; non-https triggers a warning toast |
| `timeoutMs` | `ZAI_QUOTA_TIMEOUT_MS` / `OPENCODE_QUOTA_RUNWAY_TIMEOUT_MS` | `8000` | number, clamped to 1000–60000 |
| `gaugeWidth` | `ZAI_QUOTA_GAUGE_WIDTH` / `OPENCODE_QUOTA_RUNWAY_GAUGE_WIDTH` | `26` | number, floored to int, clamped to 4–40 |
| `panel` | `ZAI_QUOTA_PANEL` / `OPENCODE_QUOTA_RUNWAY_PANEL` | `true` | env `1`/`true`/`yes` (off: `0`/`false`/`no`); option must be a boolean |
| `chip` | `ZAI_QUOTA_CHIP` / `OPENCODE_QUOTA_RUNWAY_CHIP` | `true` | same boolean rules |
| `maxHistory` | `ZAI_QUOTA_MAX_HISTORY` / `OPENCODE_QUOTA_RUNWAY_MAX_HISTORY` | `120` | number, floored to int, clamped to 2–1000 |
| `tightFactor` | `ZAI_QUOTA_TIGHT_FACTOR` / `OPENCODE_QUOTA_RUNWAY_TIGHT_FACTOR` | `1.5` | number, must be finite and >= 1; violated → default + warning |
| `glyphs` | `ZAI_QUOTA_GLYPHS` / `OPENCODE_QUOTA_RUNWAY_GLYPHS` | `unicode` | exact `unicode`/`ascii` (case-insensitive); anything else → default + warning |
| `detail` | `ZAI_QUOTA_DETAIL` / `OPENCODE_QUOTA_RUNWAY_DETAIL` | `always` | exact `always`/`auto` (case-insensitive); anything else → default + warning |
| `tokenEnv` | — options only | *active provider's `tokenEnv`* (per-provider; e.g. Zhipu `["ZAI_TOKEN", "Z_AI_TOKEN"]`, MiniMax `["MINIMAX_API_KEY"]`) | non-empty string array (min 1 item) |
| `authKeys` | — options only | *active provider's `authKeys`* (per-provider; e.g. Zhipu `["zai-coding-plan", "zai"]`, MiniMax `["minimax-coding-plan", "minimax-cn-coding-plan", "minimax"]`) | non-empty string array (min 1 item) |

When both `panel` and `chip` are disabled the plugin keeps polling so the `/quota-runway` command toast stays live.

## Token & privacy

The token is resolved at runtime on every refresh, first hit wins. The active
provider's auth keys are looked up in `~/.local/share/opencode/auth.json`; the
Zhipu provider uses the legacy entries `zai-coding-plan` then `zai`, the
MiniMax provider uses `minimax-coding-plan` (and `minimax-cn-coding-plan` on the
cn region), with `MINIMAX_API_KEY` as the env fallback.

- The token is sent only to the active provider's endpoint, in the
  `Authorization: Bearer` header.
- It is never logged and never included in error messages or toasts.
- A non-https `endpoint` emits a warning toast: the token would travel over an insecure
  connection.

## Refresh behavior

| Trigger | Behavior |
| --- | --- |
| startup | immediate forced fetch (active provider only) |
| timer | every `intervalMs` (default 60 s) |
| `session.idle` | throttled — skipped if the last fetch started less than `intervalMs / 2` ago |
| `session.error` | forced refresh |
| `session.next.model.switched` / `tui.session.select` | active provider re-resolved from the session's `model.providerID`; history maps reset on a provider switch so burn-rate samples do not cross providers |
| `session.updated` | fallback re-resolution — opencode sometimes lands model changes here rather than `model.switched`; the panel follows either channel |
| `/quota-runway` or `/qr` | forced refresh + toast summary; if no provider matches, toasts `no quota provider for <providerID>` |

Overlapping triggers are deduplicated: while a request is in flight, later triggers join
that request — one fetch, not a storm.

## Runway

Runway is a burn-rate projection. The plugin keeps a per-row usage history (capped at
`maxHistory` samples), derives how fast `usage` grows, and projects the time until
`usage` reaches `limit` — compared against the time until the window resets.

| Shown | State | Meaning |
| --- | --- | --- |
| `runway ∞` | no burn | usage is not growing across observed samples |
| `runway …` | no data | fewer than 2 samples, or under 1 s of history |
| `runway —` | no limit | the row carries no limit to project against |
| *(line hidden)* | no reset | no reset timestamp known for the row |
| `runway ~2h 5m` | ok | projected exhaustion lands after the reset |
| `runway ~35m !!  (37m short)` | short | at the current pace the quota runs out before the reset |

History restarts on a window boundary: a changed `resetAt` or a decreasing `usage`
(new window, counter rolled over) resets that row's samples. Histories are keyed
by `${providerId}:${row.label}` so a provider switch does not mix samples from
two subscriptions.

## Development

```bash
bun install          # deps for tests; the host provides them at runtime
bun test             # full suite
bunx tsc --noEmit    # type check
```

Module map:

- `src/config.ts` — config type, defaults, env/options resolver with clamps and warnings
- `src/token.ts` — token precedence: auth.json keys, then env names
- `src/api.ts` — quota fetch (bearer auth, abort-timeout, error codes); providers handle payload translation
- `src/providers/{types,zhipu,minimax,index}.ts` — built-in provider registry; one module per subscription
- `src/runway.ts` — per-row usage sampling and burn-rate projection
- `src/render.ts` — pure render model: block gauges, chip segments, panel view model
- `src/roles.ts` — semantic color roles mapped to theme tokens
- `src/format.ts` — duration and counter formatting
- `src/tui.tsx` — wiring edge: provider resolution, timer and session events, slots, keymap layer, JSX
- `src/index.ts` — entrypoint: default-exports the TUI plugin module `{ id, tui }`

## Error states

| Code | Panel text | Cause |
| --- | --- | --- |
| `no-token` | `no token (login via the provider or set the env var)` | nothing found via auth.json or env |
| `network` | `network error` | request failed to connect |
| `http-N` | `HTTP N` | endpoint returned status >= 400 |
| `bad-json` | `bad response` | body is not valid JSON |
| `timeout` | `timeout` | no response within `timeoutMs` |
| `empty` | `no data` | response parsed but yielded no rows |
| `no-provider` | `no quota provider for <providerID>` | the active session's model provider id is not in the registry; the panel and chip are hidden until a known provider is active |

While an error is active the chip collapses to a single muted `<prefix>:?` segment
and the panel shows the error text in place of the gauges; the next successful
refresh clears it.

## License

MIT
