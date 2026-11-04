import { describe, expect, it } from "vitest";
import { shouldWaitForNativeHome } from "@/lib/native/homeBootstrap";

describe("Native home bootstrap", () => {
  it("holds APK home until the session resolves", () => {
    expect(shouldWaitForNativeHome("/", true, true)).toBe(true);
    expect(shouldWaitForNativeHome("/", false, true)).toBe(false);
  });
  it("keeps the public website landing immediate", () => {
    expect(shouldWaitForNativeHome("/", true, false)).toBe(false);
  });
  it("never remounts the native login form during bootstrap", () => {
    expect(shouldWaitForNativeHome("/login", true, true)).toBe(false);
  });
});