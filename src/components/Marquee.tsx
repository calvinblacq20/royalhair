import { useEffect, useRef, type ReactNode } from "react";
import { advance, frameStep, snapToPixel, wrap } from "../lib/ambient";
import { motionMode } from "../motion";

interface MarqueeProps {
  children: ReactNode;
  /** Names the region for screen readers, e.g. "Lookbook". */
  label: string;
  /** Pixels per second. */
  speed?: number;
  /** Which way the items travel across the screen. */
  direction?: "left" | "right";
  paused?: boolean;
  className?: string;
}

/**
 * A row that drifts sideways at a constant rate and can be dragged. It is an ambient loop inside
 * its own frame, so it keeps running in calm mode; in off mode it is a plain scrollable row.
 *
 * Built to keep moving on iPhone:
 * - steps by elapsed time (clamped), never by frame count;
 * - a watchdog restarts the frame loop when Safari suspends it (backgrounding, back/forward
 *   cache, a finger on the screen) and doesn't resume it;
 * - nothing gates the start: an on-screen test from cached positions only pauses it;
 * - no layout reads inside the loop, and the transform is written only when the pixel changes.
 */
export function Marquee({ children, label, speed = 32, direction = "left", paused = false, className = "" }: MarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const set = setRef.current;
    if (!viewport || !track || !set || motionMode() === "off") return;

    // Layout, measured on resize and on the watchdog tick only.
    let loopWidth = 0;
    let dpr = 1;
    let pageTop = 0;
    let pageBottom = 0;
    const measure = () => {
      const previous = loopWidth;
      loopWidth = set.offsetWidth;
      if (loopWidth !== previous && previous > 0) {
        offset = wrap(offset, loopWidth);
        written = Number.NaN;
        write();
      }
      const rect = viewport.getBoundingClientRect();
      pageTop = rect.top + window.scrollY;
      pageBottom = pageTop + rect.height;
      dpr = window.devicePixelRatio || 1;
    };

    let offset = 0;
    let written = Number.NaN;
    let last: number | null = null;
    let beat = performance.now();
    let frame = 0;
    let hovered = false;
    let focused = false;
    let resumeAt = 0;
    let drag: { id: number; x: number; y: number; from: number; axis: "x" | "y" | null } | null = null;
    let dragged = false;

    // `offset` always grows with travel. Leftward shows the first copy sliding out to the left;
    // rightward starts one copy back and slides it in from the left.
    const rightward = direction === "right";
    const write = () => {
      const x = snapToPixel(offset, dpr);
      if (x === written) return;
      written = x;
      track.style.transform = `translate3d(${rightward ? x - loopWidth : -x}px, 0, 0)`;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      beat = performance.now();
      const step = frameStep(now, last);
      last = now;
      if (pausedRef.current || hovered || focused || drag || now < resumeAt || loopWidth <= 0) return;
      // Resting while far off screen saves battery. Compared against positions cached by measure(),
      // so there's no layout read here, and no observer callback that could fail to wake it.
      const scrollY = window.scrollY;
      if (scrollY + window.innerHeight < pageTop - 300 || scrollY > pageBottom + 300) return;
      offset = advance(offset, step, speed, loopWidth);
      write();
    };

    const restart = () => {
      cancelAnimationFrame(frame);
      last = null;
      frame = requestAnimationFrame(tick);
    };

    const watchdog = window.setInterval(() => {
      measure();
      if (document.visibilityState === "visible" && performance.now() - beat > 1000) restart();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      measure();
      restart();
    };
    const onPageShow = () => {
      measure();
      restart();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: offset, axis: null };
      dragged = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (drag.axis === "x") viewport.setPointerCapture(e.pointerId);
      }
      if (drag.axis !== "x" || loopWidth <= 0) return;
      dragged = true;
      offset = wrap(rightward ? drag.from + dx : drag.from - dx, loopWidth);
      // Written straight away: Safari holds animation frames while a finger is on the screen.
      write();
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      resumeAt = performance.now() + 1500;
    };
    // A drag that ends over a card shouldn't open it.
    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    };
    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovered = true;
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovered = false;
    };
    // Keyboard users: stop, and bring the focused card into view.
    const onFocusIn = (e: FocusEvent) => {
      focused = true;
      viewport.scrollLeft = 0;
      const card = (e.target as HTMLElement).closest<HTMLElement>(".marquee-set > *");
      if (card && loopWidth > 0) {
        offset = wrap(rightward ? loopWidth - card.offsetLeft + 16 : card.offsetLeft - 16, loopWidth);
        write();
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!viewport.contains(e.relatedTarget as Node | null)) focused = false;
    };
    const onDragStart = (e: DragEvent) => e.preventDefault();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(viewport);
    resizeObserver.observe(set);
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerEnd);
    viewport.addEventListener("pointercancel", onPointerEnd);
    viewport.addEventListener("click", onClickCapture, true);
    viewport.addEventListener("pointerenter", onPointerEnter);
    viewport.addEventListener("pointerleave", onPointerLeave);
    viewport.addEventListener("focusin", onFocusIn);
    viewport.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("dragstart", onDragStart);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize", measure);

    measure();
    write();
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(watchdog);
      resizeObserver.disconnect();
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerEnd);
      viewport.removeEventListener("pointercancel", onPointerEnd);
      viewport.removeEventListener("click", onClickCapture, true);
      viewport.removeEventListener("pointerenter", onPointerEnter);
      viewport.removeEventListener("pointerleave", onPointerLeave);
      viewport.removeEventListener("focusin", onFocusIn);
      viewport.removeEventListener("focusout", onFocusOut);
      viewport.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize", measure);
      track.style.transform = "";
    };
  }, [speed, direction]);

  return (
    <div ref={viewportRef} className={`marquee ${className}`} role="region" aria-label={label}>
      <div ref={trackRef} className="marquee-track">
        <div ref={setRef} className="marquee-set">
          {children}
        </div>
        {/* Extra copies close the loop seamlessly across all screen sizes */}
        <div className="marquee-set" aria-hidden="true" inert>
          {children}
        </div>
        <div className="marquee-set" aria-hidden="true" inert>
          {children}
        </div>
      </div>
    </div>
  );
}
