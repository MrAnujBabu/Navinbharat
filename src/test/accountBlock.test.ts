import { describe, expect, it } from "vitest";
import { blockedAccountMessage, canBlockAccount, shouldEnforceBlock } from "../lib/accountBlock";

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

  it("tells the user why they were blocked", () => {
    expect(blockedAccountMessage("Shared account")).toContain("blocked: Shared account");
    expect(blockedAccountMessage(null)).toContain("Your account has been blocked.");
  });

  it("an admin cannot block their own account", () => {
    expect(canBlockAccount("admin-1", "admin-1")).toBe(false);
    expect(canBlockAccount("student-9", "admin-1")).toBe(true);
  });
});
