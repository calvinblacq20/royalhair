import { ArrowLeft, ArrowRight, CalendarDays, Home, Search, UserRound, X } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BRANCHES, SALON } from "../data/business";
import { SALON_SIDE } from "../data/env";
import { accountOf, useAppData } from "../data/store";
import { formatGhPhone, telLink } from "../lib/contact";
import { isCalm, spring } from "../motion";
import { AppIcon, Wordmark } from "./Brand";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export const DESKTOP_QUERY = "(min-width: 810px)";

export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

interface TopBarProps {
  title?: string;
  back?: boolean | (() => void);
  close?: () => void;
  right?: ReactNode;
  /** Scroll distance before the bar turns solid and shows its title. */
  solidAfter?: number;
  alwaysSolid?: boolean;
  /** On wider screens (below the top nav) the bar becomes a plain "Back" row. */
  backRow?: string;
  className?: string;
}

export function TopBar({ title, back, close, right, solidAfter = 8, alwaysSolid, backRow, className = "" }: TopBarProps) {
  const navigate = useNavigate();
  const scrolled = useScrolled(solidAfter);
  const onBack = typeof back === "function" ? back : () => navigate(-1);
  return (
    <header className={`topbar ${scrolled || alwaysSolid ? "is-solid" : ""} ${backRow ? "is-backrow" : ""} ${className}`}>
      {back && (
        <button className="icon-btn is-plain topbar-back" onClick={onBack} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={1.8} />
          {backRow && <span className="topbar-backlabel desktop-only">{backRow}</span>}
        </button>
      )}
      <span className="topbar-title">{title}</span>
      {right}
      {close && (
        <button className="icon-btn is-plain" onClick={close} aria-label="Close">
          <X size={22} strokeWidth={1.8} />
        </button>
      )}
    </header>
  );
}

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/explore", label: "Explore", icon: Search },
  { to: "/visits", label: "Visits", icon: CalendarDays },
] as const;

/** Makro-style floating top navigation for tablet and desktop. */
export function DesktopNav() {
  const account = accountOf(useAppData());
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(false);

  // Turn the nav dark while it floats over a dark section, as in the reference.
  useEffect(() => {
    const probe = 40;
    const check = () => {
      let over = false;
      document.querySelectorAll<HTMLElement>('[data-nav-theme="dark"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom >= probe) over = true;
      });
      setDark(over);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [pathname]);

  return (
    <div className="desk-nav-wrap desktop-only">
      <nav className={`desk-nav ${dark ? "is-dark" : ""}`} aria-label="Main">
        <Link to="/" className="desk-brand" aria-label={`${SALON.name} home`}>
          <AppIcon size={34} />
          <span>{SALON.name}</span>
        </Link>
        <div className="desk-links">
          {TABS.map(({ to, label, ...rest }) => (
            <NavLink key={to} to={to} end={"end" in rest} className={({ isActive }) => `desk-link ${isActive ? "is-active" : ""}`}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="desk-link-hl" className="desk-link-hl" transition={spring.press} />}
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        <div className="inline" style={{ gap: 10 }}>
          <button className="nav-cta" onClick={() => navigate("/book")}>
            <span className="sq">
              <ArrowRight size={16} strokeWidth={1.8} />
            </span>
            Book now
          </button>
          <NavLink to="/profile" className={({ isActive }) => `desk-avatar ${isActive ? "is-active" : ""}`} aria-label="Profile">
            {account ? account.name[0] : <UserRound size={17} strokeWidth={1.8} />}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

/**
 * Footer that sits underneath the page: the content lifts away to reveal it,
 * and the giant wordmark rises as the reveal completes (Makro curtain).
 */
export function DesktopFooter() {
  const ref = useRef<HTMLElement>(null);
  const calm = isCalm();
  const { scrollY } = useScroll();
  const height = useRef(1);
  const pageHeight = useRef(0);
  const viewportHeight = useRef(0);

  // Heights are measured on resize and cached: reading them on every scroll frame forces a re-layout.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      height.current = el.offsetHeight || 1;
      pageHeight.current = document.documentElement.scrollHeight;
      viewportHeight.current = window.innerHeight;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // 0 while the footer is covered, 1 once the page has fully lifted off it.
  const reveal = useTransform(scrollY, (y) => {
    const remaining = pageHeight.current - (y + viewportHeight.current);
    return Math.min(1, Math.max(0, 1 - remaining / height.current));
  });
  const wordY = useTransform(reveal, [0, 1], ["45%", "0%"]);
  const wordOpacity = useTransform(reveal, [0, 0.6], [0.2, 1]);
  const innerY = useTransform(reveal, [0, 1], [40, 0]);

  return (
    <footer ref={ref} className="desk-footer desktop-only">
      <motion.div className="desk-footer-inner" style={calm ? undefined : { y: innerY }}>
        <div className="stack gap-12" style={{ maxWidth: 260 }}>
          <Wordmark width={180} />
          <p className="muted">Barbershop, salon and spa, with branches at West Hills Mall, Airport and Kumasi.</p>
        </div>
        <div className="desk-footer-col">
          <p className="subtle t-cap">Salon</p>
          <Link to="/">Home</Link>
          <Link to="/explore">Services & prices</Link>
          <Link to="/visits">My visits</Link>
          <Link to="/book">Book a visit</Link>
        </div>
        <div className="desk-footer-col">
          <p className="subtle t-cap">Contact</p>
          <a href={SALON.whatsappBusiness} target="_blank" rel="noreferrer">WhatsApp</a>
          <a href={telLink(SALON.phone)}>{formatGhPhone(SALON.phone)}</a>
          <a href={SALON.instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href={SALON.tiktok} target="_blank" rel="noreferrer">TikTok</a>
        </div>
        <div className="desk-footer-col">
          <p className="subtle t-cap">Branches</p>
          {BRANCHES.filter((b) => b.active).map((b) => (
            <Link key={b.id} to="/branches">
              {b.name}
            </Link>
          ))}
        </div>
      </motion.div>
      <motion.div className="desk-wordmark" aria-hidden="true" style={calm ? { opacity: wordOpacity } : { y: wordY, opacity: wordOpacity }}>
        {SALON.name}
      </motion.div>
      <p className="desk-copy t-cap">
        © {new Date().getFullYear()} {SALON.name} Salon &amp; Spa · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Booking terms</Link>
        {SALON_SIDE && " · Demo build"}
      </p>
    </footer>
  );
}

export function TabBar() {
  const account = accountOf(useAppData());
  return (
    <div className="tabbar-wrap mobile-only">
      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink key={to} to={to} end={"end" in rest} className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="tab-hl" className="tab-hl" transition={spring.press} />}
                <Icon size={22} strokeWidth={isActive ? 2 : 1.6} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <NavLink to="/profile" className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="tab-hl" className="tab-hl" transition={spring.press} />}
              {account ? (
                <span className="tab-avatar" aria-hidden="true">
                  {account.name[0]}
                </span>
              ) : (
                <UserRound size={22} strokeWidth={isActive ? 2 : 1.6} />
              )}
              <span>Profile</span>
            </>
          )}
        </NavLink>
      </nav>
    </div>
  );
}
