# Autoscroll — Student Guide (English + हिंदी)

A complete, feature-by-feature manual for the PDF reader's Autoscroll system.
हर सेक्शन पहले English में, फिर हिंदी में दिया गया है।

---

## 1. What is Autoscroll? / ऑटोस्क्रॉल क्या है?

**English** — Autoscroll moves the PDF page by itself at a speed you choose, so
you can read hands-free. It works on both reader surfaces (the fast canvas
reader and the pdf.js reader), in normal view and in fullscreen.

**हिंदी** — ऑटोस्क्रॉल आपके PDF को अपने आप स्क्रॉल करता है, उस स्पीड पर जो आप चुनते हैं।
हाथ लगाए बिना पढ़ सकते हैं। यह दोनों रीडर में और फुलस्क्रीन में भी काम करता है।

---

## 2. The floating button (FAB) / फ्लोटिंग बटन

**English** — The round Autoscroll button floats at the bottom-right of the reader.

| Gesture | What happens |
| --- | --- |
| Single tap | Start / stop autoscroll |
| Press and hold | Scrolling pauses while your finger is down, resumes on release |
| Long press (≥ 0.28s) while idle | Opens the Autoscroll settings sheet |

**हिंदी** — गोल ऑटोस्क्रॉल बटन रीडर के नीचे-दाएँ कोने में रहता है।

| इशारा | क्या होता है |
| --- | --- |
| एक बार टैप | ऑटोस्क्रॉल चालू / बंद |
| दबाकर रखना | जब तक उँगली दबी है स्क्रॉल रुका रहेगा, छोड़ते ही फिर चलेगा |
| लंबा प्रेस (बंद हालत में) | सेटिंग्स शीट खुलती है |

---

## 3. Speed — now up to 10x / स्पीड — अब 10x तक

**English** — Open the sheet (long press the FAB) to see **Autoscroll speed**.

- Slider range: **0.02x to 10x** (very slow revision reading → very fast skim).
- Preset chips: 0.02, 0.05, 0.1, 0.2, 0.5, 0.75, 1, 1.5, 2, 3, 5, **7**, **10**.
- The current value is shown at the top-right of the sheet, e.g. `2.5x`.
- Your speed is remembered **per document**, so each PDF reopens at the speed
  you last used for it.

Suggested use: 0.2x–0.75x for line-by-line study, 1x–2x for normal reading,
5x–10x for quickly reaching a far page or skimming diagrams.

**हिंदी** — शीट खोलिए (FAB को लंबा दबाइए) और **Autoscroll speed** देखिए।

- स्लाइडर: **0.02x से 10x** तक।
- प्रीसेट चिप्स: 0.02 से लेकर 5, **7**, **10** तक।
- ऊपर दाईं ओर मौजूदा स्पीड दिखती है, जैसे `2.5x`।
- स्पीड **हर PDF के लिए अलग याद** रहती है — अगली बार वही स्पीड मिलेगी।

सुझाव: 0.2x–0.75x लाइन-बाय-लाइन पढ़ाई के लिए, 1x–2x सामान्य पढ़ाई, 5x–10x दूर के
पेज तक जल्दी पहुँचने या डायग्राम स्किम करने के लिए।

---

## 4. Pause at pages (dwell) / पेज पर रुकना

**English** — In the sheet, the **Pause at** panel makes autoscroll stop on the
pages you care about, wait, and then continue.

| Mode | Meaning |
| --- | --- |
| Off | No pausing, continuous scroll |
| Odd | Stops at pages 1, 3, 5, 7 … |
| Even | Stops at pages 2, 4, 6, 8 … |
| Every page | Stops at each page boundary |
| Custom | You type the page numbers, e.g. `1, 5, 3, 2, 8` |

- **Duration chips**: 10s / 20s / 30s / 60s — how long it waits on each page.
  Any value from 5s to 120s is accepted.
- **Custom** accepts numbers in any order and any separator (comma, space or
  semicolon). Duplicates are ignored.
- Pausing also works when autoscroll runs **backwards** — the per-page guard
  resets when direction flips, so the same page can pause again on the way back.

**हिंदी** — शीट में **Pause at** पैनल से ऑटोस्क्रॉल आपके चुने पेजों पर रुकता है, इंतज़ार करता है,
फिर आगे बढ़ता है।

| मोड | मतलब |
| --- | --- |
| Off | कहीं नहीं रुकेगा |
| Odd | 1, 3, 5, 7 … पर रुकेगा |
| Even | 2, 4, 6, 8 … पर रुकेगा |
| Every page | हर पेज पर रुकेगा |
| Custom | आप खुद पेज नंबर लिखें, जैसे `1, 5, 3, 2, 8` |

- **समय चिप्स**: 10s / 20s / 30s / 60s (5s–120s तक कोई भी मान चलेगा)।
- Custom में नंबर किसी भी क्रम में और कॉमा/स्पेस/सेमीकोलन से अलग करके लिख सकते हैं।
- उल्टी दिशा (backward) में भी रुकना काम करता है।

---

## 5. Route mode — forward + backward sequence / रूट मोड

**English** — Route mode lets you build a reading path with waypoints, e.g.
`6, 3, 8, 2`:

1. Scroll **forward** to page 6
2. Turn around and scroll **backward** to page 3
3. Forward again to page 8
4. Backward to page 2, then stop

- Direction is decided automatically for each leg — you don't switch anything.
- **Loop route** toggle: after the last waypoint, start the route again from
  the first one. Perfect for repeated revision of a fixed set of pages.
- Dwell settings still apply, so you can pause at each waypoint.

**हिंदी** — Route मोड में आप पढ़ाई का रास्ता बनाते हैं, जैसे `6, 3, 8, 2`:

1. आगे स्क्रॉल होकर पेज 6
2. फिर पीछे मुड़कर पेज 3
3. फिर आगे पेज 8
4. फिर पीछे पेज 2 — और रुक जाएगा।

- हर हिस्से की दिशा अपने आप तय होती है।
- **Loop route** ऑन करने पर रूट बार-बार दोहराया जाएगा — रिवीजन के लिए बढ़िया।

---

## 6. Reverse autoscroll / उल्टी दिशा में ऑटोस्क्रॉल

**English** — Autoscroll can run upward too. When the direction flips (in Route
mode, or when you scroll back manually), the pause bookkeeping resets so pages
pause correctly in the new direction. Reaching the top or bottom of the
document stops the run.

**हिंदी** — ऑटोस्क्रॉल ऊपर की तरफ भी चल सकता है। दिशा बदलते ही रुकने का हिसाब रीसेट हो जाता है,
इसलिए नई दिशा में भी सही पेजों पर रुकेगा। डॉक्यूमेंट के आखिर/शुरू पर पहुँचकर अपने आप रुक जाता है।

---

## 7. Page indicator chip / पेज नंबर चिप

**English** — A small pill on the right edge shows the pages currently on
screen, e.g. `7–9/17`.

- It fades away about a second after scrolling stops, and comes back the moment
  you scroll again.
- **Drag it up or down** like a scrollbar thumb — the document follows your
  finger, with a light haptic tick at every page boundary.
- **Chevron button** steps one page at a time.
- Keyboard: focus the chip and use ↑ / ↓ or Page Up / Page Down.
- While you drag, autoscroll pauses so the two don't fight; it resumes when you
  let go.

**हिंदी** — दाईं तरफ छोटा पिल दिखाता है कि अभी कौन-से पेज स्क्रीन पर हैं, जैसे `7–9/17`।

- स्क्रॉल रुकने के लगभग 1 सेकंड बाद फीका हो जाता है, दोबारा स्क्रॉल करते ही आ जाता है।
- इसे **पकड़कर ऊपर-नीचे खींचिए** — PDF आपकी उँगली के साथ चलेगा, हर पेज पर हल्का वाइब्रेशन।
- **चेवरॉन बटन** से एक-एक पेज आगे बढ़ेगा।
- खींचते समय ऑटोस्क्रॉल रुक जाता है, छोड़ते ही फिर चालू।

---

## 8. Other reader controls / बाकी कंट्रोल

| Control | English | हिंदी |
| --- | --- | --- |
| Go to first page | A row inside the Autoscroll sheet that jumps to page 1 | शीट में मौजूद रो, सीधे पेज 1 पर ले जाती है |
| Fullscreen | Button next to the book icon in the header; hides browser chrome | हेडर में बुक आइकॉन के बगल का बटन, पूरा स्क्रीन |
| Rotate | Right-side FAB; locks landscape, or rotates via CSS if the device can't lock | दाईं ओर का बटन; लैंडस्केप मोड |

Both the Autoscroll FAB and the page chip stay visible in fullscreen.
फुलस्क्रीन में भी ऑटोस्क्रॉल बटन और पेज चिप दिखते रहते हैं।

---

## 9. Troubleshooting / समस्या और समाधान

| Problem | Fix |
| --- | --- |
| Autoscroll not moving | Speed may be very low (0.02x). Raise it, or check you are not at the end of the document. |
| It keeps pausing | "Pause at" is set to Every page or Odd/Even — switch it Off. |
| Chip not visible | Scroll once; it appears on movement and fades when idle. |
| Route finished too early | The last waypoint was reached. Enable **Loop route** to repeat. |
| Speed reset on another PDF | Speed is saved per document — that's expected. |

| समस्या | हल |
| --- | --- |
| स्क्रॉल नहीं हो रहा | स्पीड बहुत कम (0.02x) हो सकती है — बढ़ाइए। |
| बार-बार रुक रहा है | "Pause at" Every page या Odd/Even पर है — Off कर दीजिए। |
| चिप नहीं दिख रही | एक बार स्क्रॉल कीजिए, चिप आ जाएगी। |
| रूट जल्दी खत्म | आखिरी वेपॉइंट आ गया — **Loop route** ऑन कीजिए। |

---

## 10. Quick exam tips / एग्ज़ाम टिप्स

- Formula pages: **Custom** dwell with those page numbers + 30s duration.
- Two-topic revision: **Route** `12, 4, 20, 4` with Loop on.
- Fast lookup: set **10x**, then drag the chip to fine-tune.
- Reading aloud practice: 0.2x–0.5x with **Every page** dwell at 10s.

- फॉर्मूला वाले पेज: **Custom** में वे पेज नंबर + 30s।
- दो टॉपिक रिवीजन: **Route** `12, 4, 20, 4`, Loop ऑन।
- जल्दी ढूँढ़ना हो: **10x** लगाइए, फिर चिप खींचकर सही जगह रुकिए।
- बोलकर पढ़ने की प्रैक्टिस: 0.2x–0.5x + **Every page** 10s।
