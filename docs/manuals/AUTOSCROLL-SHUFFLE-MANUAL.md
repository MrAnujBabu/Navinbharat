# Autoscroll + "Pause at → Shuffle" — Student Manual

Ye manual PDF reader ke **Autoscroll sheet** ka step-by-step use batata hai:
autoscroll kaise chalayein, `Pause at` ke saare modes kya karte hain, aur
**Shuffle** (FSRS spaced repetition) se revision kaise karein.

> Deep technical explanation: [`docs/reader/shuffle-revision-guide.md`](../reader/shuffle-revision-guide.md)
> Code: `src/components/viewer/AutoScrollSheet.tsx`, `src/lib/reader/fsrsScheduler.ts`,
> `src/lib/reader/shufflePrefs.ts`, `src/hooks/useAutoScroll.ts`

---

## 1. Autoscroll kaise shuru karein

1. Library se koi bhi PDF kholein.
2. Screen ke neeche-right me **Autoscroll FAB** (round button) par tap karein.
3. Sheet khulti hai. **Autoscroll speed** slider se rafter set karein.
4. FAB dobara tap = **Start / Stop**. Chalte waqt page apne aap scroll hota hai.
5. Ungli se scroll karte hi autoscroll **khud pause** ho jaata hai; FAB se resume.

**Reverse autoscroll** toggle upar ki taraf scroll karta hai (revision me
neeche se upar dohraane ke liye).

Screen ke upar **page pill** (jaise `12 / 240`) current page dikhata hai; uske
arrows se ek page upar/neeche ja sakte hain — arrow ki direction wahi hoti hai
jis taraf aap ja rahe ho.

---

## 2. "Pause on pages" ke 6 modes

Autoscroll har chune hue page par kuch second rukta hai (**Pause duration**).
Kis page par rukna hai, wo `Pause on pages` decide karta hai:

| Mode | Kab use karein |
|---|---|
| **Every page** | Pehli baar poora PDF padhte waqt |
| **Odd** | Sirf visham pages (1, 3, 5…) — do-page layout wali books |
| **Even** | Sirf sam pages (2, 4, 6…) |
| **Custom** | Aap khud list dein: `1, 5, 3, 2, 8` — sirf inhi pages par pause |
| **Route** | Aapke diye order me pages par jaata hai: `6, 3, 8, 2` |
| **Shuffle** | **Spaced-repetition order** — jo page bhoolne wale ho, wo pehle |

`Custom` aur `Route` ka farq: Custom sirf *rukne ki jagah* badalta hai (scroll
seedha rehta hai), Route *jaane ka kram* badal deta hai.

---

## 3. Shuffle mode — 60 second me samajh

- Har **page = ek flashcard**.
- Algorithm **FSRS-5** hai (wahi jo aaj Anki me default hai, wahi 19 weights).
- App aapse Again/Hard/Good/Easy nahi poochhta — **grade aapke padhne ke time se
  infer** hota hai: page par jitna zyada time (pause duration ke mukable), utna
  "mushkil" maana jaata hai aur page utni jaldi wapas aata hai.
- Order: **Leech → sabse zyada bhoole hue due pages → naye pages → known pages**,
  beech me interleaving (page 12 ke turant baad 13 nahi aayega).

### Kya har baar page 1 se shuru hoga?

- **Naya document**: haan — sab pages "new" hain, isliye 1 → 2 → 3 chalega.
- **Uske baad**: nahi — jaise hi pages par time bitta hai, agla session usi page
  se shuru hoga jiski aapko sabse zyada zaroorat hai.
- Zabardasti order badalna ho: **Reshuffle** (naya seed) ya **Reset** (us
  document ki revision memory poori saaf).

---

## 4. Shuffle ke controls (Anki deck options jaise)

| Control | Range / default | Kya karta hai |
|---|---|---|
| **Desired retention** | 70–97%, default **90%** | Kitna yaad rakhna hai. Zyada = pages jaldi wapas, load zyada |
| **New vs revision mix** | 0–100%, default **35%** | Naye pages kitni tezi se revision ke beech ghusein |
| **Session limit** | default **0 = no cap** | Ek session me max kitne pages |
| **From – To** | poora document | Sirf ek chapter ka range revise karein |
| **Agle 7 din ka load** | sparkline | Har din kitne pages due honge |
| **Reshuffle** | — | Wahi scheduling, naya order seed |
| **Reset** | — | Is document ki revision memory delete |

Ye settings **global** hain (`nb_shuffle_prefs_v1` localStorage) — kyunki ye
batati hain aap kaise revise karte ho. **Card data per-document** IndexedDB me
save hota hai.

---

## 5. Ready-made presets

| Situation | Retention | New mix | Session limit | Pause |
|---|---|---|---|---|
| Exam se 1 hafta pehle | 92–95% | 20% | 40 | 6–8s |
| Naya chapter padhna | 85% | 70% | 0 | 10–15s |
| Daily maintenance revision | 90% | 35% | 25 | 5s |
| Formula / diagram rattna | 95% | 10% | 30 | 4s |

---

## 6. Rozana ka workflow (recommended)

1. PDF kholo → FAB → `Pause on pages` = **Shuffle**.
2. Range set karo (jaise `1 – 40` ek chapter ke liye) aur preset se sliders set karo.
3. Pause duration itna rakho jitne me aap page ek baar dhang se padh sako.
4. FAB tap → autoscroll start. Ab sirf padho — har page ka grade apne aap ban raha hai.
5. Kisi page par notes chahiye to header ka **note icon** dabao (Obsidian/.md export bhi wahin hai).
6. Session ke baad **Agle 7 din ka load** dekho — koi din bahut bhaari lage to
   retention thoda kam karo ya session limit lagao.

---

## 7. Troubleshooting

| Problem | Wajah | Fix |
|---|---|---|
| Order har baar 1, 2, 3 | Document abhi naya hai (sab pages new) | Ek session chalao, phir order badlega |
| Ek hi page baar-baar aata hai | Wo leech ban gaya (bahut lapses) | Usse dhyan se padho, ya Reset |
| Autoscroll khud ruk jaata hai | Aapne manually scroll kiya | FAB se resume |
| Sab pages "due" dikhte hain | Retention bahut zyada (95%+) | 88–90% par le aao |
| Dusre phone par progress nahi | Revision memory device-local (IndexedDB) hai | Abhi cross-device sync nahi hai |

---

## 8. Seemayein (imaandaari se)

- Grade dwell-time se infer hota hai — phone side me rakh dena "Again" jaisa
  signal deta hai. Aisa ho to Reshuffle/Reset.
- Ek page = ek concept nahi hota; ghane pages par estimate mota hai.
- Revision memory abhi devices ke beech sync nahi hoti.
