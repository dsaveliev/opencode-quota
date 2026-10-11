export type QuotaRow = {
  label: string;
  usage: number | null;
  limit: number | null;
  percent: number | null;
  resetAt: number | null;
  /** Window duration in milliseconds; absent when the provider cannot supply it. */
  windowMs?: number;
};

export type FetchResult = { ok: true; payload: unknown } | { ok: false; error: string };

/**
 * Single shared fetch wrapper. Each provider supplies its own endpoint
 * and bearer token; this function owns timeout, abort, and HTTP-status
 * translation. Provider-specific success semantics (e.g. MiniMax's
 * `base_resp.status_code`) are handled by the provider's parser after
 * the payload is returned.
 */
export async function fetchQuota(
  fetchImpl: (
    url: string,
    init: { headers: Record<string, string>; signal: AbortSignal },
  ) => Promise<{ status: number; text: string }>,
  token: string,
  config: { endpoint: string; timeoutMs: number },
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutMs =
    typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) ? config.timeoutMs : 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const timeoutPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("timeout")));
  });

  try {
    const response = await Promise.race([
      fetchImpl(config.endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);

    if (response.status >= 400) {
      return { ok: false, error: `http-${response.status}` };
    }

    try {
      const payload: unknown = JSON.parse(response.text);
      return { ok: true, payload };
    } catch {
      return { ok: false, error: "bad-json" };
    }
  } catch {
    if (controller.signal.aborted) {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}
