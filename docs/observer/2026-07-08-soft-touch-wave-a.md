# Observer Report — 2026-07-08 — Soft-Touch Wave A

**Scope:** Wave A of the soft-touch rollout — Header, Sidebar, Login, Index CTAs.
**Mode:** Frog-eye, read-only over prior chat + repo state. This report does not gate the fix.

## Incomplete (carry to next turn)
- **Soft-touch Wave B — Downloads, LessonView, Books.** User explicitly deferred: "Baaki waves ko usage-driven karo: jo pages sabse zyada use hote hain (Downloads, LessonView, Books) pehle." Not started.
- **Soft-touch Wave C — Community, Quiz, PaymentCallback, Admin CTAs.** Not started.
- **BottomNav soft-touch.** Not in Wave A scope; still uses plain `NavLink` with no haptic/press state. Recommend folding into Wave B (high-traffic).

## Follow-ups deferred
- **HIBP leaked-password protection** — manual dashboard toggle in Supabase Auth settings. Cannot be done from code. Still pending per prior turn.
- **REVOKE-EXECUTE migration approval** — user was told to approve the pending migration for SECURITY DEFINER hardening. Verify in Supabase dashboard.
- **Documented linter WARNs** — client-callable SECURITY DEFINER helpers (`has_role`, `get_dashboard_snapshot`, `get_course_bundle`, etc.) are intentionally kept; no action, only awareness.

## Linked to current work
- **`src/lib/native/haptics.ts`** — already provides `tapHaptic` + `selectionHaptic` with web no-op. Wave A reuses it; Waves B/C should too. Do NOT import `@capacitor/haptics` directly.
- **`tailwind.config.ts`** — `duration-150` / `active:scale-*` tokens already available; no new arbitrary `duration-[Nms]` introduced.
- **`src/components/Layout/BottomNav.tsx`** — sibling to Header/Sidebar; will be the natural next target when Downloads/LessonView are polished.

## Dropped / rejected (do NOT re-propose)
- **Global 40+ file soft-touch pass.** User rejected: massive diff, review impossible, Tailwind purge + haptic double-fire risk. Never bundle back into one wave.
- **Service worker / PWA offline** — previously rejected (reload loops). Untouched.
- **Capgo / CapacitorUpdater** — removed intentionally; do not reintroduce.

## Risks / ignored findings
- **Haptic double-fire** — mitigated by attaching haptic on the wrapper `<Link onClick>` only, not also on the child `<Button>`. Wave B must keep this discipline.
- **`active:scale-*` on fixed containers** — sticky mobile CTA in `Index.tsx` scales its children (the Buttons), not the fixed parent bar. Safe.

## Signal-only
- Wave A touches 4 files (Header, Sidebar, Login, Index). Well under the ~6-file budget the user stated.
- No `duration-[Nms]` values introduced. All transitions use `duration-150`.
- No new Supabase / RLS surface changed. Presentation-only.

## Next-turn suggestion
Wave B, ordered by usage:
1. `src/pages/Downloads.tsx` + download row action buttons
2. `src/pages/LessonView.tsx` + player-adjacent nav (NOT player chrome — owned by `useAutoHideControls`)
3. `src/pages/Books.tsx` book cards
4. `src/components/Layout/BottomNav.tsx` tab items (selection haptic)

Used the history-observer skill.
