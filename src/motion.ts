import type { Transition } from "motion/react";
import type { MotionMode } from "./lib/ambient";

export type { MotionMode };

/**
 * The motion mode index.html resolved before first paint. Read this, never the
 * prefers-reduced-motion media query, so CSS and JS can't disagree. Every device runs
 * "full"; calm and off are only reachable with ?motion= (for testing).
 *   full: everything runs · calm: fades and ambient loops only · off: static
 */
export function motionMode(): MotionMode {
  if (typeof document === "undefined") return "full";
  const mode = document.documentElement.dataset.motion;
  return mode === "calm" || mode === "off" ? mode : "full";
}

/** True when scroll-coupled drift, parallax, zooms and slide-ins should be left out. */
export const isCalm = () => motionMode() !== "full";

/** Springs lifted from the Makro template's own animation configs. */
export const spring = {
  small: { type: "spring", bounce: 0.2, duration: 0.4 },
  large: { type: "spring", bounce: 0.2, duration: 1 },
  press: { type: "spring", stiffness: 500, damping: 60, mass: 1 },
  settle: { type: "spring", bounce: 0, duration: 0.8 },
  micro: { type: "spring", bounce: 0, duration: 0.3 },
} as const satisfies Record<string, Transition>;

export const enter = (y = 24, delay = 0) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring.small, delay },
});

export const blurIn = (delay = 0) => ({
  initial: { opacity: 0.001, filter: "blur(10px)", y: 10 },
  animate: { opacity: 1, filter: "blur(0px)", y: 0 },
  transition: { ...spring.large, delay },
});

/** Screen pushed in from the right, as in the reference flow. */
export const push = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  transition: spring.small,
};
