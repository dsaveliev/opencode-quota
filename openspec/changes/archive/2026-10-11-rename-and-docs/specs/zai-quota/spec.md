# Spec Delta

## REMOVED Requirements

### Requirement: zai-quota capability (whole)
**Reason**: the plugin is no longer Z.AI-specific. The capability
name bound it to a single provider and misleads readers of the
new spec tree. The same body of behaviour (Quota pull, Runway
projection, Theme-native rendering, Configuration, Status
verdict, Pace marker, Interactive refresh, Window duration is
row-owned, Rolling window, Modern TUI API only, plus Plugin
identity) now lives at `opencode-quota-runway`.
**Migration**: archive `zai-quota` into `opencode-quota-runway`
during the rename change; update any code or docs that refer
to the `zai-quota` spec id to use `opencode-quota-runway`.
