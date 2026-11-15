-- Applied to production 2026-11-15.
-- Only admins (or trusted server code) may change an account's block status.
-- Previously any signed-in user could clear their own block via a profile update.
CREATE OR REPLACE FUNCTION public.protect_profile_block_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
      OR NEW.blocked_reason IS DISTINCT FROM OLD.blocked_reason)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change account block status' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_profile_block_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_block_fields ON public.profiles;
CREATE TRIGGER protect_profile_block_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_block_fields();

-- Admins cannot block their own account (prevents accidental lock-out).
CREATE OR REPLACE FUNCTION public.admin_set_user_block(_user_id uuid, _blocked boolean, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _blocked AND _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot block your own account'; END IF;
  UPDATE public.profiles SET is_blocked = _blocked, blocked_reason = CASE WHEN _blocked THEN _reason ELSE NULL END WHERE id = _user_id;
  INSERT INTO public.audit_log (user_id, action, table_name, record_count, metadata)
  VALUES (auth.uid(), CASE WHEN _blocked THEN 'block_user' ELSE 'unblock_user' END, 'profiles', 1, jsonb_build_object('target', _user_id, 'reason', _reason));
END; $function$;
