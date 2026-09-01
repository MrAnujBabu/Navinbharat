import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PLAYER_INFINITY_MASK_KEY = "player_infinity_mask_enabled";
export const PLAYER_LABEL_MASK_KEY = "player_label_mask_enabled";

export const PLAYER_BRANDING_KEYS = [
  PLAYER_INFINITY_MASK_KEY,
  PLAYER_LABEL_MASK_KEY,
] as const;

export type PlayerBrandingFlags = {
  /** Bottom-left badge that covers the YouTube "More videos" / infinity chip. */
  infinityMask: boolean;
  /** Bottom-right "Bharat" chip that covers the YouTube label watermark. */
  labelMask: boolean;
};

const isOn = (value: unknown) => String(value ?? "true").toLowerCase() !== "false";

/**
 * Admin-controlled visibility of the two player branding overlays.
 *
 * Default is ON (masks appear) — that is the shipped player look, and a read
 * failure must never uncover YouTube's own chips mid-lesson.
 */
export function usePlayerBranding(): PlayerBrandingFlags & { loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["site_settings", "player_branding"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlayerBrandingFlags> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key,value")
        .in("key", [...PLAYER_BRANDING_KEYS]);
      if (error) return { infinityMask: true, labelMask: true };
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      return {
        infinityMask: isOn(map.get(PLAYER_INFINITY_MASK_KEY)),
        labelMask: isOn(map.get(PLAYER_LABEL_MASK_KEY)),
      };
    },
  });

  return {
    infinityMask: data ? data.infinityMask : true,
    labelMask: data ? data.labelMask : true,
    loading: isLoading,
  };
}
