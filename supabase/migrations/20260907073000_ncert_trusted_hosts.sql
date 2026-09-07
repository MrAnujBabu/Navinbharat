-- Surface the NCERT textbook hosts in the admin-managed allowlist so staff can
-- see (and disable) them alongside the hard-coded pdf-proxy baseline.
INSERT INTO public.trusted_hosts (host, category, label, notes) VALUES
  ('ncert.nic.in', 'pdf', 'NCERT textbooks', 'Chapter PDFs at /textbook/pdf/<code><nn>.pdf'),
  ('ncert.org.in', 'pdf', 'NCERT (alt domain)', 'NCERT-hosted PDF mirrors'),
  ('ncert.nic.in', 'website', 'NCERT', 'Textbook chapter listing pages')
ON CONFLICT (host, category) DO NOTHING;
