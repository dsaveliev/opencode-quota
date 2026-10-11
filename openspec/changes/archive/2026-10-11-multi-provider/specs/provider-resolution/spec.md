# Spec Delta

## Purpose

Resolves the active OpenCode model provider to a registered quota
provider, hides the panel and chip when no provider matches, and
exposes a command that toasts the current provider status.

## ADDED Requirements

### Requirement: Active provider resolution

The system SHALL resolve the quota provider to use for the current
session by reading `api.state.session.get(sessionID).model.providerID`
on startup and on each `session.next.model.switched` and
`tui.session.select` event. The resolution SHALL look up the
provider id in a built-in registry and SHALL fall back to "no
provider" if the id is not registered. The active provider id
SHALL be exposed through the rendered panel header and the chip
prefix.

#### Scenario: registered provider

- **WHEN** the active session's model provider id matches a registry
  entry (for example `zhipuai-coding-plan` or `minimax-coding-plan`)
- **THEN** the panel and chip render using that provider's display
  label, chip prefix, and parser; the refresh engine fetches from
  that provider's endpoint

#### Scenario: unregistered provider

- **WHEN** the active session's model provider id does not match a
  registry entry (for example `openai`, `work-litellm`, or any
  custom provider)
- **THEN** the sidebar slot and the chip slot are not registered, the
  refresh engine does not poll, and the command toasts
  `no quota provider for <providerID>`

#### Scenario: provider switch

- **WHEN** the user switches the active model to a different provider
  mid-session
- **THEN** the panel and chip update to the new provider on the next
  render, the history maps are reset (or keyed so the new provider's
  samples do not mix with the previous provider's), and the refresh
  engine fetches from the new provider's endpoint

### Requirement: Provider registry

The system SHALL ship a built-in provider registry with one entry per
supported provider. Each entry SHALL include: a unique id, the OpenCode
provider ids it serves, the display label used in the panel header,
the chip prefix, the auth.json keys it owns, the environment variable
names it reads for token fallback, the endpoint hosts it probes
(in declaration order, with the first successful probe remembered),
the payload parser, and a per-provider error text function. The
registry SHALL be extensible by future code without modifying
existing entries.

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
