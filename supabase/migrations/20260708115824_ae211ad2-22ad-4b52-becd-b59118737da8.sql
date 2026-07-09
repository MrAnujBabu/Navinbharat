
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
      SELECT to_jsonb(c) - 'created_at'
      FROM (
        SELECT id, title, grade, description, image_url, thumbnail_url
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
