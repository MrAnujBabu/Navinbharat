// Notion public-page proxy. Fetches recordMap for a public Notion page so we
// can render it in-app via react-notion-x. Returns JSON only (small payload,
// ~30-80 KB per page), unlike pdf-proxy which streams binary.
//
// Why server-side: notion.so/api/v3 does not allow cross-origin requests from
// arbitrary browsers. A 1-shot JSON proxy is the lightest possible bridge.
//
// Endpoint: GET /notion-page?id=<pageId-with-or-without-hyphens>
import { NotionAPI } from "npm:notion-client@7.1.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PAGE_ID_RE = /^[0-9a-f]{32}$/i;

/** Normalise a page id: strip hyphens, lowercase. */
function normalizeId(raw: string): string | null {
  const stripped = raw.replace(/-/g, "").toLowerCase();
  if (!PAGE_ID_RE.test(stripped)) return null;
  // Notion expects hyphenated UUID form
  return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
}

const notion = new NotionAPI();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawId = url.searchParams.get("id");
    if (!rawId) {
      return new Response(JSON.stringify({ error: "missing id param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pageId = normalizeId(rawId);
    if (!pageId) {
      return new Response(JSON.stringify({ error: "invalid page id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recordMap = await notion.getPage(pageId);

    return new Response(JSON.stringify({ recordMap }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Edge cache: Notion pages change rarely; 5 min is safe.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
