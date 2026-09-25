import { describe, expect, it } from "vitest";
import { heroCurve } from "./heroCurve";

describe("heroCurve", () => {
  it("is a straight edge once fully scrolled", () => {
    const flat = heroCurve(1200, 460, 0);
    expect(flat.path).toBe('path("M0 0H1200V460A600 0 0 0 1 600 460A600 0 0 0 1 0 460Z")');
    expect(flat.lift(16)).toBe(0);
  });

  it("lifts the sides into a U at the top of the page", () => {
    const curved = heroCurve(1200, 460, 1);
    // right side rises 138px, the left half as much
    expect(curved.path).toContain("V322A600 138 0 0 1 600 460A600 69 0 0 1 0 391Z");
    expect(curved.lift(16)).toBeLessThan(-100);
  });

  it("rests the bottom of the U on an overlapping sheet", () => {
    const curved = heroCurve(375, 440, 1, 24);
    // sides rise past the 24px sheet by 96px on the right and 48px on the left
    expect(curved.path).toContain("V320A187.5 96 0 0 1 187.5 416A187.5 48 0 0 1 0 368Z");
    // a badge that sat 16px above the sheet stays clear of the curve
    expect(curved.lift(16)).toBeCloseTo(-57.2, 1);
    expect(heroCurve(375, 440, 0, 24).lift(16)).toBe(0);
  });

  it("clamps overshoot from the spring", () => {
    expect(heroCurve(375, 440, 1.2, 24).path).toBe(heroCurve(375, 440, 1, 24).path);
    expect(heroCurve(375, 440, -0.1, 24).path).toBe(heroCurve(375, 440, 0, 24).path);
  });
});
