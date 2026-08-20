# Page chip: true drag up/down (scrollbar-thumb behaviour)

Reference video: the chip is grabbed and the whole indicator travels vertically with the finger while the document scrolls under it. Today the chip is pinned at `top-1/2` and drag only nudges scroll by a made-up travel constant, so the touch point drifts away from the chip and long-press-drag feels broken.

## What changes

Only `src/components/viewer/PageIndicatorPill.tsx`.

1. **Thumb follows scroll position.** The indicator is positioned along a vertical track (top safe-area + 12px to bottom - 12px) at `fraction * trackLength` instead of `top-1/2`, so at rest it sits where the document is — like the Files-by-Google / Drive thumb.
2. **Absolute drag mapping.** On `pointerdown` record the offset between the finger and the thumb centre; on `pointermove` set `fraction = (clientY - grabOffset - trackTop) / trackLength`, clamped 0..1. The chip stays exactly under the touch point for the whole gesture (canvas path sets `scrollTop`, pdf.js path posts the existing `nb-scroll-to-fraction`).
3. **Drag affordance.** While dragging: chip stays pinned visible (idle fade cancelled), grows slightly (`scale-105`), and the page label switches to the single current page for readability. Release restores the 1.2s fade.
4. **Tap vs drag.** A movement threshold of 6px distinguishes a tap (no scroll change) from a scrub, so the chevron stepper taps keep working unchanged.
5. **Soft touch (soft-touch skill).** `selectionHaptic()` on drag start and on each page-boundary crossing during the drag; `tapHaptic("light")` on chevron step. Press state `active:scale-[0.97] transition-transform duration-150 ease-out` on chip and chevrons. No arbitrary `duration-[Nms]`, haptics only on direct gestures via `@/lib/native/haptics`.

## Safety and untouched surfaces

- Existing scrub start/end events keep pausing/resuming autoscroll, so no fight with the autoscroll loop.
- Pointer capture released on `pointerup`/`pointercancel`; rAF cancelled on unmount (crash-shield rules).
- Message-origin hardening on `nb-page-state` stays exactly as-is (red-team rule: only the reader iframe on our own origin).
- Untouched: autoscroll engine and route/custom dwell, `nb-bridge.js`, FAB, fullscreen/rotate buttons, PDF streaming, backend, payments.

## Verification

- `tsgo --noEmit` + full vitest run, plus a new unit test that a drag from track-top to track-bottom lands the scroller at the end and a <6px press does not move it.
- Production build + bundle-size check.
