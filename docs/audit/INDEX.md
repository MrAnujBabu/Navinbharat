# Audit Index

## 2026-07-19 Session — Ratings

| Area | File | Rating |
| --- | --- | --- |
| Razorpay | 2026-07-19-razorpay.md | 5/5 |
| Quiz Manager | 2026-07-19-quiz-manager.md | 5/5 |
| Codebase | 2026-07-19-codebase.md | 4/5 |
| Phase 3 (Authz sweep) | 2026-07-19-phase3-report.md | 4.5/5 |
| Phase 4 (Hardening) | 2026-07-19-phase4-report.md | 4.85/5 |
| Chat Widget | (inline in chat) | 3/5 → ~4/5 post-fix |
| Reader chip + Autoscroll sheet | 2026-08-20-reader-chip-autoscroll.md | 4/5 → 5/5 post-split |
| Reader fullscreen / HD PDF / resume | 2026-08-20-reader-fullscreen-resume.md | 5/5 |

## Session Report + Upgrade Plan
See `.lovable/plan.md` (approved 2026-07-19) for the low-edit upgrade roadmap covering:
1. Security dashboard toggles (leaked-password protection)
2. Chat markdown + auto-scroll
3. Notion PDF/DPP link surfacing
4. Admin Ops grid
5. Structured edge-function logs
6. Doc consolidation (this file)

## Known loose ends
- `MyCourseDetail.tsx` (1274 LOC) split — pending
- `AdminCMS.tsx` (793 LOC) split — pending
- Leaked-password protection — manual Supabase dashboard toggle required
- Notion link blocks (bookmark/embed/link_preview) — surfacing fix pending
- Reader page-bridge failure counter — surfacing in `/debug/diagnostics` pending
- Resume/fullscreen fixes verified in browser only — need a fresh APK device run
- [2026-08-21 reader rotation session](./2026-08-21-reader-rotation-session.md) — 4/5; HIGH: Notes sheet/toasts unrotated in pseudo-landscape; safe-area axes wrong in frame; pdf-cache signed URL TTL 6h -> 30min (fixed).
- [2026-08-21 full-stack audit](./2026-08-21-full-stack-audit.md) — 4.5/5 across 12 lanes; HIGH: admin-register admin-code brute force (fixed, per-IP 5/hr); MEDIUM: leaked-password toggle, archive.org metadata resolve needs 8s cap.
