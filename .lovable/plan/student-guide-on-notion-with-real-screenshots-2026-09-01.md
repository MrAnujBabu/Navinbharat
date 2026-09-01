# Student Guide on Notion (with real screenshots)

Goal: publish one expert-quality Notion page — an end-to-end student handbook for Naveen Bharat — with real screenshots taken from the live app, then share the page link in chat.

## What the page will cover

1. Welcome / what the app is, and what a student can do
2. Account: Sign up, Login (email + password), Phone OTP login, Forgot password
3. First run: Dashboard tour, exam track selection, batch selection
4. Courses: browse, buy/enroll, open a chapter, watch a lecture
5. PDFs & Notes: opening a PDF, reading mode, page indicator, save offline / My Library
6. Doubts & AI help: Ask Doubt, Safar Agent chat, what each error message means and what to do (retry / credits / session expired)
7. Tests & DPP: attempt a quiz, see results and reports
8. Live classes, notices, community, messages
9. Profile, subscription, settings, dark mode, install as app (APK / PWA)
10. Troubleshooting FAQ — the common student doubts, each with a fix
11. Support / contact

## Screenshots

Captured from the running app with a headless browser, signed in with the account you gave (`naveenbharatprism@gmail.com`). Planned shots: login screen, dashboard, course list, course detail, chapter/lecture player, PDF reader, Ask Doubt panel, quiz attempt, profile/settings.

Notion image blocks need publicly reachable URLs, so each PNG will be uploaded to a public Supabase Storage bucket (`public-docs`, created if absent) and embedded by URL. Every screenshot gets a caption.

## Notion delivery

- Uses your existing workspace connection "nb's Notion" through the Lovable connector gateway (no new connection needed).
- A parent page is located via Notion search; the guide is created as a child page titled "Naveen Bharat — Student Guide (End to End)".
- Content is written as proper Notion blocks: headings, callouts, numbered steps, toggles for the FAQ, dividers, image blocks with captions.
- If no page has been shared with the integration, the connector consent screen has to be re-run to pick a parent page — I will say so instead of guessing.

## Deliverable

The Notion page URL posted in chat, plus a short summary of the sections. A copy of the same content stays in the repo at `docs/manual/STUDENT-GUIDE.md` so it is versioned.

## Technical notes

- Screenshots: Playwright (Chromium, viewport 1280x1800) against `http://localhost:8080`; credentials read from env, never printed into the doc or logs.
- Storage: `public-docs` bucket, path `student-guide/<slug>.png`, public read only (no write policy for anon).
- Notion: `standard_connectors--call_gateway_connection` with `Notion-Version: 2022-06-28`; `POST /v1/search` to find the parent, `POST /v1/pages` to create, `PATCH /v1/blocks/{id}/children` in batches of 100 blocks for the body.
- Language: simple Hinglish for students, no "Hindi" wording in headings (tone check rule).
