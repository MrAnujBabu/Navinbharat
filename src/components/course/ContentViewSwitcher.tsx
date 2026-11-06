import { List, LayoutGrid, Table2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type ViewMode = "list" | "gallery" | "table";

interface ContentViewSwitcherProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /**
   * Optional subset of modes to render, in order. Defaults to all three.
   * My Courses passes ["gallery", "list"] to keep the control strip narrow
   * on mobile (the table view stays available on the desktop listing pages).
   */
  modes?: ViewMode[];
}

const views: { id: ViewMode; icon: typeof List; label: string }[] = [
  { id: "list", icon: List, label: "List" },
  { id: "gallery", icon: LayoutGrid, label: "Gallery" },
  { id: "table", icon: Table2, label: "Table" },
];

export const ContentViewSwitcher = ({ activeView, onViewChange, modes }: ContentViewSwitcherProps) => {
  const shown = modes ? views.filter((v) => modes.includes(v.id)).sort(
    (a, b) => modes.indexOf(a.id) - modes.indexOf(b.id),
  ) : views;
  return (
    // nb-tap-exempt: the global 44px mobile touch floor made each button
    // taller than the toolbar strip, so the active pill touched the header.
    // Buttons get an explicit 36px (mobile) / 28px (desktop) size instead.
    <div className="nb-tap-exempt flex items-center gap-1 bg-muted/50 rounded-lg p-1">
      {shown.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onViewChange(id)}
          title={label}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 md:h-7 md:w-7",
            activeView === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
};
