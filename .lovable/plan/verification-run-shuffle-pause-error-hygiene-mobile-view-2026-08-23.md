# Verification run: Shuffle pause, error hygiene, mobile view

A test-only pass — no feature changes unless a defect turns up. Anything broken gets fixed and re-verified in the same run.

## What gets tested

### 1. Sign in and open the app in a real browser
Drive a headless Chromium at mobile size (411 x 745, the viewport you are previewing at), sign in with the test account you shared, and land on the reader.

### 2. Shuffle pause — the real behaviour check
- Open a PDF, open the autoscroll settings sheet, switch "Pause at" to **Shuffle**.
- Confirm the revision panel appears: page-range inputs, deck stats line, Reshuffle and Reset.
- Confirm a page order is actually produced and autoscroll follows it (not plain top-to-bottom).
- Set a page range (e.g. 5-12) and confirm the order stays inside it.
- Leave and reopen the same PDF: progress must persist; Reset must clear it.
- Repeat with a second document to confirm decks stay separate per PDF.

### 3. Error hygiene during the run
Capture every console error, page error and failed network request across the whole session, then classify each one: real bug, expected boundary case, or known noise. Real bugs get fixed at the source; expected boundary cases get reported with proper context instead of a raw console error; nothing gets silently swallowed.

### 4. Crash-safety pass
Navigate reader to library to reader repeatedly, background/foreground the tab, and toggle Shuffle on and off several times — watching for leaked listeners, timers that never clear, and growing memory. The shuffle deck writes to device storage, so its size cap is checked too.

### 5. Mobile-view review
Screenshot the shuffle panel and the settings sheet at phone width and review: tap-target sizes, whether inputs are large enough that iOS does not zoom on focus, spacing rhythm, chip row behaviour, and that the panel does not push the sheet into an awkward scroll.

### 6. Logic correctness review
Re-read the scheduler, the storage layer, and the autoscroll wiring against the intended behaviour: forgotten pages first, unseen pages next, no clustered neighbours, grading inferred from real dwell time, range respected, deck bounded, and the same order in both reader modes (in-app canvas and the embedded PDF viewer).

## Output

A short report listing: what passed, every error found with its cause and severity, fixes applied, and anything left open for you to decide.

## Notes

- The test account is used only to sign in during this run; it is never written into the codebase.
- If sign-in fails or the account cannot reach a PDF, that gets reported rather than worked around.
