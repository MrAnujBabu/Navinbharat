/**
 * Revision loop for autoscroll.
 *
 * One round = scroll all the way in the starting direction, then all the way
 * back (down + up, or up + down when Reverse is on). In Route / Shuffle mode
 * one round = one full pass over the route. `rounds === 0` means "keep going".
 *
 * Pure functions only, so the canvas loop, the pdf.js bridge path and the
 * tests all share exactly the same counting rules.
 */

export interface LoopSettings {
  enabled: boolean;
  /** Rounds to run before stopping. 0 = infinite. */
  rounds: number;
}

export const MAX_LOOP_ROUNDS = 99;
export const LOOP_ROUND_PRESETS = [1, 2, 3, 5, 10, 0] as const;
export const DEFAULT_LOOP: LoopSettings = { enabled: false, rounds: 3 };

/** ms the reader rests at each turn so the eye can reset before heading back. */
export const LOOP_TURN_MS = 1200;

export const clampRounds = (n: number): number => {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_LOOP_ROUNDS, Math.floor(n));
};

export function parseLoop(raw: string | null | undefined): LoopSettings | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LoopSettings> | null;
    if (!v || typeof v !== "object") return null;
    return { enabled: !!v.enabled, rounds: clampRounds(Number(v.rounds)) };
  } catch {
    return null;
  }
}

export const formatRounds = (rounds: number) => (rounds === 0 ? "∞" : String(rounds));

export interface LoopProgress {
  /** 1-based round currently running. */
  round: number;
  /** Direction currently travelled: 1 = down, -1 = up. */
  dir: 1 | -1;
}

export type EdgeDecision =
  | { action: "flip"; round: number; dir: 1 | -1; roundDone: boolean }
  | { action: "done"; round: number };

/**
 * The scroller reached an edge while looping.
 * - Edge in the starting direction → turn around (half a round).
 * - Edge on the way back → that round is finished: stop if it was the last,
 *   otherwise start the next round in the starting direction.
 */
export function decideAtEdge(p: LoopProgress, startDir: 1 | -1, rounds: number): EdgeDecision {
  if (p.dir === startDir) {
    return { action: "flip", round: p.round, dir: (-startDir) as 1 | -1, roundDone: false };
  }
  if (rounds > 0 && p.round >= rounds) return { action: "done", round: p.round };
  return { action: "flip", round: p.round + 1, dir: startDir, roundDone: true };
}

export type RouteDecision = { action: "again"; round: number } | { action: "done"; round: number };

/** End of a Route / Shuffle pass while looping. */
export function decideAtRouteEnd(round: number, rounds: number): RouteDecision {
  if (rounds > 0 && round >= rounds) return { action: "done", round };
  return { action: "again", round: round + 1 };
}

/** "Round 2/3" — the label the FAB badge and the sheet show. */
export const roundLabel = (round: number, rounds: number) =>
  `${round}/${formatRounds(rounds)}`;
