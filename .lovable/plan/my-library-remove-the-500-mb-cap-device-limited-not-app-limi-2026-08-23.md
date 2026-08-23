# My Library: remove the 500 MB cap (device-limited, not app-limited)

You are right that My Library is fully on-device (IndexedDB + Capacitor Filesystem) — no Supabase storage, no bandwidth cost. The 500 MB number is a hardcoded app constant, so it can go.

But "unlimited" honestly means "as much as the device allows". The browser/WebView still enforces a real quota, and ignoring it is what causes the crash class we already guard against. So the plan is: drop our artificial cap, and switch to the device's real quota.

## What changes for you

- The bar stops saying "0 KB of 500.0 MB used".
- It shows real device numbers instead: "120 MB used — 12.4 GB free on this device". If the platform doesn't report a quota (some WebViews), it just shows "120 MB used" with no bar and no limit.
- Imports no longer get blocked by our number. They only fail if the device itself is genuinely out of space, and then the message says so plainly.
- The "almost full" warning stays, but it now triggers off real free space (under ~10% or under 500 MB free), which is when the OS actually starts evicting data.

## What deliberately stays

- **Per-file cap** — the largest single file we can stream in without an out-of-memory crash on a low-RAM Android. This is a memory limit, not a storage limit; removing it means a hard crash on big files, not a bigger library.
- **Heap headroom check before an import** — same reason.
- **Persistent-storage request** — already in place; it asks the OS not to evict our data. With no app cap this matters more, not less.
- **Manual cleanup UI** — the only backstop once the app stops policing size.

## Audit notes (the "+ / −" you asked for)

**Plus**
- No Supabase egress or storage cost — this is 100% local, so the cap was buying nothing.
- Students on one phone for the whole exam year can keep every PDF offline.
- Fewer confusing "Library is full" errors when the phone has 40 GB free.

**Minus / risks, and how they are handled**
- Unbounded IndexedDB is the #1 OOM/eviction trigger on low-RAM Android. Handled by keeping per-file and heap-headroom limits, and by surfacing real free space.
- A silent OS eviction can wipe saved files without warning. Handled by the persistent-storage request plus a clearer low-space warning.
- Reads of `cap` are spread across a few screens. All of them move to the same nullable-quota shape so no screen renders `NaN%` or a 100%-full bar when quota is unknown.

## Technical

- `src/lib/personalLibraryQuota.ts`: delete `PERSONAL_LIB_SOFT_CAP_*`; `canAdd` returns `{ ok, used, quota: number | null, free: number | null }` sourced from `navigator.storage.estimate()`, `ok` false only when the device reports insufficient free space (file size + safety headroom).
- `src/services/personalLibrary.ts`: `canAddAware` and both call sites (`addFileToFolder`, the blob-import path) keep pending-byte reservation but compare against device free space; error copy changes to "Device is out of storage".
- `src/hooks/usePersonalLibrary.ts`: expose `used`, `quota`, `free` instead of the constant `cap`.
- `src/components/library/personal/MyLibrary.tsx` and `FolderView.tsx`: render the new labels, hide the progress bar when `quota` is null, recompute `nearFull` from free space.
- Typecheck after the change; no database, edge function, or Supabase work involved.
