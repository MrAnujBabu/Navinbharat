# Fix recurring Notion error and audit Razorpay

## Confirmed diagnosis

- The shared Zoology page itself is healthy: the deployed `notion-page` function returns **200** for page `36a8ce…f2561` with a populated record map and attached PDF.
- The repeated **404** is for `1938ce…79849`, which the returned Notion data identifies as a **workspace/space ID**, not a public page ID.
- The attached PDF is served from `file.notion.so` and contains `spaceId=1938ce…79849` in its signed URL. The current `isNotion()` classifier treats every `*.notion.so` URL as a Notion page, so the attached PDF is routed back into `NotionPageRenderer`; the generic ID extractor then picks the workspace ID from the query string and calls the edge function with it. This explains the recurring 404 and error overlay.

## Implementation

1. **Correct Notion URL classification**
   - Treat Notion asset hosts such as `file.notion.so`, secure Notion file URLs, and signed attachment URLs as documents—not Notion pages.
   - Tighten page-ID extraction to page URL locations (`p` parameter or page slug/path), never arbitrary IDs such as `spaceId` or attachment block IDs.
   - Keep genuine `notion.site`, `www.notion.so`, and `www.notion.com` page links supported.

2. **Keep expected access failures local to the reader**
   - Do not emit the global PDF crash/error event for an expected `notion_not_public` response; show the existing inline fallback instead.
   - Preserve global error reporting for malformed responses, network failures, and genuine renderer failures.
   - Keep the existing document reader, back-button behavior, Office support, and visual layout untouched.

3. **Add focused regression coverage**
   - Prove the Zoology page URL is classified as a Notion page.
   - Prove its signed `file.notion.so` PDF URL is not classified as a Notion page and cannot yield the workspace ID as a page ID.
   - Prove unpublished root/subpage responses stay in the inline fallback without escalating to a blank-screen event.
   - Validate the public Zoology edge request remains 200 and the bad workspace-ID request is no longer made through the UI flow.

4. **Razorpay security and reliability audit**
   - Preserve the mandatory runtime split: web uses the JS checkout; native uses `capacitor-razorpay`.
   - Verify server-issued order IDs/prices, server-side HMAC verification, captured amount/status checks, order-user-course binding, webhook signature verification, replay/idempotency handling, recovery, and refund behavior.
   - Run the targeted enrollment-bypass, payment-race, Razorpay error/prefill, and edge-function tests.
   - Re-check live RLS and function grants after tests. Current evidence already confirms `complete_paid_enrollment` and `check_rate_limit` are not executable by `anon` or `authenticated`, payment rows are owner-read/admin-write only, and direct paid enrollment/forged payment tests exist.
   - Apply only any payment defect proven by the audit; do not redesign checkout or change pricing/business rules.

## Validation and audit report

- Exercise the exact attached-document flow from the supplied Zoology page in a mobile viewport and confirm no 404 request for `1938ce…79849`, no Lovable error overlay, and the PDF opens.
- Verify Notion root content, database tables, subpage navigation, Office attachments, download, and back navigation still work.
- Report the Razorpay result using the senior engineering/design audit categories, with evidence and an overall rating. Database scope will explicitly mark visual-only categories N/A; the payment UI will receive the visual/accessibility review.

## Technical scope

Expected files are limited to the shared Notion URL router/extractor, Notion renderer error handling, and focused tests. The `notion-page` backend will only change if validation proves an additional server-side guard is required. Razorpay code and Supabase policies will remain unchanged unless a reproducible security or reliability defect is found.