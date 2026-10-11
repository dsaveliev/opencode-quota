import type { QuotaRow } from "../api";
import type { ParsedQuota, QuotaProvider } from "./types";

/**
 * MiniMax Token Plan provider. Endpoint: GET /v1/token_plan/remains.
 *
 * The payload gives two windows inside a single `model_remains[]` entry:
 *   - current_interval: 5h window, reset at end_time
 *   - weekly: 7d window, reset at weekly_end_time
 *
 * The wire format differs from Zhipu in two important ways:
 *   1. No `unit` field. Window duration is computed from
 *      `end_time - start_time` (= exactly 5h) and
 *      `weekly_end_time - weekly_start_time` (= exactly 7d).
 *   2. No `usage`/`limit` counts: token-plan is percentage-of-time
 *      based, so `current_interval_usage_count` and
 *      `current_interval_total_count` are 0. The percent fields are
 *      `*_remaining_percent` (NOT `*_used_percent`), so the direction
 *      is inverted to derive usage percent.
 *
 * Pseudo-usage: to keep the runway projection usable, the adapter
 * synthesises a 0..100 percent-scale row where `usage = 100 - remaining`
 * and `limit = 100`. The existing `computeRunway` then computes
 * remaining-time from a percent-points burn rate.
 *
 * Region detection: `api.minimax.io` first, then `api.minimax.cn` on a
 * non-zero `base_resp.status_code`. The wiring layer remembers the
 * winner for the plugin lifetime.
 */

const WINDOW_5H_MS = 5 * 60 * 60 * 1000;
const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;

type RawWindow = {
  start_time: number;
  end_time: number;
  remains_time: number;
  current_interval_total_count?: number;
  current_interval_usage_count?: number;
  model_name?: string;
  current_weekly_total_count?: number;
  current_weekly_usage_count?: number;
  weekly_start_time: number;
  weekly_end_time: number;
  weekly_remains_time: number;
  current_interval_status: number;
  current_interval_remaining_percent: number;
  current_weekly_status: number;
  current_weekly_remaining_percent: number;
};

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampPercent(p: number): number {
  return Math.min(100, Math.max(0, p));
}

function buildRow(
  label: string,
  resetAt: number | null,
  windowMs: number,
  remainingPercent: number,
  status: number,
): QuotaRow | null {
  if (!Number.isFinite(remainingPercent)) return null;
  if (status !== 1) return null; // 1 = active in plan
  const usedPercent = clampPercent(100 - remainingPercent);
  return {
    label,
    usage: usedPercent, // pseudo-usage in percent space (0..100)
    limit: 100, // pseudo-limit makes percent math work
    percent: usedPercent,
    resetAt,
    windowMs,
  };
}

function isRawWindow(value: unknown): value is RawWindow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.end_time === "number" &&
    typeof v.weekly_end_time === "number" &&
    typeof v.current_interval_remaining_percent === "number" &&
    typeof v.current_weekly_remaining_percent === "number"
  );
}

function parse(payload: unknown): ParsedQuota {
  if (typeof payload !== "object" || payload === null) return { rows: [] };
  const root = payload as Record<string, unknown>;
  const arr = root.model_remains;
  if (!Array.isArray(arr) || arr.length === 0) return { rows: [] };
  const entry = arr.find(isRawWindow);
  if (!entry) return { rows: [] };
  const rows: QuotaRow[] = [];
  const fiveHour = buildRow(
    "5h",
    finiteNumber(entry.end_time) ?? null,
    WINDOW_5H_MS,
    entry.current_interval_remaining_percent,
    entry.current_interval_status,
  );
  const weekly = buildRow(
    "7d",
    finiteNumber(entry.weekly_end_time) ?? null,
    WINDOW_7D_MS,
    entry.current_weekly_remaining_percent,
    entry.current_weekly_status,
  );
  if (fiveHour) rows.push(fiveHour);
  if (weekly) rows.push(weekly);
  return { rows };
}

export const minimaxProvider: QuotaProvider = {
  id: "minimax",
  providerIds: ["minimax", "minimax-coding-plan", "minimax-cn-coding-plan"],
  label: "MiniMax Runway",
  chipPrefix: " mmx ",
  authKeys: ["minimax-coding-plan", "minimax-cn-coding-plan", "minimax"],
  tokenEnv: ["MINIMAX_API_KEY"],
  endpoints: [
    "https://api.minimax.io/v1/token_plan/remains",
    "https://api.minimax.cn/v1/token_plan/remains",
  ],
  parse,
  errorText: (code) => {
    if (code === "no-token") return "no token (minimax login or MINIMAX_API_KEY)";
    return code;
  },
};
