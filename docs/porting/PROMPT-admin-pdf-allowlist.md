# Port prompt — admin-managed external PDF/embed allowlist

Copy everything below the line into the other project's chat. It is written to be
self-contained: it describes the behaviour, the schema, the security model and the
acceptance checks, without referring to this repo's file names.

---

Build an **admin-managed allowlist for external document and embed sources**, so
that no external host can be loaded by the app unless an admin has approved it in
the admin panel. Requirements:

## 1. Database

Create a `trusted_hosts` table plus an enum for the category of use:

- Enum `trusted_host_category` with values: `frame`, `image`, `media`, `website`,
  `script`, `connect`, `pdf`.
  - `pdf` = an external host we are allowed to fetch PDF bytes from through our proxy.
  - `frame` = an external host we are allowed to put inside an `<iframe>`.
- Table `public.trusted_hosts`:
  - `id` uuid primary key default `gen_random_uuid()`
  - `host` text not null — bare hostname, no scheme, no path (e.g. `ncert.nic.in`)
  - `category` `trusted_host_category` not null
  - `label` text — human note shown in the admin UI
  - `enabled` boolean not null default true
  - `created_at` / `updated_at` timestamptz not null default `now()`, with an
    `updated_at` trigger
  - unique constraint on `(host, category)` so upserts are idempotent

Grants and RLS, in this exact order (create table → grant → enable RLS → policies):

```sql
GRANT SELECT ON public.trusted_hosts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_hosts TO authenticated; -- admin-only via policy
GRANT ALL ON public.trusted_hosts TO service_role;   -- the proxy reads it with the service key
ALTER TABLE public.trusted_hosts ENABLE ROW LEVEL SECURITY;
```

Policies:
- read: any signed-in user may read `enabled = true` rows (the client needs them to
  decide whether to render an embed).
- write (insert/update/delete): admins only, via a `has_role(auth.uid(), 'admin')`
  security-definer function. Roles must live in a separate `user_roles` table — never
  a `role` column on `profiles`.

Seed a couple of known-good hosts so the feature is usable immediately, e.g.
`ncert.nic.in` (`pdf`) and `docs.google.com` (`frame`).

Note: a newly added enum value cannot be used in the same transaction that adds it.
Ship `ALTER TYPE ... ADD VALUE` as one migration and the seed insert as a separate
statement/migration.

## 2. Admin page

Add an admin-only page (e.g. `/admin/trusted-hosts`) that:
- lists rows grouped by category, with host, label, enabled toggle;
- lets an admin add a host (validate: hostname only — strip scheme/path/port, lowercase,
  reject wildcards and bare IPs), edit the label, toggle `enabled`, and delete;
- shows an empty state and inline validation errors, not raw Postgres errors;
- is reachable only through the admin role guard, and hidden from non-admin nav.

## 3. Proxy edge function

Add a server-side `pdf-proxy` (or `doc-proxy`) edge function that is the ONLY way the
client fetches an external document:

- Request: `GET /pdf-proxy?url=<absolute https url>` with the caller's JWT in
  `Authorization`.
- Validate the JWT and reject anonymous callers.
- Parse the URL; reject anything that is not `https:`, and reject hosts that resolve to
  private/loopback ranges (SSRF guard).
- Look up the hostname in `trusted_hosts` with a **service-role client** (RLS bypassed,
  because the allowlist must be readable even for hosts the user can't see) and accept
  it only if an `enabled` row exists in category `pdf` **or** `frame`.
- Cache the allowlist in module scope for ~60s so a hot lesson page does not hit the
  database per request; refresh on expiry.
- Stream the upstream response back with `Content-Type: application/pdf`, a length
  cap, and a fetch timeout. Reject non-PDF content types instead of forwarding HTML
  error pages (an HTML body reaching a PDF renderer surfaces as `InvalidPDFException`).
- Include shared CORS headers on **every** response including errors, and handle
  `OPTIONS`.
- On rejection return a structured JSON error (`{ error, code }`) with the right status:
  `401` unauthenticated, `403` host not allowlisted, `400` bad URL, `502` upstream failed.

## 4. Client wiring

- Every external PDF/iframe URL in the app goes through the proxy or is checked against
  the allowlist before rendering; never render an arbitrary user- or content-supplied
  host directly.
- If a host is not allowlisted, show an actionable message ("This source isn't approved
  yet — ask an admin to add it") rather than a broken viewer.

## 5. Acceptance checks

1. An admin can add a host in the UI and the very next document load from that host
   succeeds (within the cache TTL).
2. Disabling the row makes the same document fail with `403` and the friendly message.
3. A non-admin cannot insert/update/delete rows (RLS denies it) but can read enabled rows.
4. The proxy rejects `http://`, private IPs, and non-PDF content types.
5. No external host is fetchable without a matching enabled row.
