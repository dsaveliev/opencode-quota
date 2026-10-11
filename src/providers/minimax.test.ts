import { describe, expect, test } from "bun:test";
import { minimaxProvider } from "./minimax";

const W5H = 5 * 60 * 60 * 1000;
const W7D = 7 * 24 * 60 * 60 * 1000;

// Captured from the live probe of the user's own auth.json entry; the
// values are pinned as a golden so the parser does not silently drift
// against a real payload.
const livePayload = {
  model_remains: [
    {
      start_time: 1791710733139,
      end_time: 1791728733139,
      remains_time: 13667872,
      current_interval_total_count: 0,
      current_interval_usage_count: 0,
      model_name: "general",
      current_weekly_total_count: 0,
      current_weekly_usage_count: 0,
      weekly_start_time: 1791710733139,
      weekly_end_time: 1792315533139,
      weekly_remains_time: 600467872,
      current_interval_status: 1,
      current_interval_remaining_percent: 91,
      current_weekly_status: 1,
      current_weekly_remaining_percent: 99,
    },
  ],
  base_resp: { status_code: 0, status_msg: "success" },
};

describe("minimax provider", () => {
  test("serves three OpenCode provider ids including the cn alias", () => {
    expect(minimaxProvider.providerIds).toEqual([
      "minimax",
      "minimax-coding-plan",
      "minimax-cn-coding-plan",
    ]);
  });

  test("parse: live payload inverts remaining_percent and emits pseudo-usage rows", () => {
    const { rows } = minimaxProvider.parse(livePayload);
        expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      label: "5h",
      usage: 9,
      limit: 100,
      percent: 9,
      resetAt: 1791728733139,
      windowMs: W5H,
    });
    expect(rows[1]).toEqual({
      label: "7d",
      usage: 1,
      limit: 100,
      percent: 1,
      resetAt: 1792315533139,
      windowMs: W7D,
    });
  });

  test("parse: empty model_remains returns no rows (designed empty state)", () => {
    const { rows } = minimaxProvider.parse({ model_remains: [], base_resp: { status_code: 0 } });
    expect(rows).toHaveLength(0);
      });

  test("parse: status != 1 drops the row (provider is the source of truth for 'in plan')", () => {
    const blocked = {
      model_remains: [
        {
          ...livePayload.model_remains[0],
          current_interval_status: 0,
          current_weekly_status: 1,
        },
      ],
    };
    const { rows } = minimaxProvider.parse(blocked);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("7d");
  });

  test("endpoints declared with .io first, .cn second", () => {
    expect(minimaxProvider.endpoints[0]).toBe("https://api.minimax.io/v1/token_plan/remains");
    expect(minimaxProvider.endpoints[1]).toBe("https://api.minimax.cn/v1/token_plan/remains");
  });

  test("errorText: 'no-token' carries the minimax hint", () => {
    expect(minimaxProvider.errorText("no-token")).toContain("minimax login or MINIMAX_API_KEY");
  });
});
