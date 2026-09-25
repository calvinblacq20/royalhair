import { useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, type RefObject } from "react";
import { isCalm, spring } from "../../motion";

/** Scroll distance over which the U flattens back into a straight edge. */
const SETTLE_PX = 420;
/** The left side of the U rises this share of the right side's height. */
const LEFT_BEND = 0.5;

/**
 * The hero's bottom edge as a lopsided U: two quarter-ellipses meeting at a low
 * point in the middle, which rests on whatever overlaps the photo from below
 * (`overlap`, 0 when nothing does). `bend` runs from 1 (fully curved) to 0 (the
 * original straight edge).
 */
export function heroCurve(width: number, height: number, bend: number, overlap = 0) {
  const k = Math.min(1, Math.max(0, bend));
  const rx = width / 2;
  const rightRy = Math.min(height * 0.3, Math.max(96, width * 0.13)) * k;
  const leftRy = rightRy * LEFT_BEND;
  const floor = height - overlap;
  const low = height - overlap * k;
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    path: `path("M0 0H${r(width)}V${r(low - rightRy)}A${r(rx)} ${r(rightRy)} 0 0 1 ${r(rx)} ${r(low)}A${r(rx)} ${r(leftRy)} 0 0 1 0 ${r(low - leftRy)}Z")`,
    /** Upward shift that keeps a badge `inset` px from the right edge clear of the curve. */
    lift(inset: number) {
      const u = (width - inset - rx) / rx;
      const edge = low - rightRy + rightRy * Math.sqrt(Math.max(0, 1 - u * u));
      return Math.min(0, edge - floor);
    },
  };
}

/**
 * Clip path and badge offset for a hero that starts as a U and straightens as the page scrolls.
 * The U is part of the design, not an animation, so it shows in every motion mode: calm and off
 * (reduced motion, which iOS also reports in Low Power Mode) keep it still instead of flattening it.
 */
export function useHeroCurve(ref: RefObject<HTMLElement | null>, { overlap = 0, badgeInset = 16 } = {}) {
  const still = isCalm();
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const resting = useMotionValue(1);
  const { scrollY } = useScroll();
  const flattening = useSpring(useTransform(scrollY, [0, SETTLE_PX], [1, 0]), spring.press);
  const bend = still ? resting : flattening;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      width.set(el.offsetWidth);
      height.set(el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, width, height]);

  const clipPath = useTransform([bend, width, height], ([k = 0, w = 0, h = 0]: number[]) => (w ? heroCurve(w, h, k, overlap).path : "none"));
  const badgeY = useTransform([bend, width, height], ([k = 0, w = 0, h = 0]: number[]) => (w ? heroCurve(w, h, k, overlap).lift(badgeInset) : 0));
  // Safari before 14 only reads the prefixed property.
  return { clipPath, WebkitClipPath: clipPath, badgeY };
}
