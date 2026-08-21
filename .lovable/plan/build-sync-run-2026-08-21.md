# Build & sync run

You asked me to run the install → build → Capacitor sync → commit → push sequence. I'm in plan mode, so nothing has run yet. Here's exactly what I'll do on approval.

## Steps

1. `bun install` — restore dependencies.
2. `bun run build` — production Vite build; report bundle output and any errors.
3. `npx cap sync android` — copy `dist/` into the Android project and refresh plugins.
4. Read `/tmp/observability/build-errors.log` and confirm a clean build.
5. Report: install summary, build time/bundle sizes, Capacitor plugin list, and any warnings worth acting on.

## Note on git

Git state (add / commit / push) is managed by the platform, so I can't run `git add`, `git commit`, or `git push` myself. Your changes are versioned automatically, and you can push to GitHub from the project's GitHub integration. Everything else in the sequence I can run.

If you want the APK itself, the tagged CI workflow (`.github/workflows/build-apk.yml`) is what produces it after the push.
