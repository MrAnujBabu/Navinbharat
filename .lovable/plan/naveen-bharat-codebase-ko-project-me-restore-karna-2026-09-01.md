# Naveen Bharat codebase ko project me restore karna

Aapka zip ek poora Lovable/Vite app hai (660 src files, React Router, Capacitor, 300 SQL migrations, 47 edge functions, external Supabase). Ye project abhi khaali TanStack template hai. Plan: zip ka code as-is is project me set karna, taaki aap code tool me edit kar sakein — Supabase external hi rahega.

## Kya hoga

1. **Template scaffold hataana**: current placeholder files (`src/routes/`, `src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/styles.css`, TanStack configs) remove.
2. **Zip ka code copy**: `src/`, `public/`, `supabase/`, `server/`, `scripts/`, `docs/`, `drizzle/`, `index.html`, `package.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `capacitor.config.ts`, `components.json`, `roadmap.md`, `AGENTS.md`, `README.md`.
   - `.git` metadata copy nahi hoga (zip me nahi hai — verified).
3. **Env / Supabase (external)**: zip ke `.env` me sirf public values hain — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Ye teen values project env me set karke app aapke maujooda "Naveen Bharat" Supabase se hi baat karega. Koi naya Cloud/Supabase project enable nahi karenge, migrations bhi apply nahi karenge (aapka DB already live hai).
   - Server-side/edge secrets (Razorpay, Zoom, Bunny, AI keys) aapke Supabase project me pehle se hain; yahan add karne ki zaroorat nahi jab tak aap edge functions yahan se deploy na karna chahein.
4. **Dependencies install** aur dev server chalu karke preview verify: home/landing route load ho, console errors check, build errors log clean.

## Technical notes

- Stack legacy Vite SPA hi rahega: `react-router-dom` v7 + `index.html` entry + Tailwind v3 config file (TanStack Start/Tailwind v4 setup replace ho jaayega). Ye zip ke code ko bina refactor chalane ka sabse safe raasta hai.
- Supabase client zip me pehle se mojood hai (`src/integrations/supabase/*`), sirf `VITE_*` env values chahiye.
- Capacitor/native plugins install honge par web preview par no-op rahenge; native build local machine par hi hoga.
- `roadmap.md` zip se aa raha hai; open items waise hi preserve rahenge.

## Ye plan me shaamil nahi

- Naye features ya bug fixes (roadmap ke pending items) — restore ke baad separately karenge.
- Edge functions ya migrations ko yahan se deploy/apply karna.
