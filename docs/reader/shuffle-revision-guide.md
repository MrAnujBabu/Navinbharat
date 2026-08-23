# Shuffle (Autoscroll sheet) — kaise kaam karta hai aur revision me kaise madad karta hai

> Jagah: PDF reader → Autoscroll FAB → **Pause at** → `Shuffle`
> Code: `src/lib/reader/fsrsScheduler.ts`, `src/lib/reader/shufflePrefs.ts`,
> `src/components/viewer/AutoScrollSheet.tsx`

---

## 1. Ek line me

Autoscroll har page par thodi der rukta hai. `Pause at` batata hai **kis page par**
rukna hai — `Every page`, `Odd`, `Even`, ya **`Shuffle`**. Shuffle mode me pages
document order me nahi, balki **spaced-repetition order** me aate hain: jo page
aap bhoolne wale ho, wo pehle aata hai.

## 2. Ye Anki par kaise based hai

Har **page = ek flashcard**. Algorithm **FSRS-5** hai — wahi scheduler jo Anki me
SM-2 ki jagah default ban chuka hai, aur wahi 19 default weights (`FSRS_W`).

Har page ke do number yaad rakhe jaate hain:

| Number | Matlab |
|---|---|
| **Stability (S)** | Yaad kitne din tikegi |
| **Difficulty (D)** | 1–10, ye page *aapke liye* kitna mushkil hai |

Aur inse nikalta hai **Retrievability R** — abhi is waqt yaad hone ki probability:

```
R(t) = (1 + FACTOR · t/S) ^ (−0.5)
```

Page "due" tab hota hai jab `R` aapke **desired retention** se neeche gir jaaye.

### Rating buttons kahan hain?

Kahin nahi — aur yahi is app ka Anki se sabse bada farq hai. Grade **padhne ke
behaviour se infer** hota hai (`inferGrade`), page par bitaye time ÷ set kiye gaye
pause time ke ratio se:

| Ratio (time bitaya ÷ pause) | Grade | Anki button |
|---|---|---|
| ≥ 2× | 1 | Again |
| ≥ 1.3× | 2 | Hard |
| 0.7–1.3× | 3 | Good |
| < 0.7× | 4 | Easy |
| page dobara khola | 1 | Again |

Yaani: jitni der aap ek page ko ghoorte ho, algorithm maan leta hai ki wo page
aapko utna kam aata hai — aur use jaldi wapas laata hai.

## 3. Ek session ka order kaise banta hai

`buildShuffleRoute()` isi kram me queue banata hai:

1. **Leeches** — jin pages ko aap `leechThreshold` (default 8) baar bhool chuke ho.
2. **Due pages** — sabse kam recall wale pehle.
3. **Naye pages** — document order me, `newMix` ke hisaab se due stream me weave.
4. **Known pages** — agar sab kuch yaad hai to sabse kam stable page, taaki
   session kabhi khaali na ho.
5. **Interleaving** — aas-paas ke pages ko alag kiya jaata hai (page 12 ke turant
   baad 13 nahi), kyunki interleaved practice blocked practice se behtar hai.
6. **Seeded jitter** — ±0.02 recall ka halka shuffle, taaki barabar cards ka order
   badle par yaad page kabhi bhoole page se aage na aaye. Seed same = order same.

### "Kya har baar page 1 se start hoga?"

- **Bilkul naye document par: haan** — sab pages "new" hain, aur new pages document
  order me chalte hain: 1 → 2 → 3…
- **Uske baad: nahi** — jaise hi pages par time bitna shuru hota hai, unke due
  dates ban jaate hain aur agla session usi order me shuru hota hai jo aapko
  sabse zyada zaroori hai (leech → sabse bhoola hua → naya → known).
- Order ko zabardasti badalna ho to sheet me **Reshuffle** dabao (naya seed), ya
  **Reset** se us document ki revision memory poori tarah mita do.

## 4. Sheet ke controls

| Control | Anki ka equivalent | Kya karta hai |
|---|---|---|
| **Desired retention** (70–97%) | Deck options → Desired retention | Kitna yaad rakhna hai. Zyada = pages jaldi wapas, kaam zyada |
| **New vs revision mix** (0–100%) | New/review order | Naye pages kitni tezi se revision ke beech ghuse |
| **Session limit** | Review limit | Ek session me max kitne pages |
| **Range (from–to)** | Deck subset | Sirf chapter ke pages revise karo |
| **Forecast sparkline** | Future due graph | Agle 7 din har din kitne pages due honge |
| **Reshuffle** | — | Naya seed, wahi scheduling |
| **Reset** | Forget cards | Is document ki poori revision memory saaf |

Ye settings **global** hain (`nb_shuffle_prefs_v1`), kyunki ye batati hain ki aap
kaise revise karna pasand karte ho — kisi ek PDF ki property nahi hain. Revision
memory (cards) **per document** save hoti hai.

## 5. Revision me practical madad

- **Exam se pehle**: retention 92–95%, newMix ~20%, session limit 40 — purana
  syllabus baar-baar aayega, naya kam ghusega.
- **Naya chapter padhte waqt**: retention 85%, newMix 60–80% — zyadatar naya
  content, beech-beech me purane page ka recall.
- **Sirf weak pages**: sheet me due count dekho; leech pages hamesha sabse upar
  aate hain, isliye "jo bar-bar bhulta hai" wahi sabse zyada dikhega.
- **Sparkline flat rakho**: agar kisi din ka bar bahut lamba hai, retention thoda
  ghatao ya session limit lagao — warna us din ka load chhoot jaayega.

## 6. Limitations (imaandaari se)

- Grade dwell-time se infer hota hai, isliye phone side me rakh dena = "Again"
  jaisa signal. Aisa hone par Reshuffle/Reset madad karta hai.
- Ek page ka matlab ek concept nahi hota; ghane pages par estimate mota hai.
- Revision memory device-local hai (IndexedDB) — abhi devices ke beech sync nahi hoti.
