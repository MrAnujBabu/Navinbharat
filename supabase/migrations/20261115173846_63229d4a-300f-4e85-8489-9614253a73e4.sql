CREATE OR REPLACE FUNCTION public.get_message_contacts()
RETURNS TABLE(id uuid, full_name text, avatar_url text, is_staff boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid,
           (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role)) AS staff
  ),
  staff_ids AS (
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin'::app_role, 'teacher'::app_role)
  ),
  talked AS (
    SELECT CASE WHEN m.sender_id = (SELECT uid FROM me) THEN m.recipient_id ELSE m.sender_id END AS other
      FROM public.messages m
     WHERE m.sender_id = (SELECT uid FROM me) OR m.recipient_id = (SELECT uid FROM me)
  )
  SELECT p.id, p.full_name, p.avatar_url, (p.id IN (SELECT user_id FROM staff_ids)) AS is_staff
    FROM public.profiles p, me
   WHERE me.uid IS NOT NULL
     AND p.id <> me.uid
     AND (
       me.staff
       OR p.id IN (SELECT user_id FROM staff_ids)
       OR p.id IN (SELECT other FROM talked)
     )
$$;

REVOKE ALL ON FUNCTION public.get_message_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_contacts() TO authenticated;