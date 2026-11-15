/**
 * Account blocking rules (admin "Block user" in Users, Student detail and Fraud Watch).
 *
 * The block flag lives on `profiles.is_blocked`; only admins can change it
 * (DB trigger `protect_profile_block_fields`). The app signs blocked accounts
 * out on load and refuses new sign-ins.
 */
import type { AppRole } from "../contexts/AuthContext";

/** Blocked accounts are signed out — except admins, so a mistaken block can never lock every admin out. */
export function shouldEnforceBlock(isBlocked: boolean | null | undefined, role: AppRole | null | undefined): boolean {
  return isBlocked === true && role !== "admin";
}

/** The admin's block reason stays private ("visible to admins only"), so the user only sees a generic notice. */
export const BLOCKED_ACCOUNT_MESSAGE =
  "Your account has been blocked. Please contact support if you think this is a mistake.";

/** An admin may block anyone except their own account. */
export function canBlockAccount(targetUserId: string | null | undefined, currentUserId: string | null | undefined): boolean {
  return !!targetUserId && targetUserId !== currentUserId;
}

const NOTICE_KEY = "nb:blocked_notice";

/**
 * Remember that this device was signed out because the account is blocked, so
 * the sign-in page can explain why. A toast alone is not enough: it can fire
 * before the toaster mounts, and the sign-in page can remount during the
 * redirect. The notice stays until the next sign-in attempt or a successful,
 * unblocked sign-in clears it.
 */
export function rememberBlockedNotice(): void {
  try { sessionStorage.setItem(NOTICE_KEY, "1"); } catch { /* storage unavailable */ }
}

/** The blocked-account notice if this device was signed out for a block, else null. */
export function readBlockedNotice(): string | null {
  try { return sessionStorage.getItem(NOTICE_KEY) === "1" ? BLOCKED_ACCOUNT_MESSAGE : null; } catch { return null; }
}

export function clearBlockedNotice(): void {
  try { sessionStorage.removeItem(NOTICE_KEY); } catch { /* storage unavailable */ }
}
