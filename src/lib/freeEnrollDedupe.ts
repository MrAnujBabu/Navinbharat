/**
 * One free-enrollment outcome per student + course.
 *
 * BuyCourse auto-enrolls into free courses on mount, runs a payment-recovery
 * check in parallel, and ProtectedRoute can remount the page while sign-in
 * finishes loading. Each of those used to report its own result, so a
 * brand-new student saw "Free enrollment successful" and "You're already
 * enrolled" together. This module-level ledger (shared across remounts) lets
 * only the first attempt speak; the others stay quiet.
 */
export const FREE_ENROLL_DEDUPE_MS = 15_000;

type Entry = { at: number; done: boolean };
const ledger = new Map<string, Entry>();

export type FreeEnrollClaim = "start" | "in-flight" | "done";

export const freeEnrollKey = (userId: string, courseId: number) => `${userId}:${courseId}`;

/** What another caller is doing with this enrollment right now, if anything. */
export function recentFreeEnroll(key: string, now = Date.now()): FreeEnrollClaim | null {
  const e = ledger.get(key);
  if (!e || now - e.at >= FREE_ENROLL_DEDUPE_MS) return null;
  return e.done ? "done" : "in-flight";
}

/** "start" means this caller owns the attempt and must report the outcome. */
export function claimFreeEnroll(key: string, now = Date.now()): FreeEnrollClaim {
  const recent = recentFreeEnroll(key, now);
  if (recent) return recent;
  ledger.set(key, { at: now, done: false });
  return "start";
}

export function finishFreeEnroll(key: string): void {
  const e = ledger.get(key);
  if (e) e.done = true;
}

/** A failed attempt releases the claim so the student can retry. */
export function failFreeEnroll(key: string): void {
  ledger.delete(key);
}

/** Test helper. */
export function resetFreeEnrollLedger(): void {
  ledger.clear();
}
