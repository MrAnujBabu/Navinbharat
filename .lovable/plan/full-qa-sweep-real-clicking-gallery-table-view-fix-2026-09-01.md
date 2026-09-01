# Full QA Sweep (real clicking) + Gallery / Table View Fix

Goal: browse the live app as a real student using `naveenbharatprism@gmail.com`, click through every screen, record what works and what does not, then fix the broken items — starting with the Gallery and Table views you reported.

## Part 1 — Gallery / Table view: confirm the real cause first

Both views exist in code (`ContentViewSwitcher`, `LectureGalleryCard`, `LectureTableView`, used by `MyCourseDetail`, `ChapterView`, `LectureListing`). So the failure is behavioural, not a missing feature. Before any edit, I will reproduce it in the browser and capture the exact symptom:

- Does the Gallery/Table icon respond to a click at all (state not switching)?
- Does the view switch but render empty / blank / broken layout?
- Does a console or runtime error fire on switch?
- Does it break only on some pages (chapter vs course vs listing) or only at mobile width?

Then fix exactly that cause and re-verify by clicking again in all three places the switcher appears, in both mobile and desktop widths, and in light + dark mode.

## Part 2 — Human-style full audit

I log in once and then click through every reachable screen the way a student would, capturing a screenshot and any console/network error per screen. Flows covered:

1. Landing → Login (right and wrong password) → Dashboard
2. Courses list → course detail → chapter → lecture (video play, seek, quality)
3. Content view switcher: List / Gallery / Table on every page that offers it
4. Library → PDF open → pinch zoom behaviour, 100% floor, page navigation, download
5. Tests → start → answer → submit → result → Report Card
6. Attendance, Timetable, Notices, Downloads
7. Ask Doubt AI Agent: text question, image question, retry behaviour
8. Subscription page, Profile edit, Settings (theme, logout)
9. Navigation basics: back button, bottom tabs, deep links, refresh mid-flow
10. Mobile viewport pass (420x900) plus a desktop pass

## Part 3 — Report format

You get one table, sorted by severity:

```text
| # | Screen / Action | Result | Severity | Evidence |
|---|-----------------|--------|----------|----------|
| 1 | Course detail → Table view | Broken: ... | Critical | screenshot + console line |
```

Severity: Critical (blocks a student), Major (feature degraded), Minor (cosmetic). Each row carries a screenshot and, where relevant, the exact console/network error.

## Part 4 — Fixes

- Fix all Critical and Major findings in this same round, starting with Gallery/Table.
- Re-run the exact click path for each fix to prove it works.
- Minor/cosmetic items get listed with a recommendation so you can pick what to fix.
- Close with lint, typecheck, tests and build all green.

## Technical notes

- Driven by Playwright against the local dev server at 1280x1800 and a 420x900 mobile context; login uses the account you gave, with the known 5s auth-bootstrap settle wait so form fields are not cleared.
- Per screen I collect: final URL, DOM state, console errors, failed network requests, screenshot.
- Screenshots are kept as QA evidence only; no test data is written into your production tables beyond normal student activity (test attempts, chat messages).
- No schema or admin changes are part of this plan.
