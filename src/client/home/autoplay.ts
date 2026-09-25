import { useEffect, useRef, type RefObject } from "react";
import { photoSrcSet } from "../../components/Bits";
import { motionMode } from "../../motion";

/** How long each hero photo stays up before the next one comes in. */
const INTERVAL_MS = 4500;
/** After someone taps or swipes the hero, it waits this long before moving on by itself again. */
const RESUME_AFTER_MS = 8000;

/** The slide after the one a carousel is resting on (or closest to, mid-swipe), wrapping to the first. */
export function nextSlide(scrollLeft: number, slideWidth: number, count: number) {
  if (slideWidth <= 0 || count <= 0) return 0;
  return (Math.round(scrollLeft / slideWidth) + 1) % count;
}

/** Fetches and decodes a photo at the size it will render, so it can come in without a blank frame. */
export function preloadPhoto(src: string, sizes: string): Promise<void> {
  const img = new Image();
  img.sizes = sizes;
  img.srcset = photoSrcSet(src) ?? "";
  img.src = src;
  return img.decode().catch(() => undefined);
}

/**
 * Calls `advance` every few seconds while the element is on screen and the tab is visible. Holds
 * still while a mouse rests on it and for a while after a touch, so it never fights the person.
 */
export function useAutoplay(ref: RefObject<HTMLElement | null>, advance: () => Promise<void> | void) {
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || motionMode() === "off") return;
    let inView = false;
    let hovering = false;
    let busy = false;
    let resumeAt = 0;

    const observer = new IntersectionObserver(([entry]) => (inView = entry?.isIntersecting ?? false), { threshold: 0.25 });
    observer.observe(el);
    const onEnter = (e: PointerEvent) => (hovering = hovering || e.pointerType === "mouse");
    const onLeave = () => (hovering = false);
    const onTouch = () => (resumeAt = Date.now() + RESUME_AFTER_MS);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onTouch);

    const timer = window.setInterval(async () => {
      if (busy || hovering || !inView || document.hidden || Date.now() < resumeAt) return;
      busy = true;
      try {
        await advanceRef.current();
      } finally {
        busy = false;
      }
    }, INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onTouch);
    };
  }, [ref]);
}
