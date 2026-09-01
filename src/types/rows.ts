/**
 * Shared row shapes for Supabase query results.
 *
 * Queries select column subsets and sometimes embed related tables, so these
 * types keep the frequently-read columns strongly typed while allowing extra
 * selected columns through an index signature. They replace the `any`
 * annotations that used to sit on `.map()` / `.filter()` / `.forEach()`
 * callbacks.
 */

type Extra = { [key: string]: unknown };

export type CourseRow = Extra & {
  id?: number;
  title?: string;
  description?: string | null;
  grade?: string | null;
  price?: number | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  is_published?: boolean | null;
  lesson_count?: number | null;
};

export type ChapterRow = Extra & {
  id?: string;
  title?: string;
  code?: string | null;
  course_id?: number | null;
  parent_id?: string | null;
  position?: number | null;
  description?: string | null;
  thumbnail_url?: string | null;
};

export type LessonRow = Extra & {
  id?: string;
  title?: string;
  course_id?: number | null;
  chapter_id?: string | null;
  lecture_type?: string | null;
  position?: number | null;
  duration?: number | null;
  is_locked?: boolean | null;
  video_url?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
  courses?: CourseRow | null;
  chapters?: ChapterRow | null;
  youtube_id?: string | null;
  description?: string | null;
  class_pdf_url?: string | null;
  quiz_id?: string | null;
  category?: string | null;
  overview?: string | null;
  thumbnail_url?: string | null;
};

export type EnrollmentRow = Extra & {
  id?: string | number;
  user_id?: string;
  course_id?: number;
  status?: string | null;
  progress_percentage?: number | null;
  created_at?: string | null;
  courses?: CourseRow | null;
  course?: CourseRow | null;
};

export type ProfileRow = Extra & {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  mobile?: string | null;
  avatar_url?: string | null;
  is_blocked?: boolean | null;
  blocked_reason?: string | null;
  created_at?: string | null;
};

export type ProgressRow = Extra & {
  lesson_id?: string;
  user_id?: string;
  completed?: boolean | null;
  watch_seconds?: number | null;
};

export type QuizRow = Extra & {
  id?: string;
  title?: string | null;
  lesson_id?: string | null;
  course_id?: number | null;
  total_marks?: number | null;
  duration_minutes?: number | null;
  description?: string | null;
  type?: string | null;
  created_at?: string | null;
  is_published?: boolean | null;
};

export type QuestionRow = Extra & {
  id?: string;
  quiz_id?: string | null;
  question_text?: string | null;
  question_type?: string | null;
  options?: unknown;
  correct_answer?: string | null;
  marks?: number | null;
  negative_marks?: number | null;
  position?: number | null;
};

export type QuizAttemptRow = Extra & {
  id?: string;
  quiz_id?: string | null;
  user_id?: string;
  score?: number | null;
  percentage?: number | null;
  passed?: boolean | null;
  created_at?: string | null;
  submitted_at?: string | null;
  total_marks?: number | null;
  student_name?: string | null;
};

export type AttendanceRow = Extra & {
  id?: number | string;
  user_id?: string;
  status?: string | null;
  date?: string | null;
};

export type MessageRow = Extra & {
  id?: string;
  sender_id?: string | null;
  receiver_id?: string | null;
  content?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  recipient_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  is_read?: boolean | null;
};

export type PaymentRow = Extra & {
  id?: string;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
};

export type LiveSessionRow = Extra & {
  id?: string;
  title?: string | null;
  status?: string | null;
  scheduled_at?: string | null;
};
