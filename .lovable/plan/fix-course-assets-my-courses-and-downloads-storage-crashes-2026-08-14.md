# Fix course assets, My Courses, and Downloads storage crashes

## What's broken (verified)

1. **Course images 404/400 everywhere.** Both rows in `courses` store thumbnails as
   `.../storage/v1/object/public/content/thumbnails/...`, but the `content` bucket is **private**.
   A live request to that exact URL returns **HTTP 400**. `src/lib/resolveContentUrl.ts` treats
   `thumbnails/`, `courses/`, `hero-banners/`, `chapter-icons/`, `banners/` as "public folders" and
   returns `getPublicUrl()` for them — which can never work on a private bucket. So every course
   card, batch card and hero banner falls back to the broken/placeholder image.
2. **Downloads fetch without credentials.** `saveAndIndexDownload` in `src/services/savedDownloads.ts`
   calls `fetch(url, { credentials: "omit" })` for any URL it does not recognise as a storage URL,
   so gated files fail with 401 and the download dies with a raw "HTTP 401" toast.
3. **Orphan rows on a failed local write.** The IndexedDB fallback inserts the index row first and
   only then writes the blob. If the write throws (QuotaExceeded / OOM on low-RAM Android) the
   record stays in the list pointing at `web-indexeddb:pending`, and opening it later crashes the
   viewer. The quota pre-check also silently skips when `storage.estimate()` is unavailable.

Row-level security and table grants for `courses`, `lessons`, `chapters`, `enrollments` were checked
and are correct — this is not an RLS problem. Whether "My Courses shows nothing" is purely the broken
imagery or also a data/render issue is **not yet confirmed** (the dev server was down during the
check), so step 1 below is to reproduce it in a real browser session before changing render code.

## Plan

### 1. Reproduce and pin the My Courses gap
Run the app with an authenticated session, open `/my-courses`, `/courses`, `/downloads`, and capture
console + failing requests. Fix whatever the trace names; if the only failures are the image 400s,
the asset fix below is the whole fix.

### 2. Make course artwork actually load
- Create a dedicated **public** storage bucket for presentation-only art (course cards, thumbnails,
  hero banners, chapter icons). Gated folders (`lessons/`, `materials/`, `notes/`, quiz images) stay
  in the private `content` bucket and keep signed URLs.
- Copy existing presentation objects across and rewrite `courses.image_url` / `courses.thumbnail_url`
  (plus `chapters.thumbnail_url`, `lessons.thumbnail_url`, `hero_banners`) to `storage://` URIs so
  they are bucket-agnostic going forward.
- Update `resolveContentUrl` so public folders resolve against the new public bucket, and any object
  that still lives in the private bucket is **signed** instead of silently returning a dead public URL.
- Regenerate any missing artwork: courses with no usable image get a generated NEET-branded cover so
  cards never render an empty tile.
- Add a real skeleton → image → branded fallback chain on course/batch cards (no red PDF placeholder).

### 3. Harden Downloads / local storage (crash-shield)
- Send the Supabase session on downloads: use the authenticated fetch path for same-project URLs and
  keep `credentials: "omit"` only for genuinely external hosts. Map 401/403 to a "session expired,
  sign in again" toast with a retry, not a raw HTTP code.
- Write the blob **first**, insert the index row only after the write succeeds; on failure delete the
  half-written record so no `pending` ghost entries survive.
- Treat a missing `storage.estimate()` as "unknown" and cap a single web-fallback save at a safe size
  instead of skipping the guard entirely.
- Wrap every IndexedDB write in an error path that surfaces a toast; guard the Downloads list against
  records whose blob is gone (offer re-download instead of opening a dead blob URL).
- Add a self-heal pass on the Downloads page: prune ghost/blobless records on load.

### 4. Full audit pass
Run the architecture + backend + crash-shield lenses over the course/asset/download path and write the
report to `docs/audit/` — covering storage-policy correctness, remaining URL split-brain, N+1 queries
on the course pages, and any remaining listener/interval leak on the Downloads surface.

## Technical notes
- Storage change is a migration (new bucket + policies) plus a data-rewrite UPDATE on the URL columns;
  gated buckets and their policies are untouched.
- No change to the enrollment / payment logic.
- Verification: live REST + storage HTTP checks for the rewritten URLs, typecheck, and a browser pass
  over `/courses`, `/my-courses`, `/downloads`.
