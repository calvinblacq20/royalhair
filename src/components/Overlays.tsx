import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SALON } from "../data/business";
import { blurIn, motionMode, spring } from "../motion";
import { LogoMark } from "./Brand";

const SPLASH_KEY = "fq-splash-seen";
/** Long enough to hold the finished logo, name and tagline on screen for about two seconds. */
const SPLASH_MS = 3200;
/** Without the write-in animation there is nothing to wait for, but the brand still gets a beat. */
const SPLASH_CALM_MS = 1200;

/** Launch screen: the monogram writes itself in, then the app fades up. */
export function Splash() {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!show) return;
    const reduce = motionMode() !== "full";
    const timer = window.setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* private mode: the splash simply shows again next time */
      }
    }, reduce ? SPLASH_CALM_MS : SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [show]);

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="overlay splash"
          role="status"
          aria-label={`Loading ${SALON.name}`}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: [0.44, 0, 0.56, 1] }}
        >
          <div className="splash-content">
            <motion.div
              initial={{ clipPath: "inset(0% 100% 0% 0%)", opacity: 0.4, rotate: -6 }}
              animate={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1, rotate: 0 }}
              transition={{ clipPath: { duration: 0.9, ease: [0.27, 0, 0.51, 1] }, opacity: { duration: 0.4 }, rotate: spring.large }}
            >
              <LogoMark size={112} />
            </motion.div>
            <div className="stack" style={{ alignItems: "center", gap: 6 }}>
              <motion.p className="splash-word" {...blurIn(0.55)}>
                {SALON.name}
              </motion.p>
              <motion.p className="splash-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}>
                {SALON.tagline} · Accra & Kumasi
              </motion.p>
            </div>
          </div>
          <div className="splash-bar" aria-hidden="true">
            <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: (SPLASH_MS - 200) / 1000, ease: [0.44, 0, 0.56, 1] }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface SuccessProps {
  open: boolean;
  title: string;
  tone?: "success" | "cancel";
  onDone: () => void;
}

/** Full-screen confirmation with a moving gradient, as in the reference flow. */
export function SuccessScreen({ open, title, tone = "success", onDone }: SuccessProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onDone, 1900);
    return () => window.clearTimeout(timer);
  }, [open, onDone]);

  const blobs =
    tone === "success"
      ? [
          { c: "#fc5aa3", x: "-20%", y: "-10%", s: "70vmax" },
          { c: "#ffc2dc", x: "35%", y: "30%", s: "65vmax" },
          { c: "#ead9c4", x: "-10%", y: "55%", s: "55vmax" },
        ]
      : [
          { c: "#e2d9da", x: "-20%", y: "-10%", s: "70vmax" },
          { c: "#cfa9c4", x: "35%", y: "35%", s: "60vmax" },
          { c: "#b9aab0", x: "-15%", y: "55%", s: "55vmax" },
        ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay success" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {blobs.map((b, i) => (
            <motion.span
              key={b.c}
              className="success-blob"
              // Softness is baked into the gradient: a live blur filter re-renders on every frame while the blob scales.
              style={{ background: `radial-gradient(closest-side, ${b.c} 0%, ${b.c} 35%, transparent 100%)`, width: b.s, height: b.s, left: b.x, top: b.y }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.85, 1.12, 0.95], opacity: 0.95, x: [0, i % 2 ? -40 : 40, 0], y: [0, i % 2 ? 30 : -30, 0] }}
              transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
            />
          ))}
          <div className="success-content">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <motion.path
                d="M14 33 L27 46 L51 19"
                stroke="#fff"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, delay: 0.15, ease: [0.44, 0, 0.56, 1] }}
              />
            </svg>
            <motion.h1 {...blurIn(0.25)}>{title}</motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
