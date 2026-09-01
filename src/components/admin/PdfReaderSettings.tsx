import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PDF_ZOOM_CONTROLS_KEY } from "@/hooks/usePdfZoomControls";

/**
 * Admin toggle for the PDF reader's on-screen zoom control.
 * Ships OFF: readers zoom with fingers only, and never below 100%.
 */
export default function PdfReaderSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", PDF_ZOOM_CONTROLS_KEY)
        .maybeSingle();
      if (!cancelled) {
        setEnabled(String(data?.value ?? "false").toLowerCase() === "true");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (next: boolean) => {
    setSaving(true);
    setEnabled(next);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: PDF_ZOOM_CONTROLS_KEY, value: next ? "true" : "false" }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      setEnabled(!next);
      toast.error(error.message || "Could not save setting");
      return;
    }
    qc.invalidateQueries({ queryKey: ["site_settings", PDF_ZOOM_CONTROLS_KEY] });
    toast.success(next ? "Zoom buttons enabled" : "Zoom buttons disabled");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">PDF Reader</CardTitle>
        <CardDescription>
          Reader zoom starts at 100% and never goes below it. Pinch and double-tap always work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="pdf-zoom-controls" className="text-sm font-medium">
              Show on-screen zoom buttons
            </Label>
            <p className="text-xs text-muted-foreground">
              Off by default — students zoom with fingers only.
            </p>
          </div>
          <Switch
            id="pdf-zoom-controls"
            checked={enabled}
            disabled={loading || saving}
            onCheckedChange={(v) => void save(v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
