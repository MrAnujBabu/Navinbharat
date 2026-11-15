import { describe, expect, it } from "vitest";
import { BLOCKED_ACCOUNT_MESSAGE, canBlockAccount, clearBlockedNotice, readBlockedNotice, rememberBlockedNotice, shouldEnforceBlock } from "../lib/accountBlock";

describe("account blocking", () => {
  it("signs out a blocked student", () => {
    expect(shouldEnforceBlock(true, "student")).toBe(true);
  });

  it("signs out a blocked teacher", () => {
    expect(shouldEnforceBlock(true, "teacher")).toBe(true);
  });

  it("never locks out an admin", () => {
    expect(shouldEnforceBlock(true, "admin")).toBe(false);
  });

  it("leaves unblocked accounts alone", () => {
    expect(shouldEnforceBlock(false, "student")).toBe(false);
    expect(shouldEnforceBlock(null, "student")).toBe(false);
  });

  it("tells the user they are blocked without revealing the admin-only reason", () => {
    expect(BLOCKED_ACCOUNT_MESSAGE).toContain("Your account has been blocked.");
  });

  it("an admin cannot block their own account", () => {
    expect(canBlockAccount("admin-1", "admin-1")).toBe(false);
    expect(canBlockAccount("student-9", "admin-1")).toBe(true);
  });

  it("the sign-in page keeps showing the blocked notice until the next sign-in attempt", () => {
    sessionStorage.clear();
    expect(readBlockedNotice()).toBeNull();
    rememberBlockedNotice();
    expect(readBlockedNotice()).toBe(BLOCKED_ACCOUNT_MESSAGE);
    expect(readBlockedNotice()).toBe(BLOCKED_ACCOUNT_MESSAGE);
    clearBlockedNotice();
    expect(readBlockedNotice()).toBeNull();
  });
});
