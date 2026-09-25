import { X } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { spring } from "../motion";
import { DESKTOP_QUERY, useMediaQuery } from "./Chrome";
import { useLockScroll } from "./Scroll";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const controls = useDragControls();
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  // Bottom sheet on phones, centred dialog on wider screens.
  const modal = useMediaQuery(DESKTOP_QUERY);
  useLockScroll(open);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`sheet-root ${modal ? "is-modal" : ""}`}>
          <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`sheet ${modal ? "is-modal" : ""}`}
            data-lenis-prevent
            initial={modal ? { opacity: 0, scale: 0.96, y: 16 } : { y: "100%" }}
            animate={modal ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={modal ? { opacity: 0, scale: 0.97, y: 8 } : { y: "100%" }}
            transition={modal ? spring.small : spring.press}
            drag={modal ? false : "y"}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <span className="sheet-grab" onPointerDown={(e) => controls.start(e)} aria-hidden="true" />
            <button ref={closeRef} className="icon-btn is-plain sheet-close" onClick={onClose} aria-label="Close">
              <X size={20} strokeWidth={1.8} />
            </button>
            {title && (
              <h2 id={titleId} className="t-h3 sheet-title">
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
