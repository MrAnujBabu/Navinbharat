import { Minus } from "lucide-react";
import { tapHaptic } from "../../../lib/native/haptics";
import { MIN_ZOOM } from "../../../lib/pdfZoom";

interface Props {
  zoom: number;
  visible: boolean;
  onZoomBy: (factor: number) => void;
  onFitWidth: () => void;
  /** Long-press the percentage: fit the whole page (landscape slides). */
  onFitPage?: () => void;
}

/**
 * Floating one-handed zoom control for the reader — admin-gated, off by default.
 *
 * Zoom in is a finger gesture only (pinch / double-tap), so there is no plus
 * button. Minus steps back toward 100%, which is the hard floor; tapping the
 * percentage resets straight to fit-width.
 */
export default function ReaderZoomControls({ zoom, visible, onZoomBy, onFitWidth, onFitPage }: Props) {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressed = false;
  const atFloor = zoom <= MIN_ZOOM + 0.005;
  return (
    <div
      className={`fixed left-1/2 z-40 -translate-x-1/2 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 rounded-full border bg-card/95 px-1 py-1 shadow-lg backdrop-blur">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={atFloor}
          onClick={() => { void tapHaptic("light"); onZoomBy(1 / 1.25); }}
          className="flex h-11 w-11 items-center justify-center rounded-full text-foreground active:scale-[0.94] disabled:opacity-40"
        >
          <Minus className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={`Zoom ${Math.round(zoom * 100)} percent — tap to fit width, long-press to fit whole page`}
          onPointerDown={() => {
            longPressed = false;
            if (!onFitPage) return;
            pressTimer = setTimeout(() => { longPressed = true; void tapHaptic("heavy"); onFitPage(); }, 450);
          }}
          onPointerUp={() => { if (pressTimer) clearTimeout(pressTimer); }}
          onPointerLeave={() => { if (pressTimer) clearTimeout(pressTimer); }}
          onClick={() => { if (longPressed) { longPressed = false; return; } void tapHaptic("light"); onFitWidth(); }}
          className="min-w-[56px] rounded-full px-2 py-2 text-sm font-semibold tabular-nums text-foreground active:scale-[0.94]"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>
    </div>
  );
}

