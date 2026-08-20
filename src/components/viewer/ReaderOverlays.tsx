import AutoScrollFab from "./AutoScrollFab";
import PageIndicatorPill from "./PageIndicatorPill";

interface Props {
  /** Same-origin scroller (canvas reader). */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** pdf.js iframe surface. */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /** Vertical offset above the bottom edge for the FAB (px). */
  bottomOffset?: number;
  onActiveChange?: (active: boolean) => void;
  visible?: boolean;
  docKey?: string;
}

/**
 * Single mount point for the reader overlays (autoscroll FAB + Drive-style
 * page pill). Every reader surface must render this instead of wiring the two
 * components up by hand — that duplication is why the pill went missing on the
 * main reader once before.
 */
export default function ReaderOverlays({
  targetRef,
  iframeRef,
  bottomOffset,
  onActiveChange,
  visible,
  docKey,
}: Props): JSX.Element {
  return (
    <>
      <AutoScrollFab
        targetRef={targetRef}
        iframeRef={iframeRef}
        bottomOffset={bottomOffset}
        onActiveChange={onActiveChange}
        visible={visible}
        docKey={docKey}
      />
      <PageIndicatorPill targetRef={targetRef} iframeRef={iframeRef} />
    </>
  );
}
