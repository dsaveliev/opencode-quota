# Tasks

## 1. Render role split

- [ ] 1.1 In `src/render.ts` `renderHeader` (around line 238-243), change the
  `sep` and `level` segments to use the `text` role (matching the title) and
  leave the freshness tail on the `role` variable. Verify by reading the
  file: the title, `·` separator, and level segments all carry `role: "text"`,
  and only the trailing "pad + right" segment carries the state `role`.
- [ ] 1.2 In `src/render.test.ts` remove the case "updating + level: cluster
  keeps warning role (colors untouched)" (around line 528) and add two
  replacement cases pinning the corrected behavior: (a) "updating + level:
  title/sep/level are text, freshness tail is warning" and (b) "stale + level:
  title/sep/level are text, freshness tail is warning". Verify by running
  `bun test src/render.test.ts` and seeing the new cases pass.
- [ ] 1.3 Run `bun run check` and `bun test` from the repo root and verify
  the whole suite is green with the existing 2,000+ tests still passing.
