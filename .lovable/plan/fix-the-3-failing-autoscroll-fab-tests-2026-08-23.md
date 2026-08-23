# Fix the 3 failing AutoScroll FAB tests

## What's actually broken (verified)

The tests are not catching a product bug — they are out of date with a refactor.

`AutoScrollFab.tsx` now loads the settings sheet lazily:

```text
const AutoScrollSheet = lazyWithRetry(() => import("./AutoScrollSheet"))
...
{open && <Suspense fallback={null}><AutoScrollSheet ... /></Suspense>}
```

The three failing tests long-press the FAB with `vi.useFakeTimers()` and then
synchronously query for chips ("Every page", "20x", "A4 Sheet"). With fake timers
the dynamic `import()` promise never flushes, so `Suspense` is still showing
`null` and only the FAB button exists in the DOM — exactly what the failure dump
shows. The other 2 tests in the file, which don't open the sheet, pass.

## The fix

Update `src/test/autoScrollFab.test.tsx` only (no product code changes):

1. Keep fake timers just for the 280ms long-press, then restore real timers
   right after the press so the lazy chunk can resolve.
2. Replace the synchronous `getByRole` chip lookups with `await screen.findByRole(...)`
   (or an `await screen.findByRole("dialog", { name: /autoscroll speed/i })` gate
   before the existing assertions) so each test waits for the sheet to mount.
3. Apply the same pattern to all three tests: the Pause-at grid test, the
   "renders every chip group" test, and the A4 Sheet toggle test. Assertions
   themselves stay unchanged — they still verify `grid-cols-3`, `min-w-0`,
   the speed/duration chips, and that tapping A4 Sheet calls
   `setDwell({ a4: true })`.

## Verification

Run `bunx vitest run src/test/autoScrollFab.test.tsx` and confirm 5/5 pass, then
run the full unit suite once to make sure nothing else regressed.

## Not in scope

- No change to `AutoScrollFab.tsx` / `AutoScrollSheet.tsx` behaviour.
- Live browser login verification stays blocked (test credentials return 400);
  I can retry it if you send working credentials.
