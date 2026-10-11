# Tasks

## 1. Provider contract and registry

- [ ] 1.1 Create `src/providers/types.ts` with the `QuotaProvider`
  type: `id: string`, `providerIds: readonly string[]`,
  `label: string`, `chipPrefix: string`, `authKeys: readonly
  string[]`, `tokenEnv: readonly string[]`, `endpoints: readonly
  string[]`, `parse(payload: unknown): { rows: QuotaRow[]; level:
  string | null }`, and `errorText(code: string): string`. Verify by
  reading the file: the type compiles under `tsc --noEmit` and the
  Zhipu and MiniMax providers below satisfy it.
- [ ] 1.2 Create `src/providers/index.ts` exporting
  `resolve(providerId: string): QuotaProvider | null` and a
  `providers: readonly QuotaProvider[]` array. The lookup is
  case-sensitive, exact-match, and returns `null` when the id is
  not registered. Verify by writing `src/providers/types.test.ts`
  with two cases: a known id returns the provider, an unknown id
  returns `null`. The two cases pass under `bun test`.

## 2. Zhipu provider

- [ ] 2.1 Create `src/providers/zhipu.ts` with the
  Zhipu provider implementation. It serves provider ids
  `zai`, `zai-coding-plan`, `zhipuai-coding-plan`. The
  `endpoints[]` lists `https://api.z.ai/api/monitor/usage/quota/limit`
  first, then `https://open.bigmodel.cn/api/monitor/usage/quota/limit`
  (probed in order on first refresh, the legacy `ZAI_QUOTA_ENDPOINT`
  env override bypasses the probe for these ids). The `parse`
  function preserves today's behaviour: extracts `data.limits[]`
  via `mapEntry`, computes `usage` from `currentValue` (fallback
  to `usage`), `limit = usage + remaining`, `percent` from
  `percentage` (fallback to usage/limit), `resetAt` from
  `nextResetTime`, `windowMs` from `unit: 3 → 5h` and `unit: 6 →
  7d`, and `level` from `data.level` sanitized. Verify by
  extracting the existing parser into the module and running
  `bun test src/api.test.ts` against the existing fixtures with
  no behaviour change.

## 3. MiniMax provider

- [ ] 3.1 Create `src/providers/minimax.ts` with the MiniMax
  provider. It serves provider ids `minimax`,
  `minimax-coding-plan`, `minimax-cn-coding-plan`. The
  `endpoints[]` lists
  `https://api.minimax.io/v1/token_plan/remains` first, then
  `https://api.minimax.cn/v1/token_plan/remains`. The
  region probe in the fetch wrapper checks
  `base_resp.status_code === 0`; on a non-zero code it tries
  the next endpoint; the winner is remembered in a module-level
  cache. Verify by running `bun test src/providers/minimax.test.ts`
  against the live payload pinned as a fixture: rows for
  `5h` (windowMs 5h, resetAt end_time, percent = 100 - remaining)
  and `7d` (windowMs 7d, resetAt weekly_end_time, percent = 100
  - remaining), level `null`. The region-probe failure path
  is tested with a fake fetch that returns `status_code: 2049`
  on the first endpoint.
- [ ] 3.2 In the MiniMax `parse`, document the pseudo-usage
  inversion (`usage = 100 - remaining`, `limit = 100`) in the
  JSDoc so the runway math reuse is explicit. Verify by reading
  the file: the JSDoc names the inversion and the source it comes
  from.

## 4. Wiring

- [ ] 4.1 In `src/tui.tsx` introduce
  `activeProvider: QuotaProvider | null` as a signal, seeded
  from `api.state.session.get(currentSessionID)?.model?.providerID`
  and updated on `api.event.on("session.next.model.switched")` and
  `api.event.on("tui.session.select")`. Verify by reading the
  file: the signal is read inside the render effect.
- [ ] 4.2 In `src/tui.tsx` key the history maps and the
  prevResetAt map by `${activeProviderId}:${row.label}`. The
  runways record (in `modelInput`) uses the same composite key.
  Verify by reading the file: the map keys are computed once
  and reused. Then add a test in `src/tui.test.tsx` that
  switches the active provider mid-flight and asserts the new
  provider's first sample does not aggregate with the old
  provider's samples.
- [ ] 4.3 In `src/tui.tsx` gate the sidebar slot and the chip
  slot registration on `activeProvider != null`. When `null`,
  the slots are not registered. The command
  `zai-quota.refresh` (renamed in a later change) toasts
  `no quota provider for <providerID>`. Verify by adding a
  test in `src/tui.test.tsx`: when the active provider id is
  unknown, the panel slot is not registered and the command
  toast contains `no quota provider for`.

## 5. Model and render hooks

- [ ] 5.1 In `src/model.ts` make `PanelModel.header.title` come
  from `ModelInput.title: string` (the active provider's label,
  supplied by the wiring layer), and `ChipModel.prefix: string`
  come from `ModelInput.chipPrefix: string`. Remove the literal
  `"Z.ai Runway"`, the literal `["5h","7d"]` ordering when the
  provider's labels are not "5h"/"7d", and the hard-coded
  `pct("5h")` / `pct("7d")` chip values. Verify by reading the
  file: the literals are gone, the model takes them as input.
- [ ] 5.2 In `src/render.ts` change the `renderChipSegments` chip
  prefix to come from `ChipModel.prefix` and the `renderHeader`
  level cluster to use the active provider's label as
  already-dynamic input. Move the `zai:?` and ` zai ` literals
  to a per-provider `errorText` and `chipPrefix`. Verify by
  reading the file: the literals are gone.

## 6. Dispatch and parser removal

- [ ] 6.1 In `src/api.ts` reduce `parseQuota` to a thin
  dispatcher: `export function parseQuota(payload, provider):
  ParsedQuota` calls the active provider's parser. The
  SCAN_FIELDS deep scanner is removed; each provider's parser
  is responsible for its own payload shape. The
  `MAX_SCAN_DEPTH`, `MAX_ROWS`, and the heuristic check are
  deleted. Verify by running `bun test src/api.test.ts` and
  seeing the existing fixtures pass through the Zhipu parser
  with no behaviour change.
- [ ] 6.2 In `src/api.ts` keep `fetchQuota` and the
  `{ status, text }` contract, but its timeout/headers logic
  is shared by the provider-specific fetch wrapper. Verify by
  reading the file: the function signature is unchanged.

## 7. Suite

- [ ] 7.1 Run `bun run check` and `bun test` from the repo root
  and verify the whole suite is green. New tests:
  `src/providers/types.test.ts`, `src/providers/zhipu.test.ts`,
  `src/providers/minimax.test.ts`, and the additions to
  `src/tui.test.tsx` for the unknown-provider case and the
  provider-switch case.
