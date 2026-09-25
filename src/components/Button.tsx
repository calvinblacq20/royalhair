import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { spring } from "../motion";

export function Dots() {
  return (
    <span className="dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

type Variant = "outline" | "soft" | "dark" | "magenta" | "danger" | "ghost-dark";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "outline", size = "md", block, loading, icon, children, className = "", disabled, ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", block ? "btn-block" : "", className].filter(Boolean).join(" ");
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <Dots />
          <span className="sr-only">Working…</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

interface CtaProps {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  /** "dark" on light backgrounds (default); "magenta" on dark sections. */
  tone?: "dark" | "magenta";
}

// The logo's own pinks. Ink text on the bright fill is 6:1; white text on the deep one is 5.4:1.
const INK = "#1c1719";
const PINK = "#fc5aa3";
const DEEP = "#d10d58";
const textOn = (background: string) => (background === PINK ? INK : "#ffffff");

/**
 * Makro's primary CTA: a button with an arrow square.
 * On hover the colours swap and the arrow travels to the other side.
 */
export function Cta({ children, onClick, loading, disabled, type = "button", className = "", tone = "dark" }: CtaProps) {
  const [hover, setHover] = useState(false);
  const active = hover && !disabled && !loading;
  const base = tone === "magenta" ? DEEP : INK;
  const flip = tone === "magenta" ? INK : PINK;
  return (
    <motion.button
      type={type}
      className={`btn btn-cta ${active ? "is-reversed" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      whileTap={{ scale: 0.98 }}
      animate={{ backgroundColor: disabled ? "rgba(28,23,25,0.25)" : active ? flip : base, color: textOn(active ? flip : base) }}
      transition={spring.press}
      style={{ flexDirection: active ? "row-reverse" : "row" }}
    >
      <motion.span layout transition={spring.press} className="cta-square" style={{ background: active ? base : flip, color: active ? flip : base }}>
        {loading ? <Dots /> : <ArrowRight size={18} strokeWidth={1.8} />}
      </motion.span>
      <motion.span layout transition={spring.press}>
        {loading ? "Working…" : children}
      </motion.span>
    </motion.button>
  );
}
