# Asset Audit & Fix — Naveen Bharat

**Verdict: 3/5** — the image system is well-built (SmartImage, signed-URL resolver), but two paths bypass it and three CDN pointers belong to *other* Lovable projects, so real users see grey/blank tiles.

## What is actually broken (verified)

### 1. Dashboard course image + batch thumbnail are dead (this is the grey block in your screenshot)
The `content` storage bucket is **private**. Course rows store legacy public URLs:
`.../storage/v1/object/public/content/thumbnails/course_34_...png` → returns **404 "Bucket not found"** (verified with a live request).

The project already has `resolveContentUrl()` which signs these, and `useEnrollments` uses it correctly. But two places pass the raw URL straight to an `<img>`:
- `src/pages/Dashboard.tsx` — builds `myCourses` from the `get_dashboard_snapshot` RPC and feeds raw `image_url` / `thumbnail_url` into `SmartImage` (the grey "Amar Batch" card).
- `src/components/dashboard/BatchSelector.tsx` — plain `<img src={batch.image_url}>`, no resolver, no fallback (the blank square next to "Amar Batch (All)").

**Fix:** run both through the existing `resolveContentUrl` / `useResolvedContentUrl` hook, and give BatchSelector the same `course-default` fallback the rest of the app uses. No new helper, no schema change.

### 2. Three CDN asset pointers point at other projects (2 of them 404)
| Pointer | Owning project | Live status |
| --- | --- | --- |
| `src/assets/logo.webp.asset.json` | 932ce678… | **404** |
| `src/assets/success.mp3.asset.json` | 874d7590… | **404** |
| `public/branding/logo_og_image.png.asset.json` | 932ce678… | 200, but foreign |

Effects: broken logo on **Admin Upload** and **Admin Register**, silent failure of the payment success sound on **BuyCourse**, and `index.html` hard-codes `og:image` / `twitter:image` to another project's preview domain.

**Fix:** re-point the logo imports at the local `src/assets/branding/nb-mark.webp` (already the app-wide logo), re-upload `success.mp3` under this project, and drop the hard-coded `og:image` / `twitter:image` tags so Lovable hosting supplies the correct social preview. Delete the three stale pointer files.

### 3. Dead weight and duplicates
- `src/assets/icons/home-3d.webp` and `student-3d.webp` — zero references anywhere. Delete.
- `nb-mark.webp` exists twice, byte-identical (`public/brand/` + `src/assets/branding/`). Both are genuinely used (public copy by `index.html` + service worker, bundled copy by 18 components), so **keep both** — a bundled import can't be preloaded from `index.html`.

### 4. Visual nit (from the screenshot)
The floating chat button sits directly on top of the "My Doubts" tile. Add bottom padding to the dashboard feature grid so the FAB never covers a tap target.

## Not changing (deliberate)
- PWA icons and `logo_og_image.png` stay PNG — per the asset rules.
- `content` bucket stays private; signing is the correct answer, not making paid content public.
- Landing portraits (34 KB / 43 KB JPG) and all `pdfjs` vendor SVGs are already fine.

## Technical notes
- Files touched: `src/pages/Dashboard.tsx`, `src/components/dashboard/BatchSelector.tsx`, `src/pages/AdminUpload.tsx`, `src/pages/AdminRegister.tsx`, `src/pages/BuyCourse.tsx`, `index.html`.
- Deleted: `src/assets/logo.webp.asset.json`, `public/branding/logo_og_image.png.asset.json`, `src/assets/icons/home-3d.webp`, `src/assets/icons/student-3d.webp`.
- `success.mp3` is re-uploaded via the asset CLI under this project, keeping the same import shape in `BuyCourse.tsx`.
- Verification: re-request the signed thumbnail URL, confirm zero remaining references to deleted files, and typecheck.
