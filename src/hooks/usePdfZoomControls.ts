import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PDF_ZOOM_CONTROLS_KEY = "pdf_zoom_controls_enabled";

/**
 * Admin-controlled flag: should the reader show on-screen zoom controls?
 *
 * Default is OFF — zoom is a finger-only gesture (pinch / double-tap) unless an
 * admin explicitly enables the floating control. Any read failure also resolves
 * to OFF so a network hiccup never surfaces the controls unexpectedly.
 */
export function usePdfZoomControls() {
  const { data, isLoading } = useQuery({
    queryKey: ["site_settings", PDF_ZOOM_CONTROLS_KEY],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", PDF_ZOOM_CONTROLS_KEY)
        .maybeSingle();
      if (error) return false;
      return String(data?.value ?? "false").toLowerCase() === "true";
    },
  });

  return { enabled: data === true, loading: isLoading };
}
