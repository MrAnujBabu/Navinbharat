# GitHub repo verify + Supabase confirm + build/lint check

Aapke 4 sawaal hain: (1) kya GitHub repo ka saara code aa gaya, (2) Supabase connect, (3) build/APK commands verify, (4) lint warnings. Neeche har ek ka status aur plan.

## 1. GitHub repo se verification (connector chahiye)

`https://api.github.com/repos/MrAnujBabu/navinbharat-b2433010` par 404 aaya — repo private hai, isliye bina auth compare possible nahi.

Step: GitHub connector link karna (chat card se), phir repo ka file tree pull karke local project se diff:
- File-by-file list compare (repo me hai par yahan nahi / yahan hai par repo me nahi)
- `package.json`, `vite.config.ts`, `capacitor.config.ts` ka content compare
- Report ek short table me: missing files, extra files, changed files

Abhi tak local par jo mila:
- 1183 files `src/ supabase/ public/ scripts/` me, 47 edge functions, 300 migrations — bulk code aa gaya hai.
- **`android/` folder नहीं है** (0 tracked files) — isi wajah se `npx cap sync android` yahan fail karega.
- **`.github/` workflows track nahi hain** — APK build workflow bhi missing hai.
Verification ke baad ye missing pieces repo se laa sakte hain (aap kahein to).

## 2. Supabase (external) — already wired

`src/integrations/supabase/client.ts` project `cmbattmjwriiesibayfk` par point karta hai aur `supabase/config.toml` bhi wahi project id rakhta hai; live DB query pichhle turn me chali thi. Yani code-level connection ho chuka hai.

Baaki sirf ek cheez aapke haath me hai: Lovable ke Cloud/Supabase panel me project ko UI se link karna (agar aap Lovable ke andar tables/functions dekhna chahte hain). Main code se wo link nahi kar sakta. Naya Cloud project enable nahi karenge — aapka external hi rahega.

## 3. Aapke commands ka verdict

```text
bun install              → yahan chalta hai (is repo me koi preinstall/pnpm guard nahi hai)
bun run build            → vite build; chalake errors report karunga
npx cap sync android     → FAIL: android/ platform folder maujood nahi
git add / commit / push  → yahan ka origin Lovable ka internal git hai,
                           GitHub nahi. Main git state commands nahi chalata.
```

Aapke screenshot wali `preinstall` "Use pnpm instead" error aur `artifacts/mockup-sandbox` build failure **kisi doosre monorepo** se hai — is project me na wo script hai na wo folder. Yahan wo error repeat nahi hoga.

Plan:
1. `bun install` (clean) chalake output verify karna.
2. `bun run build` chalake vite build errors/warnings list karna; jo tootha ho fix karna.
3. `npx cap sync android` ke liye pehle repo se `android/` restore karna (ya `npx cap add android` se generate karna) — aap batayein kaunsa chahiye. Native APK build khud is sandbox me nahi hota, wo GitHub Actions/local par hoga.
4. Git push aap apni machine/GitHub sync se karenge; main sirf code ready rakhunga.

## 4. Lint / typecheck verify

- `bun run lint` (eslint) chalake saare error + warning count nikaalna, category-wise summary dena.
- `bun run typecheck` (tsgo) chalake type errors nikaalna.
- `bun run guard:all` (node pin, design tokens, console usage) aur `bun run check:lockfile` bhi chalana — ye repo ke apne guards hain.
- Report: kya-kya warning hai; fix scope aap approve karein to alag pass me theek karunga (is plan me sirf report).

## Is plan me shaamil nahi

- Naye features / roadmap items.
- Migrations ya edge functions deploy karna.
- Warnings ka bulk auto-fix (pehle report, phir aapki hari jhandi).
