# Landscape chrome rotation + Downloads/My Library fullscreen

## What's wrong now

Rotation of the page itself works, but when the browser refuses a real orientation lock the app falls back to "pseudo-landscape": only the PDF surface is CSS-rotated 90°. Everything else — header, autoscroll FAB, page chip, rotate button, download button — stays in the portrait frame. That's exactly the screenshot: sideways page, upright header and buttons.

Confirmed in code:
- `DocReaderShell.tsx` applies the `rotate(90deg)` transform to the PDF surface `div` only.
- The autoscroll FAB and page pill portal out to a separate portal host (`usePortalHost`), so they never inherit that transform.
- Header, rotate FAB and save FAB are siblings of the rotated surface, untouched.

## The fix

**1. Rotate the whole reader as one frame**

Move the pseudo-landscape transform up one level, from the PDF surface onto a new wrapper that contains header + PDF surface + overlays + FABs. Because a CSS transform creates a containing block, the `fixed`-positioned FABs and pill inside it rotate and re-anchor with the frame, so "bottom right" stays bottom right of the rotated page.

**2. Portal overlays into the rotated frame**

Point the reader's portal host at the rotation wrapper instead of a body-level host while pseudo-landscape is active, so the autoscroll FAB, the autoscroll sheet and the page chip land inside the rotated frame.

**3. Keep safe areas correct after rotation**

In the rotated frame the physical notch is on the left, not the top. Swap the safe-area padding accordingly (`padding-left: env(safe-area-inset-top)` etc.) so the header doesn't sit under the notch and no strip reappears.

**4. Real-lock path unchanged**

When `lockOrientation('landscape')` succeeds (the normal Android app case) nothing rotates by CSS — the existing behaviour stays exactly as it is today.

**5. Fullscreen on the Downloads / My Library reader**

Same shell is used for locally stored (IndexedDB/Filesystem) documents. Apply the same rotation frame there, and make the fullscreen toggle re-measure the header and surface after the transform settles so the local-storage doc goes truly edge-to-edge instead of keeping the portrait letterbox. Fullscreen exit restores scroll position and page number.

**6. Crash-shield guarantees (app-crash-shield / safe-surface-handling)**

- Rotation/resize listeners registered once, cleaned up on unmount — no stacking across doc opens.
- All post-`await` state writes in the rotation path guarded by the mount ref.
- No new blob URLs; existing revoke paths untouched.
- Reader stays inside its `SafeBoundary`, so a transform failure shows the skeleton fallback, not a blank screen.

## Verification

- Unit tests for the rotation-frame geometry helper (which element gets the transform, safe-area mapping).
- Playwright landscape specs (`android-landscape`, `tablet-landscape`) extended to assert the FAB and page chip sit inside the rotated frame and that the header is not upright while the page is sideways; visual snapshot updated.
- Full suite + build must stay green.
- Razorpay flow re-checked untouched (no payment files edited) — payment code stays out of this change.

## Out of scope

Nothing else changes: no PDF quality, proxy, autoscroll speed, Razorpay or Supabase changes.

## Open question

For "Full screen Download page at local Storage" — do you mean (a) the reader opened from My Library should go proper fullscreen in landscape, or (b) the My Downloads list page itself has a layout problem in landscape? I've planned (a); tell me if it's (b) and I'll adjust.
