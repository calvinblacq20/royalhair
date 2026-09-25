/*
 * Pure helpers behind the site's motion: how the motion mode is resolved, how ambient loops
 * advance, and when a scroll reveal starts. No DOM access, so every rule here is unit tested.
 */

export type MotionMode = "full" | "calm" | "off";

const MODES: readonly string[] = ["full", "calm", "off"];

/**
 * A `?motion=full|calm|off` override, read from the query string or from the query part of the
 * hash route (`#/explore?motion=calm`). Lets a device setting be told apart from a bug on a
 * handset nobody can inspect.
 */
export function motionOverride(search: string, hash: string): MotionMode | null {
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
  for (const query of [search, hashQuery]) {
    const value = new URLSearchParams(query).get("motion");
    if (value && MODES.includes(value)) return value as MotionMode;
  }
  return null;
}

/**
 * Full motion on every device unless the URL asks for less. The device's reduced-motion setting
 * is deliberately not read: iOS turns it on in Low Power Mode, and the studio wants the same
 * experience on every phone. Mirrors the inline script in index.html, which runs before first paint.
 */
export function resolveMotionMode(search: string, hash: string): MotionMode {
  return motionOverride(search, hash) ?? "full";
}

/** Wraps a position into [0, length). */
export function wrap(value: number, length: number): number {
  if (!(length > 0)) return 0;
  return ((value % length) + length) % length;
}

/** Elapsed time for one frame, clamped so a loop coming back from the background doesn't lurch. */
export function frameStep(now: number, last: number | null, maxMs = 64): number {
  if (last === null) return 0;
  return Math.min(Math.max(now - last, 0), maxMs);
}

/** Moves an ambient loop along by elapsed milliseconds, never by frame count. */
export function advance(offset: number, elapsedMs: number, pxPerSecond: number, length: number): number {
  return wrap(offset + (pxPerSecond * elapsedMs) / 1000, length);
}

/** Rounds to device pixels, so a style is written only when the rendered position actually changes. */
export function snapToPixel(value: number, dpr: number): number {
  const ratio = dpr > 0 ? dpr : 1;
  return Math.round(value * ratio) / ratio;
}

/**
 * Whether a scroll reveal should start. True once the element's top rises `amount` of a viewport
 * above the bottom edge, or once the page bottom is reached with the element on screen. Anything
 * already scrolled past counts too, so skipped content is never left hidden.
 */
export function hasReached(top: number, scrollY: number, viewportH: number, docH: number, amount = 0.15): boolean {
  const bottom = scrollY + viewportH;
  return top < bottom - viewportH * amount || (bottom >= docH - 2 && top < bottom);
}
