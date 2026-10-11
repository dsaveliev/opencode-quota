import { describe, expect, test } from "bun:test";
import { zhipuProvider } from "./zhipu";

const W5H = 5 * 60 * 60 * 1000;
const W7D = 7 * 24 * 60 * 60 * 1000;

const happy = {
  data: {
    limits: [
      {
        type: "a",
        unit: 3,
        usage: 100,
        currentValue: 80,
        remaining: 20,
        percentage: 80,
        nextResetTime: 1759000000000,
      },
      { type: "b", unit: 6, currentValue: 5, remaining: 15 },
    ],
  },
};

describe("zhipu provider", () => {
  test("serves three OpenCode provider ids", () => {
    expect(zhipuProvider.providerIds).toEqual([
      "zai",
      "zai-coding-plan",
      "zhipuai-coding-plan",
    ]);
  });

  test("parse: limits[] with unit 3/6 maps to windowMs and the expected fields", () => {
    const { rows } = zhipuProvider.parse(happy);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      label: "5h",
      usage: 80,
      limit: 100,
      percent: 80,
      resetAt: 1759000000000,
      windowMs: W5H,
    });
    expect(rows[1]).toEqual({
      label: "7d",
      usage: 5,
      limit: 20,
      percent: 25,
      resetAt: null,
      windowMs: W7D,
    });
  });

  test("parse: deep-scan fallback when limits[] absent", () => {
    const payload = {
      data: { extra: { type: "migrated", unit: 3, usage: 30, remaining: 70 } },
    };
    const { rows } = zhipuProvider.parse(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("5h");
    expect(rows[0]?.windowMs).toBe(W5H);
  });

  test("errorText: 'no-token' carries the legacy hint", () => {
    expect(zhipuProvider.errorText("no-token")).toContain("zai login or ZAI_TOKEN");
  });

  test("endpoints declared with api.z.ai first", () => {
    expect(zhipuProvider.endpoints[0]).toContain("api.z.ai");
  });
});
