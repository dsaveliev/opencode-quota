import type { QuotaRow } from "../api";
import type { ParsedQuota, QuotaProvider } from "./types";

/**
 * Zhipu / Z.AI coding plan provider. Probing on the user's machine
 * confirmed the two keys (`zai`, `zhipuai-coding-plan`) and the two
 * hosts (`api.z.ai`, `open.bigmodel.cn`) return identical payloads,
 * so one module covers all three OpenCode provider ids
 * (`zai`, `zai-coding-plan`, `zhipuai-coding-plan`).
 *
 * The endpoint is configurable through the legacy `ZAI_QUOTA_ENDPOINT`
 * environment variable, which the wiring layer applies as an override
 * before the registry's `endpoints[]` is consulted.
 */

const SCAN_FIELDS = ["usage", "currentValue", "remaining", "percentage", "nextResetTime"] as const;
const MAX_SCAN_DEPTH = 6;
const MAX_ROWS = 16;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function windowMsForUnit(unit: number | undefined): number | undefined {
  if (unit === 3) return 5 * 60 * 60 * 1000;
  if (unit === 6) return 7 * 24 * 60 * 60 * 1000;
  return undefined;
}

function entryLabel(entry: Record<string, unknown>): string {
  if (entry.unit === 3) return "5h";
  if (entry.unit === 6) return "7d";
  return typeof entry.type === "string" && entry.type !== "" ? entry.type : "quota";
}

function mapEntry(entry: Record<string, unknown>): QuotaRow {
  const currentValue = finiteNumber(entry.currentValue);
  const usageField = finiteNumber(entry.usage);
  const usage =
    currentValue !== undefined ? currentValue : usageField !== undefined ? usageField : null;
  const remaining = finiteNumber(entry.remaining);
  let limit: number | null = null;
  if (usage !== null && remaining !== undefined) {
    const sum = usage + remaining;
    if (Number.isFinite(sum)) limit = sum;
  }
  const percentage = finiteNumber(entry.percentage);
  let percent: number | null = null;
  if (percentage !== undefined) {
    percent = Math.min(100, Math.max(0, percentage));
  } else if (usage !== null && limit !== null && limit > 0) {
    percent = (usage / limit) * 100;
  }
  const nextReset = finiteNumber(entry.nextResetTime);
  const unit = finiteNumber(entry.unit);
  const windowMs = windowMsForUnit(unit);
  return {
    label: entryLabel(entry),
    usage,
    limit,
    percent,
    resetAt: nextReset !== undefined ? nextReset : null,
    ...(windowMs !== undefined ? { windowMs } : {}),
  };
}

function extractData(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = (payload as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null) return null;
  return data as Record<string, unknown>;
}

function extractLevel(payload: unknown): string | null {
  const data = extractData(payload);
  if (data === null) return null;
  const level = data.level;
  return typeof level === "string" && level !== "" ? level : null;
}

function isEntryObject(entry: unknown): entry is Record<string, unknown> {
  if (typeof entry !== "object" || entry === null) return false;
  return Object.keys(entry).length > 0;
}

function scanForRows(
  node: unknown,
  depth: number,
  visited: Set<object>,
  rows: QuotaRow[],
): void {
  if (rows.length >= MAX_ROWS) return;
  if (depth > MAX_SCAN_DEPTH) return;
  if (typeof node !== "object" || node === null) return;
  if (visited.has(node)) return;
  visited.add(node);
  if (Array.isArray(node)) {
    for (const item of node) scanForRows(item, depth + 1, visited, rows);
    return;
  }
  const record = node as Record<string, unknown>;
  const numericCount = SCAN_FIELDS.filter((field) => finiteNumber(record[field]) !== undefined).length;
  if (numericCount >= 2) {
    rows.push(mapEntry(record));
  }
  for (const value of Object.values(record)) {
    scanForRows(value, depth + 1, visited, rows);
  }
}

function parse(payload: unknown): ParsedQuota {
  const level = extractLevel(payload);
  const rows: QuotaRow[] = [];
  const data = extractData(payload);
  const limits = data === null ? undefined : data.limits;
  if (Array.isArray(limits) && limits.length > 0) {
    for (const entry of limits) {
      if (rows.length >= MAX_ROWS) break;
      if (isEntryObject(entry)) rows.push(mapEntry(entry));
    }
    return { rows, level };
  }
  scanForRows(payload, 0, new Set<object>(), rows);
  return { rows, level };
}

export const zhipuProvider: QuotaProvider = {
  id: "zhipu",
  providerIds: ["zai", "zai-coding-plan", "zhipuai-coding-plan"],
  label: "Z.ai Runway",
  chipPrefix: " zai ",
  authKeys: ["zai-coding-plan", "zai"],
  tokenEnv: ["ZAI_TOKEN", "Z_AI_TOKEN"],
  endpoints: [
    "https://api.z.ai/api/monitor/usage/quota/limit",
    "https://open.bigmodel.cn/api/monitor/usage/quota/limit",
  ],
  parse,
  errorText: (code) => {
    if (code === "no-token") return "no token (zai login or ZAI_TOKEN)";
    return code;
  },
};
