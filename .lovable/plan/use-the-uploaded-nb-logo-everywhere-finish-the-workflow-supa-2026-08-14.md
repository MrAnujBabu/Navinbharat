# Use the uploaded NB logo everywhere + finish the workflow/Supabase cleanup

## 1. Header and favicon from the uploaded image

Regenerate every brand image directly from the uploaded `1000091198-removebg-preview.png` so the header mark, browser tab icon and app icons are all the exact same artwork:

- `public/favicon.png` and `public/apple-touch-icon.png`
- `public/brand/nb-mark.webp` (preloaded in `index.html`, used by `BrandMark`)
- `src/assets/branding/nb-mark.webp` (used by the app header)
- PWA icons `public/icons/icon-192x192.png` and `icon-512x512.png`
- Android launcher icons (`mipmap-*`) and the adaptive-icon foreground

The header keeps its current layout — only the image file changes. Transparent background is preserved for the app icons; Android launcher keeps the light background colour behind the mark.

Delete the leftover `src/assets/branding/sadguru-mascot.webp`, which is no longer referenced by the rebranded UI.

## 2. Supabase — Naveen Bharat

The app is already pointed at the Naveen Bharat project (ref `cmbattmjwriiesibayfk`) in `.env`, `supabase/config.toml` and the generated client, and the backend migration is live there. No reconnection is needed; this step is a verification pass only — confirm the client boots, the landing tables answer, and report if anything still points elsewhere.

## 3. build-apk.yml

The workflow is already renamed to Naveen Bharat (artifacts `NaveenBharat.apk`, package `com.naveenbharat.app`). One stale line remains — a `git rm --cached sadguruclasses` cleanup step — which will be updated so it no longer references the old name.

## Technical notes

- Icons are produced with ImageMagick/cwebp from the upload; PNG sizes are kept under the repo's asset budget check.
- The favicon must stay a real file in `public/`, not a CDN pointer.
- No database migration is part of this change.
