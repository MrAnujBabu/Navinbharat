# Push to GitHub and release an installable APK

Goal: get the full codebase into the empty `MrAnujBabu/Navinbharat` repo, then tag it so the
existing workflow builds a debug APK and attaches it to a GitHub Release you can install on a phone.

## What I verified first

- The sandbox has **1314 tracked files / 62 MB**, and `android/` is already committed (53 files
  including `gradlew`), so the repo has everything Gradle needs.
- The APK build needs **no secrets**: `src/integrations/supabase/client.ts` hardcodes the Supabase URL
  and the publishable anon key. Nothing to configure on the GitHub side for the build to succeed.
- `.github/workflows/build-apk.yml` already does the right thing: `v*` tag -> Node 24 + JDK 21 +
  SDK 35 -> `assembleDebug` -> APK smoke check -> emulator boot test -> **Publish GitHub Release**
  with `app-debug.apk` attached.
- There is currently **no GitHub connection** linked to this project.

## The one real obstacle

The Lovable sandbox cannot `git push` to GitHub. Its `origin` is a Lovable-internal git host, and the
GitHub connector routes through a gateway that never exposes the raw GitHub token to a shell. So the
push has to go through the **GitHub Git Data API** instead of the `git` CLI.

Two consequences you need to approve:

1. **A GitHub connection must be created**, and its token needs both the `repo` and `workflow`
   scopes. Without `workflow`, GitHub rejects any push that contains `.github/workflows/*` — which is
   exactly the file that builds the APK. I will request both scopes on the connect card.
2. The upload is done by a script, not 1314 separate steps, so it stays fast.

## Steps

1. **Connect GitHub.** I open the connect card; you authorize with `repo` + `workflow` scopes.
2. **Confirm the repo is empty** and read its default branch.
3. **Build the commit via the Git Data API** with one script run:
   `git ls-files` for the exact file list -> upload each file as a blob (binaries such as
   `gradle-wrapper.jar`, the pdf.js WASM and the PNG icons go up base64-encoded) -> create one tree
   -> create one commit -> point `refs/heads/main` at it. Executable bits on `gradlew` and
   `scripts/*.sh` are preserved via mode `100755`, otherwise the Gradle step fails.
4. **Verify the push** by re-reading the tree from GitHub and diffing the file list and blob count
   against the sandbox. I report an exact match or name what is missing.
5. **Tag `v1.0.0`** on that commit, which triggers the APK workflow.
6. **Monitor the run** to completion and report each step's result. If it fails, I read the real log,
   fix the cause, push the fix and re-tag (`v1.0.1`) rather than guessing.
7. **Confirm the Release** exists with `app-debug.apk` attached, and give you the download link.

## Two things to expect on a fresh repo

- **`playwright.yml` will fail** and show a red check. It runs on every push to `main` and needs five
  repository secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
  and two test-account values) that a brand-new repo does not have. It is unrelated to the APK and
  does not block the Release. I will leave it in place and tell you which secrets to add later; say
  the word if you would rather I skip it on push until then.
- **The emulator boot test gates the Release.** It boots the APK on an API 34 emulator to catch real
  runtime crashes, and it can occasionally fail on runner infrastructure rather than on your code. If
  that happens I re-run the job; I will not weaken the gate, because it is the step that proves the
  APK actually opens on a phone.

## Result

A debug APK attached to the `v1.0.0` Release. Debug-signed, so it installs directly on any Android
phone with "install from unknown sources" enabled — no Play Store and no keystore needed. If you later
want a Play-Store-uploadable signed release build, that is a separate change (upload keystore stored
as repository secrets).
