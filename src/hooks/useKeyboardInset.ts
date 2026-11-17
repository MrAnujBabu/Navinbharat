import { useEffect, useState } from "react";

/**
 * Height (px) currently covered by the on-screen keyboard.
 *
 * Mobile browsers shrink `visualViewport` when the soft keyboard opens but keep
 * the layout viewport (and therefore anything anchored to `bottom: 0`) behind
 * it. Bottom sheets that host a text field must be lifted by this amount or the
 * writing surface ends up hidden under the keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Android emits a stream of intermediate viewport values while the
    // keyboard animates. Commit at most one measurement per painted frame so
    // the sheet cannot oscillate between heights (the visible "blink").
    let frame: number | null = null;
    const sync = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const covered = window.innerHeight - vv.height - vv.offsetTop;
        const next = covered > 80 ? Math.round(covered) : 0;
        setInset((current) => (current === next ? current : next));
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return inset;
}

export default useKeyboardInset;
