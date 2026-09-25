import { describe, expect, it } from "vitest";
import { nextSlide } from "./autoplay";

describe("nextSlide", () => {
  it("moves one slide on from where the carousel rests", () => {
    expect(nextSlide(0, 375, 5)).toBe(1);
    expect(nextSlide(750, 375, 5)).toBe(3);
  });

  it("goes from the nearest slide when caught mid-swipe", () => {
    expect(nextSlide(400, 375, 5)).toBe(2);
    expect(nextSlide(1100, 375, 5)).toBe(4);
  });

  it("wraps from the last slide back to the first", () => {
    expect(nextSlide(1500, 375, 5)).toBe(0);
  });

  it("stays put while the carousel has no size", () => {
    expect(nextSlide(0, 0, 5)).toBe(0);
    expect(nextSlide(100, 375, 0)).toBe(0);
  });
});
