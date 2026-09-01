# Admin Manual — PDF Reader Zoom & Player Branding

Audience: Naveen Bharat admins. No coding needed.

---

## 1. Where the switches are

1. Sign in with an admin account.
2. Open **Admin panel** → **Social** tab.
3. You will see three cards:
   - **Social Links** (existing)
   - **PDF Reader**
   - **Player Branding**

Every switch saves instantly. A green toast confirms it. Students see the change
within about 5 minutes, or immediately after they reopen the app.

---

## 2. PDF Reader card

| Switch | On | Off (default) |
| --- | --- | --- |
| Show on-screen zoom buttons | The floating `−` / `100%` bar appears at the bottom of the reader | No buttons; students zoom with fingers only |

Rules that always apply, whatever the switch says:

- The reader **opens at 100%** (full page width).
- **Zoom out never goes below 100%** — no more tiny 50–70% pages.
- **Zoom in is finger-based**: pinch out, or double-tap. Maximum 400%.
- Tap the `100%` label (when the bar is shown) to snap back to fit-width.
- The `+` button no longer exists anywhere.

---

## 3. Player Branding card

Two independent switches for the video player overlays.

| Switch | Where it shows | On = **Appear** (default) | Off = **Hide** |
| --- | --- | --- | --- |
| Infinity logo badge | Bottom-left of the video | Our round badge covers YouTube's "More videos" / infinity chip | Badge removed — YouTube's chip becomes visible |
| YouTube label mask | Bottom-right of the video | Our dark "Bharat" chip covers YouTube's white label watermark | Chip removed — YouTube's watermark becomes visible |

Recommendation: keep both **On**. Switch one Off only when you deliberately want
YouTube's own element visible in that corner.

---

## 4. Quick checks after changing a switch

1. Open any lesson video in the student app (portrait and fullscreen/landscape).
2. Confirm the corner you changed looks the way you expect.
3. Open any PDF: it must start at 100%, pinch in should work, pinch out must
   stop at 100%.

If a change does not appear, pull down to refresh the screen or reopen the app —
settings are cached for a few minutes.

---

## 5. Troubleshooting

| Symptom | What to do |
| --- | --- |
| Switch flips back after saving | You are not signed in as an admin, or the network dropped. The toast shows the error. Re-login and retry. |
| Student still sees the old state | Cache: wait ~5 minutes or reopen the app. |
| PDF opens smaller than the screen | Tap the `100%` label, or close and reopen the document. |
| YouTube chip visible in a corner | The matching Player Branding switch is Off — turn it On. |

---

## 6. Technical note (for developers)

All three flags live in `public.site_settings` as text `"true"` / `"false"`:

| Key | Default |
| --- | --- |
| `pdf_zoom_controls_enabled` | `false` |
| `player_infinity_mask_enabled` | `true` |
| `player_label_mask_enabled` | `true` |

Read via `src/hooks/usePdfZoomControls.ts` and `src/hooks/usePlayerBranding.ts`.
Both hooks fail safe: a read error keeps the zoom bar hidden and keeps the
branding overlays visible. Zoom bounds live in `src/lib/pdfZoom.ts`
(`MIN_ZOOM = 1`, `MAX_ZOOM = 4`), mirrored for the vendored viewer in
`public/pdfjs/web/nb-bridge.js`.

---

## 7. If students report "AI service available नहीं है (server key issue)"

1. Open **/admin/ai-health** and press **Run check**.
2. Read the badges:
   - *API key present* + all checks **OK** → the AI is fine; the student hit a
     slow response. Ask them to press **Retry**.
   - Any check showing `gateway_unauthorized` or `not_configured` → the server
     key needs rotation. Send the copied report (**Copy report**) to the
     developer; rotation takes under a minute.
3. Credits (`402`) and rate limit (`429`) show their own messages to students —
   those are not key problems.
