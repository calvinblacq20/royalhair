import { describe, expect, it } from "vitest";
import { advance, frameStep, hasReached, motionOverride, resolveMotionMode, snapToPixel, wrap } from "./ambient";

describe("motion mode", () => {
  it("reads ?motion= from the query string or the hash route", () => {
    expect(motionOverride("?motion=calm", "#/")).toBe("calm");
    expect(motionOverride("", "#/explore?occasion=church&motion=off")).toBe("off");
    expect(motionOverride("?motion=full", "#/?motion=off")).toBe("full");
  });

  it("ignores unknown values", () => {
    expect(motionOverride("?motion=fast", "#/?motion=")).toBeNull();
    expect(motionOverride("", "")).toBeNull();
  });

  it("runs full motion on every device unless the URL asks for less", () => {
    expect(resolveMotionMode("", "#/")).toBe("full");
    expect(resolveMotionMode("?motion=calm", "#/")).toBe("calm");
    expect(resolveMotionMode("", "#/explore?motion=off")).toBe("off");
  });
});

describe("ambient loops", () => {
  it("wraps positions into the loop length, both directions", () => {
    expect(wrap(1030, 1000)).toBe(30);
    expect(wrap(-30, 1000)).toBe(970);
    expect(wrap(50, 0)).toBe(0);
  });

  it("advances by elapsed time, not frames", () => {
    // 30 px/s: one second is 30px however many frames delivered it.
    expect(advance(0, 1000, 30, 1000)).toBe(30);
    expect(advance(990, 1000, 30, 1000)).toBe(20);
  });

  it("clamps the step so returning from the background doesn't lurch", () => {
    expect(frameStep(5000, null)).toBe(0);
    expect(frameStep(1016, 1000)).toBe(16);
    expect(frameStep(60_000, 1000)).toBe(64);
    expect(frameStep(900, 1000)).toBe(0);
  });

  it("snaps to device pixels", () => {
    expect(snapToPixel(10.2, 2)).toBe(10);
    expect(snapToPixel(10.3, 2)).toBe(10.5);
    expect(snapToPixel(10.4, 0)).toBe(10);
  });
});

describe("scroll reveal", () => {
  const vh = 800;
  const docH = 5000;

  it("starts once the top rises above the bottom band", () => {
    // Default band is 15% of the viewport: the line sits at 680px.
    expect(hasReached(650, 0, vh, docH)).toBe(true);
    expect(hasReached(700, 0, vh, docH)).toBe(false);
  });

  it("counts content already scrolled past", () => {
    expect(hasReached(100, 3000, vh, docH)).toBe(true);
  });

  it("reveals what's on screen when the page bottom is reached", () => {
    expect(hasReached(4190, 4200, vh, docH, 0.6)).toBe(true);
    expect(hasReached(4990, 4200, vh, docH, 0.6)).toBe(true);
  });
});
