import { Star } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import photoManifest from "../data/photo-manifest.json";
import type { Tone } from "../data/types";
import type { BadgeTone } from "../lib/visits";
import { motionMode } from "../motion";
import { LogoMark } from "./Brand";
import { Reveal } from "./Reveal";

export function Skeleton({ w = "100%", h = 14, r = 8, style, className = "" }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties; className?: string }) {
  return <span className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

/** Shows a skeleton for a moment on mount, like the reference app does on every screen. */
export function useSkeleton(ms = 550): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), motionMode() === "full" ? ms : 0);
    return () => window.clearTimeout(timer);
  }, [ms]);
  return loading;
}

type ManifestEntry = { sm: number; w: number; md?: number; w2x: number; h: number };
const MANIFEST = photoManifest as Record<string, ManifestEntry>;

/** Builds a width-based srcset (small / standard / phone-sharp / full-resolution) for photos made by scripts/build_photos.py. */
export function photoSrcSet(src?: string): string | undefined {
  const match = src?.match(/^\/photos\/([\w-]+)\.webp$/);
  const name = match?.[1];
  const entry = name ? MANIFEST[name] : undefined;
  if (!name || !entry) return undefined;
  const byWidth = new Map<number, string>([
    [entry.sm, `/photos/${name}-sm.webp`],
    [entry.w, `/photos/${name}.webp`],
    ...(entry.md ? ([[entry.md, `/photos/${name}-md.webp`]] as const) : []),
    [entry.w2x, `/photos/${name}@2x.webp`],
  ]);
  return [...byWidth].map(([width, url]) => `${url} ${width}w`).join(", ");
}

export function Photo({ tone, src, alt = "", ratio, height, radius, markSize = 48, position = "center 25%", eager, sizes = "(min-width: 810px) 33vw, 50vw", children, className = "" }: {
  tone: Tone;
  src?: string;
  alt?: string;
  ratio?: string;
  height?: number | string;
  radius?: number | string;
  markSize?: number;
  /** object-position, biased upward so faces and collars stay in frame. */
  position?: string;
  eager?: boolean;
  /** How wide the photo renders, so the browser downloads the right resolution. */
  sizes?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div className={`photo tone-${tone} ${showImage ? "has-img" : ""} ${className}`} style={{ aspectRatio: ratio, height, borderRadius: radius }}>
      {showImage ? (
        <img
          src={src}
          srcSet={photoSrcSet(src)}
          sizes={sizes}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : undefined}
          className={loaded ? "is-loaded" : ""}
          style={{ objectPosition: position }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <LogoMark size={markSize} className="photo-mark" />
      )}
      {children}
    </div>
  );
}

export function Badge({ tone, icon, children }: { tone: BadgeTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`badge is-${tone}`}>
      <span className="badge-well" aria-hidden="true">
        {icon}
      </span>
      {children}
    </span>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} strokeWidth={0} fill={i < Math.round(value) ? "currentColor" : "rgba(36,36,38,0.15)"} />
      ))}
    </span>
  );
}

export function Avatar({ name, size = 40, soft }: { name: string; size?: number; soft?: boolean }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span className={`avatar ${soft ? "is-soft" : ""}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {letters}
    </span>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <Reveal as="h2" look="focus" className="t-h3">
        {title}
      </Reveal>
      {action}
    </div>
  );
}
