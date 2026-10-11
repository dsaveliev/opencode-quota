/**
 * Elapsed time within a window: `now - (resetAt - windowMs)`. Pure: inputs
 * are never mutated. The data model no longer carries a provider-specific
 * unit code; `windowMs` is carried on each `QuotaRow` and threaded through
 * the marker by the model layer.
 */
export function elapsedMs(now: number, resetAt: number, windowMs: number): number {
  return now - (resetAt - windowMs);
}

export function markerIndex(elapsed: number, windowMs: number | null | undefined, width: number): number | null {
  // Symmetric finite guard: non-finite elapsed (NaN, ±Infinity) is garbage in → no marker.
  if (!Number.isFinite(elapsed)) return null;
  if (windowMs == null || !Number.isFinite(windowMs) || windowMs <= 0 || width < 2) return null;
  const index = Math.floor((elapsed / windowMs) * width);
  return Math.min(Math.max(index, 0), width - 1);
}
