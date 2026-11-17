import { describe, expect, it } from "vitest";
import {
  clampRounds,
  decideAtEdge,
  decideAtRouteEnd,
  parseLoop,
  roundLabel,
} from "../lib/reader/loopRounds";

describe("autoscroll loop rounds", () => {
  it("turns around at the bottom without finishing the round (down then up = 1 round)", () => {
    expect(decideAtEdge({ round: 1, dir: 1 }, 1, 1)).toEqual({
      action: "flip",
      round: 1,
      dir: -1,
      roundDone: false,
    });
  });

  it("stops after the chosen number of rounds when it gets back to the top", () => {
    expect(decideAtEdge({ round: 3, dir: -1 }, 1, 3)).toEqual({ action: "done", round: 3 });
  });

  it("starts the next round going down again when rounds are left", () => {
    expect(decideAtEdge({ round: 1, dir: -1 }, 1, 3)).toEqual({
      action: "flip",
      round: 2,
      dir: 1,
      roundDone: true,
    });
  });

  it("with Reverse on, one round is up first and then back down", () => {
    expect(decideAtEdge({ round: 1, dir: -1 }, -1, 1).action).toBe("flip");
    expect(decideAtEdge({ round: 1, dir: 1 }, -1, 1)).toEqual({ action: "done", round: 1 });
  });

  it("∞ rounds never stop", () => {
    expect(decideAtEdge({ round: 50, dir: -1 }, 1, 0).action).toBe("flip");
    expect(decideAtRouteEnd(50, 0)).toEqual({ action: "again", round: 51 });
  });

  it("in Route mode one full pass is one round", () => {
    expect(decideAtRouteEnd(1, 2)).toEqual({ action: "again", round: 2 });
    expect(decideAtRouteEnd(2, 2)).toEqual({ action: "done", round: 2 });
  });

  it("keeps rounds between 1 and 99, with 0 meaning ∞", () => {
    expect(clampRounds(3)).toBe(3);
    expect(clampRounds(500)).toBe(99);
    expect(clampRounds(-2)).toBe(0);
    expect(roundLabel(2, 0)).toBe("2/∞");
    expect(parseLoop('{"enabled":true,"rounds":5}')).toEqual({ enabled: true, rounds: 5 });
    expect(parseLoop("garbage")).toBeNull();
  });
});
