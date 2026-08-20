# PDF reader: autoscroll smoothness at low speeds + loading background split

## What is wrong today

**1. Low-speed autoscroll (0.1x / 0.2x / 0.5x) is jerky**
`useAutoScroll` keeps an exact float position and writes it to `scrollTop` every frame. That part is correct — but a scroll container can only land on whole device pixels. At 0.2x the engine advances ~0.2px per frame, so the page sits still for 4–5 frames and then jumps 1px. Movement is real (~12px/sec) but reads as stutter, not glide. At 1x and above the per-frame delta is ≥1px, which is why only the low presets feel broken.

**2. Half white / half grey while a PDF loads**
The reader's scroll surface is `bg-neutral-100` (grey), but the loading placeholder wrapper is only `min-h-[60vh]` and the overlay inside it paints `bg-background` (white). Result: the top ~60% of the screen is white, the rest stays grey — exactly what the screenshot shows. The earlier "resolving" state also paints full white, so there is a second flash when it hands over to the grey reader.

## Fix

### Autoscroll — sub-pixel smoothing
- Keep the existing float accumulator and all persistence / preset / long-press behaviour unchanged.
- Write the integer part to `scrollTop` and hand the leftover fraction (0–1px) to the scrolled content as a `translate3d(0, -frac, 0)` on a dedicated smoothing wrapper. Net effect: continuous motion at 0.1x–0.5x instead of 1px staircase.
- Guards: only applied while autoscroll is active, only on the canvas PDF reader and native scrollers that expose the wrapper, cleared on stop/unmount, skipped when `prefers-reduced-motion` is set, and never applied to a wrapper that already carries a zoom transform (pinch-zoom keeps priority).
- Iframe (pdf.js viewer) path already receives fractional `dy` and accumulates float inside `nb-bridge.js` — same integer/fraction split added there so both paths behave identically.
- Also drop the residual `scroll-behavior: smooth` fight by keeping the existing forced `auto` (already present) and verifying it is applied to the actual PDF scroller, not the wrapper.

### Loading background
- Make the `<Document loading=...>` wrapper fill the reader (`absolute inset-0` / full height) instead of `min-h-[60vh]`, so no grey strip remains below it.
- Give the loading surfaces the same neutral tone as the reader (`bg-neutral-100 dark:bg-neutral-900`) so the resolve → load → rendered handoff has no colour flash.
- The progress bar, the percent/status copy, the spinner, the "Stabilizing PDF stream…" pill and all timing curves stay exactly as they are — only the background box changes.

## Verification
- Extend `src/test/autoScrollSpeed.test.ts`: at 0.2x over a simulated 1s, total displacement is ~12px **and** the frame-to-frame deltas are monotonic (no 5-frame stalls).
- Run the existing 44 PDF regression tests + `reader-progress.test.tsx` to confirm loading UI contract is untouched.
- Playwright screenshot of the reader mid-load to confirm a single uniform background.

## Audit notes (senior-architect-audit / perf-exam-ready lenses)
- [MEDIUM][VIS] Reader used three different background tokens across resolve / load / rendered states — unified by this change.
- [MEDIUM][MOT] Low-speed motion violated the "continuous or don't offer it" rule; 0.1x/0.2x presets were shipped but not usable.
- [LOW][PERF] Smoothing uses a compositor-only transform, so no extra layout/paint per frame; virtualization guard and page-release logic are untouched.
- No Supabase/backend change is needed for this issue — PDF delivery path stays as-is.

## Files touched
- `src/hooks/useAutoScroll.ts`
- `public/pdfjs/web/nb-bridge.js`
- `src/components/video/FastPdfReader.tsx`
- `src/test/autoScrollSpeed.test.ts`
