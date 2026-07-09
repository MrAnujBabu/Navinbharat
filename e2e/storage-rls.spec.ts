/**
 * Storage bucket RLS regression — H4.
 *
 * Guards the `{user_id}/…` folder-ownership convention across every private
 * bucket that relies on it in its INSERT policy. Complements
 * `receipts-rls.spec.ts` (which covers the `receipts` bucket).
 *
 * A misnamed path (`someOtherUser/…` or a bare filename with no folder)
 * MUST be rejected by RLS, otherwise a signed-in user can plant files
 * in another user's namespace.
 *
 * Requires env: E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY,
 *               E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD.
 * Skipped locally when any are missing.
 */
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.E2E_TEST_USER_EMAIL;
const PASSWORD = process.env.E2E_TEST_USER_PASSWORD;

// Buckets whose INSERT policy is expected to require
// `(storage.foldername(name))[1] = auth.uid()::text`.
// Excludes buckets scoped to admin/teacher writes only
// (lesson-attachments, course-materials, lecture-pdfs, course-videos, content).
const OWNER_SCOPED_BUCKETS = ["student-notes", "chat-attachments"] as const;

const OTHER_UID = "00000000-0000-0000-0000-000000000001";

const pngBlob = () =>
  new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

async function signIn(): Promise<{ supabase: SupabaseClient; uid: string }> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL!,
    password: PASSWORD!,
  });
  expect(error, `sign-in failed: ${error?.message}`).toBeNull();
  const uid = data.user!.id;
  expect(uid).not.toBe(OTHER_UID);
  return { supabase, uid };
}

function assertRlsRejected(error: { message?: string; status?: number } | null) {
  const message = (error?.message ?? "").toLowerCase();
  const status = error?.status;
  expect(error, "RLS must reject the upload").not.toBeNull();
  expect(
    status === 400 ||
      status === 401 ||
      status === 403 ||
      message.includes("row-level security") ||
      message.includes("unauthorized") ||
      message.includes("policy") ||
      message.includes("not allowed"),
    `unexpected error shape: status=${status} message=${error?.message}`,
  ).toBe(true);
}

test.describe("storage: private bucket folder ownership", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL || !PASSWORD,
    "Set E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD to run.",
  );

  for (const bucket of OWNER_SCOPED_BUCKETS) {
    test(`${bucket}: rejects upload into another user's folder`, async () => {
      const { supabase } = await signIn();
      const path = `${OTHER_UID}/e2e-${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, pngBlob(), { contentType: "image/png", upsert: false });
      expect(data, `cross-folder upload into ${bucket} should be rejected`).toBeNull();
      assertRlsRejected(error as { message?: string; status?: number } | null);
      await supabase.auth.signOut();
    });

    test(`${bucket}: rejects upload with no user folder prefix`, async () => {
      const { supabase } = await signIn();
      // No folder → foldername(name)[1] is NULL and cannot equal auth.uid()::text.
      const path = `e2e-noprefix-${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, pngBlob(), { contentType: "image/png", upsert: false });
      expect(data, `bare-path upload into ${bucket} should be rejected`).toBeNull();
      assertRlsRejected(error as { message?: string; status?: number } | null);
      await supabase.auth.signOut();
    });

    test(`${bucket}: allows upload into caller's own folder`, async () => {
      const { supabase, uid } = await signIn();
      const path = `${uid}/e2e-${Date.now()}.png`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, pngBlob(), { contentType: "image/png", upsert: true });
      expect(error, `own-folder upload into ${bucket} should succeed: ${error?.message}`).toBeNull();
      await supabase.storage.from(bucket).remove([path]);
      await supabase.auth.signOut();
    });
  }
});
