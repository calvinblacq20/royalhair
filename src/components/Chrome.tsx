import { ArrowLeft, ArrowRight, CalendarDays, Home, Scissors, UserRound, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BRANCHES, SALON } from "../data/business";
import { accountOf, useAppData } from "../data/store";
import { formatGhPhone, telLink } from "../lib/contact";
import { spring } from "../motion";
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
  { to: "/services", label: "Services", icon: Scissors },
  { to: "/visits", label: "Visits", icon: CalendarDays },
] as const;

/** Floating top navigation for tablet and desktop. */
export function DesktopNav() {
  const account = accountOf(useAppData());
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(false);

  // Turn the nav dark while it floats over a dark section.
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

/** Footer that sits underneath the page and is revealed as the content lifts away. */
export function DesktopFooter() {
  return (
    <footer className="desk-footer desktop-only">
      <div className="desk-footer-inner">
        <div className="stack gap-12" style={{ maxWidth: 260 }}>
          <Wordmark width={180} />
          <p className="muted">Barbershop, salon and spa across three branches in Accra and Kumasi.</p>
        </div>
        <div className="desk-footer-col">
          <p className="subtle t-cap">Salon</p>
          <Link to="/">Home</Link>
          <Link to="/services">Services &amp; prices</Link>
          <Link to="/visits">My visits</Link>
          <Link to="/book">Book a visit</Link>
        </div>
        <div className="desk-footer-col">
          <p className="subtle t-cap">Contact</p>
          <a href={SALON.whatsappBusiness} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a href={telLink(SALON.phone)}>{formatGhPhone(SALON.phone)}</a>
          <a href={SALON.instagram} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href={SALON.tiktok} target="_blank" rel="noreferrer">
            TikTok
          </a>
        </div>
        <div className="desk-footer-col">
          <p className="subtle t-cap">Branches</p>
          {BRANCHES.filter((b) => b.active).map((branch) => (
            <Link key={branch.id} to="/branches">
              {branch.name}
            </Link>
          ))}
        </div>
      </div>
      <div className="desk-wordmark" aria-hidden="true">
        {SALON.name}
      </div>
      <p className="desk-copy t-cap">
        © {new Date().getFullYear()} {SALON.name} · Demo build
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
