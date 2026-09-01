ALTER TYPE public.trusted_host_category ADD VALUE IF NOT EXISTS 'pdf';

GRANT ALL ON public.trusted_hosts TO service_role;