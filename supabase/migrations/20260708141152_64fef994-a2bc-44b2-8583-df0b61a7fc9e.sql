
CREATE OR REPLACE FUNCTION public.get_course_bundle(_course_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _is_priv boolean;
  _result jsonb;
BEGIN
  _is_priv := (
    _uid IS NOT NULL AND (
      public.has_role(_uid, 'admin'::app_role)
      OR public.has_role(_uid, 'teacher'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE user_id = _uid AND course_id = _course_id AND status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = _course_id AND (c.price IS NULL OR c.price = 0)
      )
    )
  );

  SELECT jsonb_build_object(
    'course', (
      SELECT to_jsonb(c)
      FROM (
        SELECT id, title, grade, description, image_url, thumbnail_url,
               teacher_name, teacher_title, teacher_bio, teacher_avatar_url, teacher_verified
        FROM public.courses WHERE id = _course_id
      ) c
    ),
    'chapters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ch.id, 'code', ch.code, 'title', ch.title,
        'parent_id', ch.parent_id, 'position', ch.position,
        'thumbnail_url', ch.thumbnail_url
      ) ORDER BY ch.position ASC NULLS LAST)
      FROM public.chapters ch
      WHERE ch.course_id = _course_id
    ), '[]'::jsonb),
    'lessons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'is_locked', l.is_locked,
        'description', l.description,
        'overview', l.overview,
        'course_id', l.course_id,
        'chapter_id', l.chapter_id,
        'created_at', l.created_at,
        'like_count', l.like_count,
        'position', l.position,
        'lecture_type', l.lecture_type,
        'thumbnail_url', l.thumbnail_url,
        'youtube_id', l.youtube_id,
        'duration', l.duration,
        'video_url', CASE WHEN _is_priv THEN l.video_url ELSE NULL END,
        'class_pdf_url', CASE WHEN _is_priv THEN l.class_pdf_url ELSE NULL END,
        'transcript_md', CASE WHEN _is_priv THEN l.transcript_md ELSE NULL END
      ) ORDER BY l.position ASC NULLS LAST, l.created_at ASC NULLS LAST)
      FROM public.lessons l
      WHERE l.course_id = _course_id
    ), '[]'::jsonb),
    'is_enrolled', _is_priv
  ) INTO _result;

  RETURN _result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  WITH my_enrollments AS (
    SELECT e.id, e.course_id, e.status, e.progress_percentage,
           e.purchased_at, e.last_watched_lesson_id,
           c.title, c.description, c.grade, c.image_url, c.thumbnail_url,
           c.price, c.start_date, c.end_date
    FROM public.enrollments e
    LEFT JOIN public.courses c ON c.id = e.course_id
    WHERE e.user_id = _uid AND e.status = 'active'
  ),
  course_lessons AS (
    SELECT l.id, l.course_id
    FROM public.lessons l
    WHERE l.course_id IN (SELECT course_id FROM my_enrollments WHERE course_id IS NOT NULL)
  ),
  my_progress AS (
    SELECT lesson_id, course_id, completed
    FROM public.user_progress
    WHERE user_id = _uid
  )
  SELECT jsonb_build_object(
    'enrollments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', me.id,
        'course_id', me.course_id,
        'status', me.status,
        'progress_percentage', me.progress_percentage,
        'purchased_at', me.purchased_at,
        'last_watched_lesson_id', me.last_watched_lesson_id,
        'course', jsonb_build_object(
          'id', me.course_id,
          'title', me.title,
          'description', me.description,
          'grade', me.grade,
          'image_url', me.image_url,
          'thumbnail_url', me.thumbnail_url,
          'price', me.price,
          'start_date', me.start_date,
          'end_date', me.end_date
        )
      ) ORDER BY me.purchased_at DESC NULLS LAST)
      FROM my_enrollments me
    ), '[]'::jsonb),
    'course_lessons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', cl.id, 'course_id', cl.course_id))
      FROM course_lessons cl
    ), '[]'::jsonb),
    'user_progress', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'lesson_id', mp.lesson_id,
        'course_id', mp.course_id,
        'completed', mp.completed
      ))
      FROM my_progress mp
    ), '[]'::jsonb),
    'lesson_progress_count', (SELECT count(*) FROM public.lesson_progress WHERE user_id = _uid),
    'lessons_completed', (SELECT count(*) FROM public.lesson_progress WHERE user_id = _uid AND completed = true),
    'quiz_stats', (
      SELECT jsonb_build_object(
        'attempts', count(*),
        'passed', count(*) FILTER (WHERE passed = true),
        'avg_percentage', COALESCE(round(avg(percentage)::numeric, 2), 0)
      )
      FROM public.quiz_attempts
      WHERE user_id = _uid AND submitted_at IS NOT NULL
    ),
    'recent_quiz_attempts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', qa.id,
        'quiz_id', qa.quiz_id,
        'score', qa.score,
        'percentage', qa.percentage,
        'passed', qa.passed,
        'submitted_at', qa.submitted_at,
        'created_at', qa.created_at,
        'quizzes', CASE WHEN qz.id IS NULL THEN NULL ELSE
          jsonb_build_object('title', qz.title, 'type', qz.type, 'total_marks', qz.total_marks)
        END
      ) ORDER BY qa.created_at DESC)
      FROM (
        SELECT * FROM public.quiz_attempts
        WHERE user_id = _uid AND submitted_at IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      ) qa
      LEFT JOIN public.quizzes qz ON qz.id = qa.quiz_id
    ), '[]'::jsonb),
    'upcoming_doubts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ds.id,
        'subject', ds.subject,
        'scheduled_at', ds.scheduled_at,
        'zoom_join_url', ds.zoom_join_url,
        'status', ds.status
      ) ORDER BY ds.scheduled_at ASC)
      FROM (
        SELECT id, subject, scheduled_at, zoom_join_url, status
        FROM public.doubt_sessions
        WHERE student_id = _uid AND status IN ('scheduled', 'active')
        ORDER BY scheduled_at ASC
        LIMIT 3
      ) ds
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$function$;
