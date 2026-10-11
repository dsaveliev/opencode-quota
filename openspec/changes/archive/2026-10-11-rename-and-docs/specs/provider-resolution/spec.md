# Spec Delta

## ADDED Requirements

### Requirement: Active provider resolution (renamed command)

The system SHALL resolve the active OpenCode model provider id
to a registered quota provider, SHALL hide the panel and chip
when no provider matches, and SHALL expose a command that
toasts the current provider status. The slash command SHALL be
`/quota-runway` (alias `/qr`), the keymap command name SHALL
be `opencode-quota-runway.refresh`, and the toast text SHALL
use the new plugin name. The semantic is identical to the
pre-rename requirement; only the identifiers change.

#### Scenario: registered provider

- **WHEN** the active session's model provider id matches a
  registry entry (for example `zhipuai-coding-plan` or
  `minimax-coding-plan`)
- **THEN** the panel and chip render using that provider's
  display label, chip prefix, and parser; the refresh engine
  fetches from that provider's endpoint

#### Scenario: unregistered provider

- **WHEN** the active session's model provider id does not match
  a registry entry (for example `openai`, `work-litellm`, or
  any custom provider)
- **THEN** the sidebar slot and the chip slot are not
  registered, the refresh engine does not poll, and the
  `/quota-runway` command toasts
  `no quota provider for <providerID>`

#### Scenario: provider switch

- **WHEN** the user switches the active model to a different
  provider mid-session
- **THEN** the panel and chip update to the new provider on the
  next render, the history maps are reset (or keyed so the new
  provider's samples do not mix with the previous provider's),
  and the refresh engine fetches from the new provider's
  endpoint

### Requirement: Provider registry (renamed command)

The system SHALL ship a built-in provider registry with one
entry per supported provider. The MiniMax region probe and the
case-sensitive exact-match lookup SHALL be unchanged from the
pre-rename behaviour. Each entry SHALL continue to include
id, served provider ids, label, chip prefix, auth keys, token
env, endpoints, parser, and per-provider error text.

#### Scenario: registry lookup is case-sensitive and exact

- **WHEN** the active provider id is `zhipuai-coding-plan`
- **THEN** the registry returns the Zhipu provider; an id like
  `Zhipuai-Coding-Plan` (different case) returns no provider

#### Scenario: MiniMax region probe

- **WHEN** the active provider is `minimax-coding-plan` and the
  probe to the first endpoint host fails (`base_resp.status_code`
  not zero) within the configured timeout
- **THEN** the system remembers the next host in the list as the
  winner and uses it for subsequent fetches until the plugin is
  reloaded
