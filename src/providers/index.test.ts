import { describe, expect, test } from "bun:test";
import { providers, resolve } from "./index";

describe("providers registry", () => {
  test("every registered provider has a unique id", () => {
    const ids = new Set<string>();
    for (const p of providers) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
    expect(ids.size).toBe(providers.length);
  });

  test("every served providerId is owned by exactly one entry", () => {
    const seen = new Map<string, string>();
    for (const p of providers) {
      for (const id of p.providerIds) {
        const prev = seen.get(id);
        expect(prev).toBeUndefined();
        seen.set(id, p.id);
      }
    }
  });

  test("resolve is case-sensitive and exact", () => {
    expect(resolve("zhipuai-coding-plan")?.id).toBe("zhipu");
    expect(resolve("minimax-coding-plan")?.id).toBe("minimax");
    expect(resolve("Zhipuai-Coding-Plan")).toBeNull();
    expect(resolve("MINIMAX-CODING-PLAN")).toBeNull();
  });

  test("resolve returns null for unknown and empty", () => {
    expect(resolve("openai")).toBeNull();
    expect(resolve("work-litellm")).toBeNull();
    expect(resolve(undefined)).toBeNull();
    expect(resolve(null)).toBeNull();
    expect(resolve("")).toBeNull();
  });
});
