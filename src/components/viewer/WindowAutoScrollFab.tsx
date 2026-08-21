import { useEffect, useRef, useState } from "react";
import AutoScrollFab from "./AutoScrollFab";

/**
 * AutoScroll FAB variant that scrolls the document (window) instead of an
 * inner element. Useful on pages that use the normal page scroll
 * (e.g. /downloads). Internally we hand AutoScrollFab a ref pointing at
 * `document.scrollingElement` (typically <html>), which honours scrollBy /
 * scrollTop just like any element.
 *
 * Guarded: if there's nothing scrollable on the page (list fits the viewport),
 * the FAB is hidden so it doesn't read as "dead" to the user.
 */
export default function WindowAutoScrollFab(
  props: Omit<React.ComponentProps<typeof AutoScrollFab>, "targetRef" | "iframeRef">
) {
  const ref = useRef<HTMLElement | null>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    ref.current = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      setScrollable(el.scrollHeight > window.innerHeight + 8);
    };
    check();
    window.addEventListener("resize", check);
    // Re-check as content loads (images/skeletons resolving). A
    // MutationObserver on document.body with subtree:true fired `check()` —
    // which reads scrollHeight and forces a synchronous layout — on every DOM
    // mutation app-wide. That is a jank loop while autoscroll is running and
    // PDF pages are mounting. A ResizeObserver on <html> reacts to exactly the
    // thing we care about (document height) and nothing else.
    const ro = new ResizeObserver(check);
    ro.observe(document.documentElement);
    const t = window.setInterval(check, 1500);
    return () => {
      window.removeEventListener("resize", check);
      ro.disconnect();
      window.clearInterval(t);
    };
  }, []);

  if (!scrollable) return null;
  return <AutoScrollFab targetRef={ref} {...props} />;
}
