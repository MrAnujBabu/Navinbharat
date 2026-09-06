# My Library PDF full-screen: final Android deep fix

## Confirmed findings

- Screenshot में सबसे ऊपर की सफेद पट्टी PDF page का हिस्सा नहीं है; वह document surface से बाहर Android window/status-area में दिख रही है।
- My Library का local PDF flow `FolderView → UniversalFileViewer → DocReaderShell → PdfViewer → FastPdfReader` है। Local URI सही canvas viewer तक पहुँच रहा है।
- Reader अभी full-page state को web fullscreen, installed-app detection, landscape और native immersive calls से एक साथ नियंत्रित करता है। इससे orientation/resume पर कई asynchronous calls एक ही Android window को hide/show/overlay करते हैं।
- APK का `MainActivity.java` GitHub repository में है, लेकिन current Lovable checkout में `android/` tree नहीं है। इसलिए केवल frontend sync करने से native fix update नहीं होता।
- APK native layer immersive entry पर window backdrop को black बनाती है, जबकि user requirement है कि screen कहीं black न हो। Web reader muted/theme surface paint करता है; दोनों layers का रंग अभी consistent नहीं है।
- PDF width measured reader container से आती है, लेकिन stored zoom और rotation/fullscreen settling के बाद fit-width को authoritative reset नहीं किया जाता; इससे PDF available width से छोटा रह सकता है।

## Implementation

1. **एक fullscreen owner बनाएँ**
   - My Library local PDF के लिए एक explicit reader lifecycle रखें: open → edge-to-edge, rotate/resume → reapply, close → normal app chrome restore.
   - duplicate status-bar/immersive effects और competing cleanup हटाएँ ताकि कोई late callback status area दोबारा reserve न करे।
   - Portrait और landscape दोनों में Back, Notes, Search, Autoscroll, Rotate और Download floating controls visible और usable रहें।

2. **Android window को reader colour से edge-to-edge paint करें**
   - GitHub के Android `MainActivity` immersive bridge को update करें ताकि status/navigation inset layout को push न करें और rotation/focus के उसी frame में bars hide हों।
   - Native window backdrop black न रखकर उसी semantic muted reader colour से paint करें जो PDF के आसपास web layer उपयोग करती है।
   - system contrast scrim, action bar और accidental top inset को disabled/transparent रखें; close पर normal themed status bar safely restore करें।

3. **PDF को उपलब्ध screen width में भरोसेमंद ढंग से fit करें**
   - Local PDF खुलते ही zoom को fit-width baseline पर normalize करें; user का manual zoom इसके बाद काम करता रहे।
   - fullscreen enter, real/CSS landscape rotation, resume और final viewport settlement पर actual reader container को re-measure करके fit दोबारा लगाएँ।
   - A4 page aspect ratio बना रहे; document page crop/stretch नहीं होगा। खाली area PDF page नहीं, reader theme colour होगा—black नहीं।

4. **White strip के सभी visual sources हटाएँ**
   - Local full-page path में synthetic top/bottom safe-area bands या hidden header height reserve न हों।
   - Root, Android window, reader shell, loading placeholders और PDF scroll surface एक ही themed background use करें, ताकि transition frame में भी सफेद/काली flash न दिखे।
   - Floating toolbar status area के नीचे सुरक्षित रहे, लेकिन PDF viewport height कम न करे।

5. **Regression और device matrix**
   - Tests जोड़ें कि local PDF path में एक ही fullscreen owner है, hidden header कोई height नहीं लेता, fit-width final container से आता है, और controls portrait/landscape में रहते हैं।
   - Phone portrait, phone landscape, PWA standalone और desktop viewport पर screenshot/runtime verification करें।
   - Type check, focused reader tests, full test suite, production build, Capacitor dependency check और APK workflow checks चलाएँ।

## Release

- Verified frontend files और Android native files को `MrAnujBabu/Navinbharat` में एक ही commit में sync करें।
- अगले उपलब्ध version `v1.2.11` का signed APK बनाएँ।
- GitHub Actions success, APK signature/package और release asset verify करके direct APK तथा release links दें।
- Existing My Library files/data delete नहीं होंगे। Real phone पर पुराने APK को update करके portrait और landscape दोनों का final visual check करना आवश्यक रहेगा।
