# Finish the Naveen Bharat rebrand + apply the missing backend

The rebrand and NEET pivot are largely in place. Two things are still blocking: the database migration that the new admin screens depend on was never actually applied, and a few stray old-brand strings remain.

## 1. Apply the missing backend (this is what's breaking the build)

The app already has screens and hooks calling tables and functions that do not exist in the connected Supabase project. Verified: `landing_courses`, `landing_testimonials`, `live_reminders`, `content_reports` are all absent. That is the cause of every build error currently shown.

Create in one migration:

- **landing_courses** — editable course cards for the landing page (slug, badge, title, faculty, language, duration, start date, seats, MRP/effective price, short blurb, image, route, linked course, position, active flag). Public can read active rows; only admins can edit.
- **landing_testimonials** — student name, exam track, quote, avatar, rating, position, active flag. Same access rules.
- **live_reminders** — one row per student per live class; each student sees and manages only their own.
- **content_reports** — reporter, content type, content id, reason, status. Reporter sees their own, admins see all and can resolve.
- **Hidden flags** on lesson comments, community posts, community comments and doubt replies, plus a blocked flag on profiles and fraud-review fields on enrollments.
- **Admin-only actions**: hide/restore content, resolve report, block/unblock user, remove student from a batch, mark enrollment legit, batch roster, suspicious-enrollment watchlist, student snapshot.
- **Quiz review lookup** so a student sees correct answers only after submitting their own attempt.

Every table gets explicit grants, row-level security, and policies in the same migration; every admin function is admin-gated and pinned to the public schema.

## 2. Clean up the last old-brand strings

Remaining references live in `android/app/src/main/AndroidManifest.xml`, `MainActivity.java`, and the shared edge-function CORS allowlist. Historical migration files and dated audit docs keep their original text — rewriting history there is misleading and risks breaking replay.

## 3. AI agent key

Rotate `LOVABLE_API_KEY`, then smoke-test the chatbot and Ask-Doubt edge functions so the AI features are confirmed working after rotation.

## 4. Verify

Typecheck must come back clean, then a quick pass over the admin moderation, batch monitor and fraud-watch screens to confirm they load real data.

## Technical notes

- Migration is a single SQL block following create → grant → enable RLS → policy ordering; all admin RPCs are `SECURITY DEFINER` with `SET search_path = public` and a `has_role(auth.uid(), 'admin')` guard.
- `src/integrations/supabase/types.ts` regenerates automatically after the migration runs — that is what clears the TypeScript errors; no manual type edits.
- Supabase project ref stays `cmbattmjwriiesibayfk`; `supabase/config.toml` will be pointed at it.
