# Batch 1 Now (scoped patch) + Batch 3 Root backlog

## Batch 1 — Now (single commit, 3 files)

Correction from audit: the audit named 4 files. On re-reading the code, **item #4 (statusbar cleanup) is already implemented** at `src/hooks/useVideoStatusBarHide.ts:94` (both `timerRef` and `restoreTimerRef` cleared on unmount). Dropping from patch. Item #2 originally targeted Bunny, but the `playerFullscreen` sentinel is owned by `useFakeFullscreen` / `MahimaGhostPlayer`, not Bunny — retargeting to the actual owner.

### 1. Landscape back double-press bug (HIGH)

**File:** `src/hooks/useAndroidBackButton.ts`

Root cause: first back pops `playerFullscreen` (step 1). `useFakeFullscreen.release()` fires `onExit`, which in `MahimaGhostPlayer.tsx:568` pushes a **new** `rotationGuard` sentinel to reset rotation. Second back consumes `rotationGuard` (invisible to user). Third back finally navigates — user reports as "back once resets landscape, back again exits screen unexpectedly".

Two guards, both minimal:

- Add module-level `lastOverlayPopAt` timestamp. Set it inside step 1 (any sentinel pop). At the top of the handler, drop any press within 350 ms — swallows the synthetic double-fire that Android WebView emits during config-change (rotation).
- No change to Mahima needed; the `rotationGuard` push is legitimate for the pseudo-fullscreen rotation flow. The debounce alone breaks the visible race.

### 2. Bunny unmount defensive sentinel clear (MED, moved from HIGH)

**File:** `src/components/video/BunnyStreamPlayer.tsx`

Bunny does not push `playerFullscreen` itself, but a rotation-triggered unmount while the parent lesson page has one queued can leave a stale sentinel. Add to the existing unmount effect (line 136-141): if `window.history.state?.playerFullscreen` at unmount, replace it via `history.replaceState(null, "")`. Safer than `history.back()` (no navigation side effect).

### 3. Eruda `[window.error] undefined undefined undefined` noise (MED)

**File:** `src/lib/nativeDebug.ts`

Extend `isExpectedCapacitorNoise` (line 83) with a regex matching `\[window\.error\] undefined undefined undefined`. This is Eruda's own error-panel receiving cross-origin `ErrorEvent`s with stripped fields — always noise, never our code. Suppression is narrow (exact string), safe.

### Verification (self-check before shipping)

- `tsgo` clean.
- Grep `lastOverlayPopAt` — one write in step 1, one read at top of handler.
- Manual repro path documented in commit body: play Mahima → rotate to landscape → back → back → confirm user stays on lesson page (not two levels up).

## Skill impact

- `capacitor-back-button` ⚠ → ✅ (HIGH closed)
- `capacitor-video-player-master` ⚠ → ⚠ (landscape race closed; native `nb-video` still Batch 3)
- `console-error-triage` ✅ (Eruda line classified + suppressed at narrowest point)

## Files changed

```
src/hooks/useAndroidBackButton.ts     +6 lines  (debounce + record)
src/components/video/BunnyStreamPlayer.tsx  +2 lines (replaceState in unmount)
src/lib/nativeDebug.ts                +1 line   (regex entry)
```

## Batch 3 — Root backlog (SEPARATE, not in this patch)

Reference only; do not implement here.

### #11 Replace Bunny iframe with native `nb-video` plugin (2–3 days)

Kills the iframe lifecycle bug class entirely:

- Memory leak from decoded buffers (currently mitigated by `about:blank` on unmount).
- postMessage flakiness on rotation.
- Statusbar race requiring `useVideoStatusBarHide` scaffolding.
- No control over HLS variant selection / ABR.

**Design surface needed** before build starts:

- Plugin API: `play(url, opts) / pause / seekTo / getState / on('ready'|'play'|'pause'|'ended'|'timeupdate'|'error')`.
- Android: ExoPlayer2 in a `SurfaceView` layered above WebView via `Capacitor.Plugin` + a positioning ViewController that reads bounds from JS.
- iOS: `AVPlayerLayer` with matching bounds bridge.
- DRM path: Bunny signed URLs → pass token in headers, not query.
- Web fallback: keep current iframe as `bunny-web-fallback.tsx` for dev.
- Migration: swap `BunnyStreamPlayer` internals; keep component API identical so no call-site churn.

### #12 pdf.js worker cancel-at-source (1 day)

`src/hooks/useLocalPdfSource.ts` currently `controller.abort()` on cleanup, which produces the `AbortError` currently suppressed globally. Real fix: capture the pdf.js `PDFDocumentLoadingTask` returned by `getDocument()` and call `.destroy()` **before** aborting the fetch. Then remove the `AbortError` entry from `isExpectedCapacitorNoise` — real aborts will surface again.

### #13 Testing skill — vitest asserts (1 day)

- `redactUrl()` in `src/lib/crashShield.ts`: cases for query params, hash, credentials, empty input, non-URL strings.
- Re-entry guards in `sentry.ts` forwarder (`warnedMissingDsn`, `installConsoleErrorForwarder` idempotency).
- `useAndroidBackButton` decision ring: assert `lastOverlayPopAt` debounce drops the second press.

## Blockers unchanged

- Real Apple Team ID → `apple-app-site-association`.
- Release SHA256 fingerprint → `assetlinks.json`.
- iPhone notch safe-area verification on statusbar restore.

## Not in scope for this patch

- Any Batch 3 work.
- CI Node-20 deprecation warnings (cosmetic, auto-migrating).
- `crashShield` heap-breadcrumb rate limit (LOW, deferred).

 -Analysis   
• All Code You Changes and Their work is it worth it ?   
-Rating    
How it Improve Before adter in Term of Speed and Performance and growth   
- find loop hole  
 • What is The Holes  Drawback Of it How to Fix it ?   
Senior level Architect Devloper prompt   
Represented   
koi data analysis Krna ho plan (prompt) ke according TBL format template, comparison kare plan to Excute hua ya nhi insight aayega analysis rating and find loop hool and Senior level Architect Devloper promptMust Use Capicitor skill  
**Progress tracker:**  
- [ ] 1. webapp-to-capacitor  
- [ ] 2. capacitor-best-practices  
- [ ] 3. capacitor-deep-linking  
- [ ] 4. capacitor-keyboard  
- [ ] 5. capacitor-offline-first  
- [ ] 6. capacitor-performance  
- [ ] 7. capacitor-plugins  
- [ ] 8. capacitor-security  
- [ ] 9. capacitor-splash-screen  
- [ ] 10. capacitor-testing  
- [ ] 11. debugging-capacitor  
- [ ] 12. ionic-design  
- [ ] 13. ios-android-logs  
- [ ] 14. safe-area-handling  
- [ ] 15. tailwind-capacitor  
- [ ] 16.capacitor-back-button  
- [ ] 17.asset-optimization  
- [ ] 18.senior-architect-audit  
- [ ] 19.capacitor-video-player-master  
- [ ] 20.app-crash-shield