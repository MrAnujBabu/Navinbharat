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

  it("Route mode: one pass over the route is one round, then it stops", () => {
    const el = makeScroller();
    // Four 175px pages laid out in the 700px scroll content.
    for (let n = 1; n <= 4; n++) {
      const page = document.createElement("div");
      page.className = "react-pdf__Page";
      page.dataset.pageNumber = String(n);
      page.getBoundingClientRect = () =>
        ({ top: (n - 1) * 175 - el.scrollTop, height: 175, left: 0, right: 0, bottom: 0, width: 0 }) as DOMRect;
      el.appendChild(page);
    }
    el.getBoundingClientRect = () => ({ top: 0, height: 500 }) as DOMRect;
    const { result } = renderHook(() => useAutoScroll({ targetRef: { current: el } }));
    act(() => {
      result.current.setSpeed(20);
      result.current.setDwell({ enabled: true, parity: "route", route: [2, 1], seconds: 1 });
      result.current.setLoop({ enabled: true, rounds: 2 });
    });
    act(() => { result.current.toggle(); });
    const rounds = new Set<number>();
    runFrames(3000, () => { if (result.current.loopRound) rounds.add(result.current.loopRound); });
    expect([...rounds]).toEqual([1, 2]);
    expect(result.current.active).toBe(false);
  });

  it("pdf.js viewer: turns at the bottom, comes back to the top and counts rounds", () => {
    const ifr = document.createElement("iframe");
    document.body.appendChild(ifr);
    const win = ifr.contentWindow!;
    let pos = 0;
    const sent: string[] = [];
    const reply = (data: unknown) =>
      window.dispatchEvent(new MessageEvent("message", { data, source: win, origin: window.location.origin }));
    win.postMessage = ((msg: { type: string; dy?: number }) => {
      sent.push(msg.type);
      if (msg.type === "nb-autoscroll-ping") reply({ type: "nb-autoscroll-pong" });
      if (msg.type === "nb-autoscroll-tick") {
        pos = Math.max(0, Math.min(200, pos + (msg.dy ?? 0)));
        reply({ type: "nb-autoscroll-state", atEnd: pos >= 200, scrollTop: pos });
      }
    }) as typeof win.postMessage;
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const { result } = renderHook(() => useAutoScroll({ iframeRef: { current: ifr } }));
    act(() => { result.current.setSpeed(20); result.current.setLoop({ enabled: true, rounds: 2 }); });
    act(() => { result.current.toggle(); });
    let bottom = false;
    let top = false;
    const rounds = new Set<number>();
    runFrames(3000, () => {
      clock += 16.67;
      if (pos >= 200) bottom = true;
      if (bottom && pos <= 0) top = true;
      if (result.current.loopRound) rounds.add(result.current.loopRound);
    });
    vi.restoreAllMocks();
    expect(bottom && top).toBe(true);
    expect([...rounds]).toEqual([1, 2]);
    expect(result.current.active).toBe(false);
  });

  it("pdf.js viewer Route: restarts the route for each round, then stops", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ifr = document.createElement("iframe");
    document.body.appendChild(ifr);
    const win = ifr.contentWindow!;
    let passPending = false;
    const dwellsSent: { loopRoute: boolean }[] = [];
    const reply = (data: unknown) =>
      window.dispatchEvent(new MessageEvent("message", { data, source: win, origin: window.location.origin }));
    win.postMessage = ((msg: { type: string; dwell?: { loopRoute: boolean } }) => {
      if (msg.type === "nb-autoscroll-ping") reply({ type: "nb-autoscroll-pong" });
      // Every (re)sent route config starts a fresh pass, which ends on a later tick.
      if (msg.type === "nb-autoscroll-dwell") { dwellsSent.push(msg.dwell!); passPending = true; }
      if (msg.type === "nb-autoscroll-tick" && passPending) {
        passPending = false;
        reply({ type: "nb-autoscroll-route-done", page: 1 });
      }
    }) as typeof win.postMessage;
    const { result } = renderHook(() => useAutoScroll({ iframeRef: { current: ifr } }));
    act(() => {
      result.current.setDwell({ enabled: true, parity: "route", route: [3, 1], seconds: 2 });
      result.current.setLoop({ enabled: true, rounds: 3 });
    });
    act(() => { result.current.toggle(); });
    const rounds = new Set<number>([result.current.loopRound]);
    for (let i = 0; i < 10 && result.current.active; i++) {
      runFrames(5, () => { if (result.current.loopRound) rounds.add(result.current.loopRound); });
      act(() => { vi.advanceTimersByTime(2100); });
    }
    vi.useRealTimers();
    expect([...rounds]).toEqual([1, 2, 3]);
    expect(result.current.active).toBe(false);
    // The viewer never wraps on its own — rounds are counted by the app.
    expect(dwellsSent.every((d) => d.loopRoute === false)).toBe(true);
  });
});
