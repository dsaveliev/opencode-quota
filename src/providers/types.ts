import type { QuotaRow } from "../api";

/**
 * ParsedQuota: the data shape the parser produces — just the per-window
 * rows. Subscription-tier labels are not surfaced: the header shows only
 * `<Provider Name> Runway` followed by the freshness timer.
 */
export type ParsedQuota = { rows: QuotaRow[] };

/**
 * A registered quota provider. The active OpenCode session's
 * `model.providerID` is looked up in the registry; the first
 * matching entry wins. The contract is intentionally small: only
 * what the data model and the renderer cannot infer from the
 * payload.
 */
export type QuotaProvider = {
  /** Stable id used in keys, logs, and the slash command's toast. */
  id: string;
  /** OpenCode provider ids this entry serves. Lookup is case-sensitive. */
  providerIds: readonly string[];
  /** Panel header title (e.g. "Z.ai Runway", "MiniMax Runway"). */
  label: string;
  /** Chip prefix rendered before the values (e.g. " zai ", " mmx "). */
  chipPrefix: string;
  /** auth.json keys to look up the bearer token under. */
  authKeys: readonly string[];
  /** Env var names to fall back to after auth.json. */
  tokenEnv: readonly string[];
  /**
   * Endpoint hosts to probe in declaration order. The first host whose
   * response carries a success status is remembered as the winner for
   * the plugin lifetime. Most providers declare a single host; the
   * MiniMax provider declares both `.io` and `.cn` for region
   * detection.
   */
  endpoints: readonly string[];
  /** Translate the provider's payload into the unified row shape. */
  parse: (payload: unknown) => ParsedQuota;
  /** Provider-specific error text for a taxonomy code. */
  errorText: (code: string) => string;
};

/**
 * A region-aware provider knows how to detect the right endpoint host
 * and remembers the winner across refreshes. Providers without region
 * ambiguity can omit this; the registry wraps a non-sticky provider
 * with a passthrough.
 */
export type RegionSticky = {
  /**
   * Probe the configured endpoints in order; return the host whose
   * response carries a success status. Caches the winner for the
   * plugin lifetime. The probe issues a real fetch (the same one the
   * refresh engine would issue) and may not throw on non-success
   * status codes.
   */
  pickEndpoint: (probes: ReadonlyArray<(host: string) => Promise<{ ok: boolean }>>) => Promise<string>;
};
