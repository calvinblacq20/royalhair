import crownPath from "../../brand/crown-path.txt?raw";

/*
 * Every logo asset comes from the one file the salon sent (brand/logo-original.png), built by
 * scripts/build_logo.py. The crown is traced to a vector for small single-colour marks; the glossy
 * artwork itself is used wherever the logo appears at size.
 */
const CROWN_VIEWBOX = "0 0 677 358";
const CROWN_RATIO = 358 / 677;
/** Height over width of the built image files (public/brand). */
const CROWN_IMAGE_RATIO = 278 / 512;
const WORDMARK_RATIO = 313 / 960;

/** The crown as a flat vector in the current text colour: photo fallbacks, loading states. */
export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox={CROWN_VIEWBOX}
      width={size}
      height={size * CROWN_RATIO}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="currentColor"
    >
      <path fillRule="evenodd" d={crownPath.trim()} />
    </svg>
  );
}

/** The glossy crown on the brand black, as on their Instagram avatar. */
export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.26 }}>
      <img src="/brand/crown.webp" alt="" width={Math.round(size * 0.72)} height={Math.round(size * 0.72 * CROWN_IMAGE_RATIO)} decoding="async" />
    </span>
  );
}

/**
 * The full "ROYAL_HAIR" logo. "light" has the glow removed so it sits cleanly on the cream page;
 * "dark" keeps the glow from the original artwork, which only reads well on black.
 */
export function Wordmark({ width = 200, on = "light", className = "", eager }: { width?: number; on?: "light" | "dark"; className?: string; eager?: boolean }) {
  const light = on === "light";
  return (
    <img
      className={`wordmark ${className}`}
      src={light ? "/brand/logo-wordmark.webp" : "/brand/logo-glow.webp"}
      srcSet={light ? "/brand/logo-wordmark.webp 960w, /brand/logo-wordmark@2x.webp 1920w" : undefined}
      sizes={`${width}px`}
      width={width}
      height={Math.round(width * WORDMARK_RATIO)}
      alt="Royal Hair"
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
    />
  );
}
