# Tasks

## 1. Row contract

- [ ] 1.1 In `src/api.ts` change `QuotaRow` to carry `windowMs?: number` and
  remove the `unit?: number` field. Update the JSDoc accordingly. Verify by
  reading the file: `windowMs` is on the row, `unit` is gone.
- [ ] 1.2 In `src/api.ts` `mapEntry` and `scanForRows`, translate `unit: 3`
  to `windowMs: 5 * 60 * 60 * 1000` and `unit: 6` to
  `windowMs: 7 * 24 * 60 * 60 * 1000` at the boundary, and drop the
  `unit` field from the produced row. Verify by reading the file.

## 2. Marker

- [ ] 2.1 In `src/marker.ts` drop the `WINDOW_MS` table and change
  `markerIndex` to take `windowMs: number | null | undefined` directly as
  a parameter (no lookup). Verify by running `bun test src/marker.test.ts`
  and seeing the existing tests still pass with their fixtures updated to
  pass `windowMs` explicitly.

## 3. Model and rolling state

- [ ] 3.1 In `src/model.ts` `buildWindow`, replace the `WINDOW_MS[row.unit]`
  lookup with `row.windowMs` and pass it to `markerIndex`. When
  `row.resetAt == null && row.windowMs != null`, set
  `resetText: "rolling" + (row.label ? " " + row.label : "")` and
  `markerIndex: null`. Verify by reading the file: the rolling branch
  produces the named state and the marker is absent.
- [ ] 3.2 In `src/model.test.ts` add a fixture and a test case for the
  rolling 5h row: `windowMs: 5h`, `resetAt: null`, expect
  `resetText: "rolling 5h"`, `markerIndex: null`, `verdict: "unknown"`.
  Verify by running `bun test src/model.test.ts` and seeing the new case
  pass.

## 4. Render contract

- [ ] 4.1 In `src/render.test.ts` add a render-golden case for the rolling
  row: `renderWindowLine` produces a label + 16-cell bar (no `│` marker)
  + percent + usage + verdict glyph, and `renderDetailLine` produces
  `rolling 5h        runway ...` (25 columns of 38). Verify by running
  `bun test src/render.test.ts` and seeing the new case pass.

## 5. Suite

- [ ] 5.1 Run `bun run check` and `bun test` from the repo root and verify
  the whole suite is green.
