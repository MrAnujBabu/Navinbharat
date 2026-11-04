-- Run against the migrated database. Checks create no payment or enrollment rows.
BEGIN;
DO $regression$
DECLARE fn regprocedure; rejected boolean;
BEGIN
 FOREACH fn IN ARRAY ARRAY['public.complete_paid_enrollment(uuid,bigint,text,text)'::regprocedure,'public.process_refund(text)'::regprocedure] LOOP
  IF has_function_privilege('anon',fn,'EXECUTE') THEN RAISE EXCEPTION 'Anonymous callers must not execute %',fn; END IF;
  IF has_function_privilege('authenticated',fn,'EXECUTE') THEN RAISE EXCEPTION 'Students must not execute %',fn; END IF;
  IF NOT has_function_privilege('service_role',fn,'EXECUTE') THEN RAISE EXCEPTION 'Payment service must execute %',fn; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 rejected:=false;
 BEGIN
  PERFORM public.complete_paid_enrollment('00000000-0000-0000-0000-000000000000',-1,'regression_missing_order','regression_missing_payment');
 EXCEPTION WHEN SQLSTATE 'P0002' THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Missing payment order must not grant course access'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
 rejected:=false;
 BEGIN
  PERFORM public.complete_paid_enrollment('00000000-0000-0000-0000-000000000000',-1,'regression_missing_order','regression_missing_payment');
 EXCEPTION WHEN SQLSTATE '42501' THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Student must not complete paid enrollment'; END IF;
END;
$regression$;
ROLLBACK;
