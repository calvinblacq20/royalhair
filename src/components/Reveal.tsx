import { motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from "react";
import { hasReached } from "../lib/ambient";
import { motionMode, spring } from "../motion";

/*
 * Scroll reveals that can't fail closed. An IntersectionObserver never starts one: on iOS a
 * callback that doesn't arrive would leave the content invisible for good. Instead each element's
 * page position is measured (on mount, on resize and on a one-second heartbeat, never inside an
 * animation frame) and compared with the scroll position on scroll events and on that heartbeat.
 * Timers keep running while a finger is on the screen, when Safari holds requestAnimationFrame.
 */

interface Pending {
  el: Element;
  top: number;
  amount: number;
  show: () => void;
}

const pending = new Set<Pending>();
let docHeight = 0;
let heartbeat = 0;
let trailing = 0;
let lastCheck = 0;
let soon = 0;
let resizeObserver: ResizeObserver | null = null;

/** Elements mounting together are measured in one pass, after the commit. */
function refreshSoon() {
  if (soon) return;
  soon = window.setTimeout(() => {
    soon = 0;
    refresh();
  }, 0);
}

function measure() {
  const scrollY = window.scrollY;
  docHeight = document.documentElement.scrollHeight;
  for (const entry of pending) entry.top = entry.el.getBoundingClientRect().top + scrollY;
}

function check() {
  lastCheck = performance.now();
  const scrollY = window.scrollY;
  const viewportH = window.innerHeight;
  for (const entry of [...pending]) {
    if (!entry.el.isConnected || hasReached(entry.top, scrollY, viewportH, docHeight, entry.amount)) {
      pending.delete(entry);
      entry.show();
    }
  }
  if (!pending.size) stop();
}

function onScroll() {
  const since = performance.now() - lastCheck;
  if (since >= 80) check();
  else if (!trailing) {
    trailing = window.setTimeout(() => {
      trailing = 0;
      check();
    }, 80 - since);
  }
}

function refresh() {
  measure();
  check();
}

function start() {
  if (heartbeat) return;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", refresh);
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(document.body);
  }
  heartbeat = window.setInterval(refresh, 1000);
}

function stop() {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", refresh);
  window.removeEventListener("pageshow", refresh);
  document.removeEventListener("visibilitychange", refresh);
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.clearInterval(heartbeat);
  window.clearTimeout(trailing);
  heartbeat = 0;
  trailing = 0;
}

/** True once the element has scrolled into view (or been scrolled past). Stays true. */
export function useRevealed(ref: RefObject<Element | null>, amount = 0.15): boolean {
  const [shown, setShown] = useState(() => motionMode() === "off");
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const entry: Pending = { el, top: 0, amount, show: () => setShown(true) };
    pending.add(entry);
    start();
    refreshSoon();
    return () => {
      pending.delete(entry);
      if (!pending.size) stop();
    };
  }, [ref, shown, amount]);
  return shown;
}

const TAGS = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  span: motion.span,
  h1: motion.h1,
  h2: motion.h2,
  p: motion.p,
} as const;

interface RevealProps {
  as?: keyof typeof TAGS;
  /** "rise" fades up; "focus" also sharpens from a blur (section headings). */
  look?: "rise" | "focus";
  y?: number;
  delay?: number;
  amount?: number;
  id?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Fades in as it scrolls into view. In calm mode the MotionConfig in App drops the rise and
 * keeps the fade; in off mode it renders in place.
 */
export function Reveal({ as = "div", look = "rise", y = 24, delay = 0, amount, id, className, style, children }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const shown = useRevealed(ref, amount);
  const Tag = TAGS[as] as typeof motion.div;
  const hidden = look === "focus" ? { opacity: 0.001, filter: "blur(10px)", y: 10 } : { opacity: 0, y };
  const visible = look === "focus" ? { opacity: 1, filter: "blur(0px)", y: 0 } : { opacity: 1, y: 0 };
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      id={id}
      className={className}
      style={style}
      initial={motionMode() === "off" ? false : hidden}
      animate={shown ? visible : hidden}
      transition={{ ...(look === "focus" ? spring.large : spring.small), delay }}
    >
      {children}
    </Tag>
  );
}
