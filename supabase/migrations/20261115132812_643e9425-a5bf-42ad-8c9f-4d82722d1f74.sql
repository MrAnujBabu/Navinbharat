CREATE OR REPLACE FUNCTION public.get_quiz_rank(_attempt_id uuid)
RETURNS TABLE(rank integer, participants integer, percentile integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quiz_id uuid;
  _owner uuid;
  _my_best numeric;
BEGIN
  SELECT a.quiz_id, a.user_id INTO _quiz_id, _owner
    FROM public.quiz_attempts a
   WHERE a.id = _attempt_id AND a.submitted_at IS NOT NULL;

  IF _quiz_id IS NULL THEN
    RETURN;
  END IF;

  IF _owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH best AS (
    SELECT qa.user_id, MAX(COALESCE(qa.score, 0)) AS best_score
      FROM public.quiz_attempts qa
     WHERE qa.quiz_id = _quiz_id AND qa.submitted_at IS NOT NULL
     GROUP BY qa.user_id
  ), me AS (
    SELECT best_score FROM best WHERE user_id = _owner
  )
  SELECT
    (SELECT COUNT(*) FROM best, me WHERE best.best_score > me.best_score)::integer + 1,
    (SELECT COUNT(*) FROM best)::integer,
    ROUND(100.0 * (SELECT COUNT(*) FROM best, me WHERE best.best_score <= me.best_score)
          / GREATEST((SELECT COUNT(*) FROM best), 1))::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.get_quiz_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_rank(uuid) TO authenticated;