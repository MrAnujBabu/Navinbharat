/**
 * Admin moderation rules shared by the Moderation page and its tests.
 */

/** New reports are stored as "open" (DB default); older rows may say "pending". Both still need an admin decision. */
export const isActionableReport = (status: string): boolean => status === "open" || status === "pending";

export type ModeratedTab = "posts" | "comments" | "replies";

/** Each moderated table names its author / text columns differently. */
export const MODERATION_SOURCES: Record<ModeratedTab, { table: string; authorCol: string; bodyCol: string }> = {
  posts: { table: "community_posts", authorCol: "author_id", bodyCol: "body" },
  comments: { table: "community_comments", authorCol: "user_id", bodyCol: "body" },
  replies: { table: "doubt_replies", authorCol: "user_id", bodyCol: "message" },
};
