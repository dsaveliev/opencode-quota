import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const README = join(import.meta.dir, "..", "README.md");
const TUI_PATH = join(process.env.HOME ?? "", ".config/opencode/tui.json");
const REQUIRED_TOKEN = "opencode-quota-runway-plugin/src/index.ts";

/** Extract every `file://...opencode-quota-runway-plugin/src/index.ts`
 *  token the README documents; dedupe so the simple-array form and the
 *  options-tuple form both surfaces are reported once each. */
function readmeDeclaredPaths(): string[] {
  if (!existsSync(README)) return [];
  const text = readFileSync(README, "utf8");
  const matches = text.match(/file:\/\/[^\s"`']*\/src\/index\.ts/g) ?? [];
  return Array.from(new Set(matches));
}

/** Read the configured plugin path out of the live tui.json. Returns
 *  null if HOME is unset, the file is missing/unreadable, or the
 *  plugin array is empty — i.e., this is a sandbox/CI machine. */
function liveTuiPluginPath(): string | null {
  if (!process.env.HOME) return null;
  if (!existsSync(TUI_PATH)) return null;
  try {
    const raw = readFileSync(TUI_PATH, "utf8");
    const parsed = JSON.parse(raw) as { plugin?: unknown };
    if (!Array.isArray(parsed.plugin) || parsed.plugin.length === 0) return null;
    const first = parsed.plugin[0];
    return typeof first === "string" ? first : null;
  } catch {
    return null;
  }
}

const skipNoHome = !process.env.HOME;
const skipNoTui = !existsSync(TUI_PATH);

// Drift check: README-declared install path matches the live tui.json value.
describe("installation contract", () => {
  test.skipIf(skipNoHome || skipNoTui)(
    "tui.json plugin[0] equals the README-declared install path",
    () => {
      const home = process.env.HOME!;
      const live = liveTuiPluginPath();
      expect(live).not.toBeNull();
      const declared = readmeDeclaredPaths();
      // At minimum the simple-array form must be present in the README.
      const simple = declared.find((s) => s.endsWith(REQUIRED_TOKEN));
      expect(simple).toBeDefined();
      const expected = simple!.replaceAll("$HOME", home);
      expect(live).toBe(expected);
    },
  );

  test.skipIf(skipNoHome || skipNoTui)(
    "plugin module loads through the symlinked file:// URL",
    async () => {
      const home = process.env.HOME!;
      const declared = readmeDeclaredPaths();
      const simple = declared.find((s) => s.endsWith(REQUIRED_TOKEN));
      expect(simple).toBeDefined();
      const url = simple!.replaceAll("$HOME", home);
      const mod = await import(url);
      expect(mod.default).toBeDefined();
      expect(mod.default.id).toBe("opencode-quota-runway");
      expect(typeof mod.default.tui).toBe("function");
    },
  );
});
