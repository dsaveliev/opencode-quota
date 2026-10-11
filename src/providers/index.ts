import { minimaxProvider } from "./minimax";
import type { QuotaProvider } from "./types";
export type { QuotaProvider } from "./types";
import { zhipuProvider } from "./zhipu";

/**
 * Built-in provider registry. Order matters only for documentation
 * purposes; lookup is exact-match on the OpenCode provider id.
 */
export const providers: readonly QuotaProvider[] = [zhipuProvider, minimaxProvider];

/**
 * Resolve an OpenCode provider id to a registered quota provider. The
 * lookup is case-sensitive and exact: a typo or a different-case
 * id returns `null` and the panel hides itself.
 */
export function resolve(providerId: string | undefined | null): QuotaProvider | null {
  if (!providerId) return null;
  for (const p of providers) {
    if (p.providerIds.includes(providerId)) return p;
  }
  return null;
}
