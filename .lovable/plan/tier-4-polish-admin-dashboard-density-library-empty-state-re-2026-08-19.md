# Tier-4 polish: admin dashboard density, Library empty state, ref warnings

The three backlog items from the audit. All frontend/presentation — no schema, no auth, no payment logic touched.

## 1. Admin/teacher dashboard is mostly empty space
`src/pages/Dashboard.tsx:303-318` — when the signed-in user is admin/teacher the page renders only a heading plus a 4-tile "Quick Actions" grid, then a large dead scroll region above the tab bar.

Changes:
- Add a compact KPI row above Quick Actions using the existing `get_platform_stats()` RPC (total students, total courses, total teachers) — no new backend work, it already exists and is safe to call. Three small stat cards, `tabular-nums`, skeletons while loading, and a graceful hide if the call fails.
- Add a short "Manage" list under Quick Actions linking to `/admin`, `/my-courses` and the doubts queue so the fold is filled with real navigation instead of whitespace.
- Replace the hardcoded tile colors in `teacherFeatures` (`text-blue-600 bg-blue-100`, etc., `Dashboard.tsx:46-51`) with semantic tokens (`bg-primary/10 text-primary`, `bg-accent/10 text-accent`, `bg-muted text-muted-foreground`) so the grid works in dark mode.
- Keep the section wrapped in the existing page container; no layout-shift-inducing fixed heights.

## 2. Library empty state is a bare sentence
`src/pages/Library.tsx:203-208` — a plain card with "No beginner PDFs yet."

Change it to the project's empty-state pattern: a gradient rounded tile with an icon, a one-line title, a supporting line, and a next-step CTA that points at the existing add/upload affordance (admin) or "Browse courses" (student). The offline variant keeps its current wording but gets the same shell so both states look intentional.

## 3. `Function components cannot be given refs` console warnings
Dev-only noise that buries real errors during triage. The wrappers named in the warnings (`PublicRoute`, `ProtectedRoute`, `AdminRoute`, `PageLoader`, `ForceUpdateGate`) are plain function components that something forwards a ref into.

Approach: reproduce in the browser with the console open, read the component stack in each warning to find the actual ref source, then fix at that source — either wrap the receiving component in `React.forwardRef` or stop passing the ref. No blanket refactor: only the components the warning actually names get changed.

## Verification
- Load `/dashboard` as the admin account and `/library` in a 390x844 mobile viewport; confirm no dead fold, KPI numbers render, and the console warning count drops to zero.
- `tsgo --noEmit` clean and the existing vitest suite green.

## Not in scope
No database migration, no RLS/grant change, no payment or PDF-reader logic. Leaked-password protection still needs your toggle in the Supabase Auth dashboard.