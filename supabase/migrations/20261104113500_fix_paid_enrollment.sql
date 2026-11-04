-- Payment-only fix: SECURITY DEFINER changes current_user to the owner.
-- Authorize the trusted caller's JWT role, not the function owner's role.
DO $migration$
DECLARE fn record; definition text;
BEGIN
 FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('complete_paid_enrollment','process_refund') LOOP
  definition := pg_get_functiondef(fn.oid);
  definition := replace(definition, 'IF current_user <> ''service_role'' AND NOT public.has_role(auth.uid(), ''admin''::app_role) THEN', 'IF auth.role() IS DISTINCT FROM ''service_role'' AND NOT COALESCE(public.has_role(auth.uid(), ''admin''::app_role), false) THEN');
  definition := replace(definition, 'DECLARE _payment_id bigint; _enrollment_id bigint;', 'DECLARE _payment_id public.razorpay_payments.id%TYPE; _enrollment_id bigint;');
  EXECUTE definition;
 END LOOP;
END;
$migration$;
REVOKE ALL ON FUNCTION public.complete_paid_enrollment(uuid,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_paid_enrollment(uuid,bigint,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.process_refund(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund(text) TO service_role;
