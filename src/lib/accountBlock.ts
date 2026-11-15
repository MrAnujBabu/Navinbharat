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

export function blockedAccountMessage(reason?: string | null): string {
  const r = reason?.trim();
  return `Your account has been blocked${r ? `: ${r}` : ""}. Please contact support if you think this is a mistake.`;
}

/** An admin may block anyone except their own account. */
export function canBlockAccount(targetUserId: string | null | undefined, currentUserId: string | null | undefined): boolean {
  return !!targetUserId && targetUserId !== currentUserId;
}
