import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn() } }));
vi.mock("../lib/native/haptics", () => ({ tapHaptic: vi.fn(async () => {}), selectionHaptic: vi.fn(async () => {}) }));

import { useAutoScroll } from "../hooks/useAutoScroll";

/** A fake 200px-tall scroll range whose scrollTop actually sticks. */
function makeScroller() {
  const el = document.createElement("div");
  let top = 0;
  Object.defineProperty(el, "scrollHeight", { value: 700 });
  Object.defineProperty(el, "clientHeight", { value: 500 });
  Object.defineProperty(el, "scrollTop", {
    get: () => top,
    set: (v: number) => { top = Math.max(0, Math.min(200, v)); },
  });
  document.body.appendChild(el);
  return el;
}

let frames: FrameRequestCallback[] = [];
let now = 0;
const runFrames = (n: number, onFrame?: () => void) => {
  for (let i = 0; i < n && frames.length; i++) {
    const cbs = frames;
    frames = [];
    now += 16.67;
    act(() => { cbs.forEach((cb) => cb(now)); });
    onFrame?.();
  }
};

beforeEach(() => {
  localStorage.clear();
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", () => { frames = []; });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("autoscroll Loop engine", () => {
  it("goes down, comes back up, and stops after 2 rounds", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useAutoScroll({ targetRef: { current: el } }));
    act(() => { result.current.setSpeed(20); result.current.setLoop({ enabled: true, rounds: 2 }); });
    act(() => { result.current.toggle(); });
    expect(result.current.loopRound).toBe(1);

    let reachedBottom = false;
    let backAtTop = false;
    const rounds = new Set<number>();
    runFrames(2000, () => {
      if (el.scrollTop >= 199) reachedBottom = true;
      if (reachedBottom && el.scrollTop <= 1) backAtTop = true;
      if (result.current.loopRound) rounds.add(result.current.loopRound);
    });

    expect(reachedBottom).toBe(true);
    expect(backAtTop).toBe(true);
    expect([...rounds]).toEqual([1, 2]);
    expect(result.current.active).toBe(false);
    expect(el.scrollTop).toBeLessThanOrEqual(1);
  });

  it("without Loop it still stops at the bottom like before", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useAutoScroll({ targetRef: { current: el } }));
    act(() => { result.current.setSpeed(20); result.current.setLoop({ enabled: false }); });
    act(() => { result.current.toggle(); });
    runFrames(2000);
    expect(result.current.active).toBe(false);
    expect(el.scrollTop).toBe(200);
  });
});
