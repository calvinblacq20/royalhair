import { ReactLenis, useLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { animate, motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { createElement, useCallback, useEffect, useRef, type ReactNode } from "react";
import { motionMode } from "../motion";
import { useRevealed } from "./Reveal";

/**
 * Inertial smooth scrolling for the whole page, like the Makro reference.
 * Touch devices keep native scrolling; calm and off modes get plain 1:1 wheel scrolling.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const smooth = motionMode() === "full";
  return (
    <ReactLenis root options={{ lerp: 0.09, smoothWheel: smooth, syncTouch: false, wheelMultiplier: 1, allowNestedScroll: true, autoRaf: true }}>
      {children}
    </ReactLenis>
  );
}

/** Scrolls the page through Lenis when it's running, so programmatic scrolls stay smooth and in sync. */
export function useScrollTo() {
  const lenis = useLenis();
  const jumpOnly = motionMode() !== "full";
  return useCallback(
    (target: number | HTMLElement | null, { offset = 0, immediate = false }: { offset?: number; immediate?: boolean } = {}) => {
      if (target === null) return;
      const jump = immediate || jumpOnly;
      if (lenis) {
        lenis.scrollTo(target, { offset, immediate: jump, duration: jump ? 0 : 1.1, force: true });
        return;
      }
      const top = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: jump ? "auto" : "smooth" });
    },
    [lenis, jumpOnly],
  );
}

/** Pauses smooth scrolling while something (like a sheet) owns the scroll. */
export function useLockScroll(locked: boolean) {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
    return () => {
      lenis.start();
    };
  }, [locked, lenis]);
}

/**
 * Statement text that reveals word by word as it scrolls through the viewport:
 * each word rises a few pixels and darkens from pale to full ink. Calm mode keeps the
 * darkening (opacity isn't motion) and drops the rise; off mode shows plain text.
 */
export function ScrollRevealText({ text, className, as = "p" }: { text: string; className?: string; as?: "p" | "h2" }) {
  const ref = useRef<HTMLElement>(null);
  const mode = motionMode();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.88", "end 0.5"] });
  const words = text.split(/\s+/);

  if (mode === "off") return createElement(as, { className }, text);

  return createElement(
    as,
    { ref, className, "aria-label": text },
    words.map((word, i) => (
      <RevealWord key={`${word}-${i}`} progress={scrollYProgress} start={i / words.length} end={(i + 1) / words.length} rise={mode === "full"}>
        {word}
      </RevealWord>
    )),
  );
}

function RevealWord({ progress, start, end, rise, children }: { progress: MotionValue<number>; start: number; end: number; rise: boolean; children: string }) {
  const opacity = useTransform(progress, [start, end], [0.16, 1]);
  const y = useTransform(progress, [start, end], [7, 0]);
  return (
    <motion.span aria-hidden="true" style={{ opacity, y: rise ? y : 0, display: "inline-block", marginRight: "0.26em", willChange: rise ? "transform, opacity" : "opacity" }}>
      {children}
    </motion.span>
  );
}

/**
 * Counts up to a number the first time it scrolls into view. Started by the fail-open reveal
 * check, not an observer, so it can't sit at zero if a callback never arrives.
 */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", className }: { to: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useRevealed(ref, 0.2);
  const reduce = motionMode() === "off";
  const format = useCallback((v: number) => `${prefix}${v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`, [prefix, suffix, decimals]);

  useEffect(() => {
    const el = ref.current;
    if (!inView || !el) return;
    if (reduce) {
      el.textContent = format(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.4,
      ease: [0.44, 0, 0.56, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, to, format]);

  return (
    <span ref={ref} className={className} aria-label={format(to)}>
      {format(reduce ? to : 0)}
    </span>
  );
}
