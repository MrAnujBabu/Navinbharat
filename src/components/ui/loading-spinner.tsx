import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  fullPage?: boolean;
}

const sizeMap = {
  sm: "h-6 w-6 border-[2px]",
  md: "h-9 w-9 border-[2.5px]",
  lg: "h-14 w-14 border-[3px]",
};

/**
 * Professional, minimal thin-ring spinner.
 * Single CSS keyframe (`animate-spin`), no SVG, no brand-mark cross-fade —
 * matches the platform-native loader users expect (Material / iOS style).
 * Respects `prefers-reduced-motion` automatically because `animate-spin`
 * is paused by Tailwind's reduced-motion variant when the user requests it.
 */
export const LoadingSpinner = ({ size = "md", className, text, fullPage = false }: LoadingSpinnerProps) => {
  const spinner = (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className={cn(
          "inline-block rounded-full border-muted-foreground/20 border-t-primary animate-spin motion-reduce:animate-none",
          sizeMap[size]
        )}
      />
      {text ? (
        <p className="text-sm text-muted-foreground">{text}</p>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
