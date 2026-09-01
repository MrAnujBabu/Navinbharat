import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  PLAYER_BRANDING_KEYS,
  PLAYER_INFINITY_MASK_KEY,
  PLAYER_LABEL_MASK_KEY,
} from "@/hooks/usePlayerBranding";

const isOn = (value: unknown) => String(value ?? "true").toLowerCase() !== "false";

type Flags = { infinity: boolean; label: boolean };

/**
 * Admin toggles for the video player's two branding overlays.
 * Both ship ON (Appear); switching one off reveals YouTube's own chip there.
 */
export default function PlayerBrandingSettings() {
  const [flags, setFlags] = useState<Flags>({ infinity: true, label: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key,value")
        .in("key", [...PLAYER_BRANDING_KEYS]);
      if (cancelled) return;
      const map = new Map((data ?? []).map((r) => [r.key, r.value]));
      setFlags({
        infinity: isOn(map.get(PLAYER_INFINITY_MASK_KEY)),
        label: isOn(map.get(PLAYER_LABEL_MASK_KEY)),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (key: string, field: keyof Flags, next: boolean, label: string) => {
    setSaving(key);
    setFlags((f) => ({ ...f, [field]: next }));
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: next ? "true" : "false" }, { onConflict: "key" });
    setSaving(null);
    if (error) {
      setFlags((f) => ({ ...f, [field]: !next }));
      toast.error(error.message || "Could not save setting");
      return;
    }
    qc.invalidateQueries({ queryKey: ["site_settings", "player_branding"] });
    toast.success(`${label} ${next ? "will appear" : "is hidden"}`);
  };

  const rows: { id: string; key: string; field: keyof Flags; title: string; hint: string }[] = [
    {
      id: "player-infinity-mask",
      key: PLAYER_INFINITY_MASK_KEY,
      field: "infinity",
      title: "Infinity logo badge (bottom-left)",
      hint: "Covers YouTube's \u201cMore videos\u201d / infinity chip.",
    },
    {
      id: "player-label-mask",
      key: PLAYER_LABEL_MASK_KEY,
      field: "label",
      title: "YouTube label mask (bottom-right)",
      hint: "The \u201cBharat\u201d chip that covers YouTube's white label watermark.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Player Branding</CardTitle>
        <CardDescription>
          On = the branding overlay appears. Off = it is hidden and YouTube's own chip shows through.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor={row.id} className="text-sm font-medium">{row.title}</Label>
              <p className="text-xs text-muted-foreground">{row.hint}</p>
            </div>
            <Switch
              id={row.id}
              checked={flags[row.field]}
              disabled={loading || saving === row.key}
              onCheckedChange={(v) => void save(row.key, row.field, v, row.title)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
