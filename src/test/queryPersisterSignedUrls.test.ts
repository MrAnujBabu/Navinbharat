import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const prefs = new Map<string, string>();
vi.mock("@/lib/native/core", () => ({
  loadCore: async () => ({ Capacitor: { isNativePlatform: () => true } }),
}));
vi.mock("@/lib/native/preferences", () => ({
  loadPreferences: async () => ({
    plugin: {
      get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value); },
    },
  }),
}));

import { hasExpiredSignedUrl, hydrateQueryCache } from "@/lib/perf/queryPersister";

const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const signedUrl = (expSeconds: number) =>
  `https://x.supabase.co/storage/v1/object/sign/content/thumbnails/c.png?token=${b64url({ alg: "HS256" })}.${b64url({ exp: expSeconds })}.sig`;

const NOW = 1_800_000_000_000;

describe("signed course image links in the saved cache", () => {
  beforeEach(() => prefs.clear());

  it("flags a signed link that expired", () => {
    expect(hasExpiredSignedUrl([{ image_url: signedUrl(NOW / 1000 - 60) }], NOW)).toBe(true);
  });

  it("keeps a signed link valid for another hour", () => {
    expect(hasExpiredSignedUrl([{ image_url: signedUrl(NOW / 1000 + 3600) }], NOW)).toBe(false);
  });

  it("does not hydrate a courses catalog whose image links expired", async () => {
    const savedAt = Date.now() - 2 * 60 * 60 * 1000; // saved 2h ago
    const expired = signedUrl(Math.floor((savedAt + 60 * 60 * 1000) / 1000)); // 1h TTL
    prefs.set("nb_query_cache_v2", JSON.stringify({
      v: 2,
      queries: [{ key: ["courses-catalog"], data: [{ id: 1, image_url: expired }], dataUpdatedAt: savedAt }],
    }));
    const client = new QueryClient();
    await hydrateQueryCache(client);
    expect(client.getQueryData(["courses-catalog"])).toBeUndefined();
  });

  it("hydrated data keeps its original age so it refetches", async () => {
    const savedAt = Date.now() - 30 * 60 * 1000; // 30 min ago
    prefs.set("nb_query_cache_v2", JSON.stringify({
      v: 2,
      queries: [{ key: ["courses-catalog"], data: [{ id: 1 }], dataUpdatedAt: savedAt }],
    }));
    const client = new QueryClient();
    await hydrateQueryCache(client);
    expect(client.getQueryState(["courses-catalog"])?.dataUpdatedAt).toBe(savedAt);
  });
});
