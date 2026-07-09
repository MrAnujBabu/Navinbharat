
-- Revoke EXECUTE on trigger, admin-only, and internal SECURITY DEFINER functions
-- from PUBLIC/anon/authenticated. Keep service_role and superuser access intact.

-- Trigger functions (never called directly by clients)
REVOKE ALL ON FUNCTION public.update_lesson_like_count()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_hero_banners_updated_at()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_role_escalation()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_knowledge_base_updated_at()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_user_preferences_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_student_notes_updated_at()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_books_updated_at()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_doubt_sessions_updated_at()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_leads_access()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_enrollment_status_tampering() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role()              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_lesson_pdfs_updated_at()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_payment_request_actor()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_payment_request_amount()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_lead_insert()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_user_name_from_profile()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_submitted_quiz_attempt()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sanitize_quiz_attempt_insert()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_message_recipient_readonly() FROM PUBLIC, anon, authenticated;

-- Admin-only / service-only functions
REVOKE ALL ON FUNCTION public.get_user_profiles_admin()           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_security_policies()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_refund(text)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_paid_enrollment(uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_platform_stats()                FROM PUBLIC, anon;

-- Internal helpers (called by edge functions with service role, or by other DB functions)
REVOKE ALL ON FUNCTION public.check_rate_limit(text, uuid, integer, integer)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_rate_limit_text(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_role(uuid)                 FROM PUBLIC, anon;

-- Ensure client-callable helpers keep the access signed-in users need
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_snapshot()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_bundle(bigint)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_lesson_stats()        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_lectures(text, integer)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_book_clicks(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge(extensions.vector, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_enrollment_for_attendance(bigint, uuid) TO authenticated;
