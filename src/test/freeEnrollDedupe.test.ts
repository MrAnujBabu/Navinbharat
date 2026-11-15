import { beforeEach, describe, expect, it } from "vitest";
import {
  FREE_ENROLL_DEDUPE_MS, claimFreeEnroll, failFreeEnroll, finishFreeEnroll, freeEnrollKey,
  recentFreeEnroll, resetFreeEnrollLedger,
} from "../lib/freeEnrollDedupe";

const key = freeEnrollKey("student-1", 34);

describe("free course enrollment reports one outcome", () => {
  beforeEach(() => resetFreeEnrollLedger());

  it("only the first attempt for a student + course reports the result", () => {
    expect(claimFreeEnroll(key, 1000)).toBe("start");
    expect(claimFreeEnroll(key, 1200)).toBe("in-flight");
    expect(recentFreeEnroll(key, 1200)).toBe("in-flight");
  });

  it("after success, a remounted page just moves on without a second message", () => {
    claimFreeEnroll(key, 1000);
    finishFreeEnroll(key);
    expect(claimFreeEnroll(key, 2000)).toBe("done");
    expect(recentFreeEnroll(key, 2000)).toBe("done");
  });

  it("a failed attempt lets the student try again", () => {
    claimFreeEnroll(key, 1000);
    failFreeEnroll(key);
    expect(claimFreeEnroll(key, 1100)).toBe("start");
  });

  it("other students and other courses are independent", () => {
    claimFreeEnroll(key, 1000);
    expect(claimFreeEnroll(freeEnrollKey("student-2", 34), 1000)).toBe("start");
    expect(claimFreeEnroll(freeEnrollKey("student-1", 30), 1000)).toBe("start");
  });

  it("the guard expires so a later visit behaves normally", () => {
    claimFreeEnroll(key, 1000);
    finishFreeEnroll(key);
    expect(recentFreeEnroll(key, 1000 + FREE_ENROLL_DEDUPE_MS)).toBeNull();
    expect(claimFreeEnroll(key, 1000 + FREE_ENROLL_DEDUPE_MS)).toBe("start");
  });
});
