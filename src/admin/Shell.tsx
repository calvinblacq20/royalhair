import { ArrowLeft, ArrowUpRight, Bell, CalendarClock, CalendarDays, ChartLine, ChevronRight, Ellipsis, LayoutDashboard, MapPin, Plus, Scissors, Search, Settings, Star, UserRoundCheck, Users, Wallet, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "../components/Bits";
import { AppIcon } from "../components/Brand";
import { Sheet } from "../components/Sheet";
import { BRANCHES, SALON } from "../data/business";
import type { AppData } from "../data/seed";
import { useAppData } from "../data/store";
import { rebookDueList, visitsOnDay } from "../lib/metrics";
import { parseLocal } from "../lib/format";
import { blurIn, spring } from "../motion";
import { scopeLabel, setBranchScope, useBranchScope, type BranchScope } from "./branch";
import { useFirstVisit } from "./hooks";

/* App shell for the salon side: sidebar on desktop, tab bar on phones, the sticky top bar and the page title block. */

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  end?: boolean;
  count?: (a: Attention) => number;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "The floor",
    items: [
      { to: "/admin", label: "Today", icon: LayoutDashboard, end: true },
      { to: "/admin/diary", label: "Diary", icon: CalendarDays, count: (a) => a.requests },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/clients", label: "Clients", icon: Users, count: (a) => a.rebook },
      { to: "/admin/staff", label: "Staff", icon: UserRoundCheck },
      { to: "/admin/reviews", label: "Reviews", icon: Star, count: (a) => a.reviews },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/admin/payments", label: "Payments", icon: Wallet },
      { to: "/admin/reports", label: "Reports", icon: ChartLine },
    ],
  },
  {
    label: "Salon",
    items: [
      { to: "/admin/services", label: "Services & prices", icon: Scissors },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export interface Attention {
  /** Online bookings nobody has confirmed yet. */
  requests: number;
  /** Clients still expected whose start time has gone. */
  late: number;
  /** Regulars due back within a fortnight with nothing booked. */
  rebook: number;
  reviews: number;
  total: number;
}

export function attentionOf(data: AppData, now: Date, scope: BranchScope): Attention {
  const inScope = (branchId: string) => scope === "all" || branchId === scope;
  const requests = data.visits.filter((v) => v.status === "requested" && inScope(v.branchId) && parseLocal(v.start) >= now).length;
  const late = visitsOnDay(data.visits, now)
    .filter((v) => inScope(v.branchId))
    .filter((v) => (v.status === "confirmed" || v.status === "requested") && parseLocal(v.start) < now).length;
  const rebook = rebookDueList(data.visits, now).filter((lead) => {
    const visit = data.visits.find((v) => v.id === lead.visitId);
    return visit ? inScope(visit.branchId) : false;
  }).length;
  const reviews = data.reviews.filter((r) => r.status === "pending" && inScope(r.branchId)).length;
  return { requests, late, rebook, reviews, total: requests + late + reviews };
}

function useAttention(): Attention {
  const data = useAppData();
  const scope = useBranchScope();
  return useMemo(() => attentionOf(data, new Date(), scope), [data, scope]);
}

export function AdminLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <div className="adm">
      <Sidebar />
      <div className="adm-main">
        <OfflineBanner />
        <Outlet />
      </div>
      <AdminTabBar />
    </div>
  );
}

function Sidebar() {
  const attention = useAttention();
  return (
    <aside className="adm-side desktop-only" aria-label="Salon admin">
      <Link to="/admin" className="adm-brand" aria-label={`${SALON.name} admin home`}>
        <AppIcon size={36} />
        <span className="adm-brand-text">
          <span className="t-title">{SALON.name}</span>
          <span className="t-cap muted">Salon admin</span>
        </span>
      </Link>
      <nav aria-label="Admin">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="adm-group">{group.label}</p>
            <div className="adm-nav">
              {group.items.map((item) => (
                <SideLink key={item.to} item={item} count={item.count?.(attention) ?? 0} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="adm-side-foot">
        <div className="divider" />
        <a className="adm-nav-item" href="#/" data-tip="View client app" aria-label="View client app">
          <ArrowUpRight size={20} strokeWidth={1.8} />
          <span className="adm-nav-label">View client app</span>
        </a>
        <div className="adm-owner">
          <Avatar name="Front Desk" size={34} />
          <span className="adm-owner-text stack">
            <span style={{ fontSize: 14, fontWeight: 500 }}>Front desk</span>
            <span className="t-cap muted">Demo login</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

function SideLink({ item, count }: { item: NavItem; count: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `adm-nav-item ${isActive ? "is-active" : ""}`}
      data-tip={item.label}
      aria-label={count ? `${item.label}, ${count} need attention` : item.label}
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="adm-nav-hl" className="adm-nav-hl" transition={spring.press} />}
          <Icon size={20} strokeWidth={isActive ? 2 : 1.8} />
          <span className="adm-nav-label">{item.label}</span>
          {count > 0 && <span className="chip-count adm-nav-count">{count}</span>}
        </>
      )}
    </NavLink>
  );
}

const TABS: NavItem[] = [
  { to: "/admin", label: "Today", icon: LayoutDashboard, end: true },
  { to: "/admin/diary", label: "Diary", icon: CalendarDays },
  { to: "/admin/clients", label: "Clients", icon: Users },
];

function AdminTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const attention = useAttention();
  const inMore = !["/admin", "/admin/diary", "/admin/clients", "/admin/walk-in"].includes(pathname) && !pathname.startsWith("/admin/clients/");
  const tab = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="adm-tab-hl" className="tab-hl" transition={spring.press} />}
          <item.icon size={22} strokeWidth={isActive ? 2 : 1.6} />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
  return (
    <div className="tabbar-wrap adm-tabbar mobile-only">
      <nav className="tabbar" aria-label="Admin">
        {tab(TABS[0]!)}
        {tab(TABS[1]!)}
        <Link to="/admin/walk-in" className="tab adm-tab-plus" aria-label="Add a walk-in">
          <span>
            <Plus size={24} strokeWidth={2} />
          </span>
        </Link>
        {tab(TABS[2]!)}
        <button className={`tab ${inMore ? "is-active" : ""}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          {inMore && <motion.span layoutId="adm-tab-hl" className="tab-hl" transition={spring.press} />}
          <Ellipsis size={22} strokeWidth={inMore ? 2 : 1.6} />
          <span>More</span>
        </button>
      </nav>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav className="list-card adm-sheet-nav" style={{ margin: "0 -20px" }} aria-label="More pages">
          {GROUPS.flatMap((g) => g.items)
            .filter((item) => !TABS.some((t) => t.to === item.to))
            .map((item) => {
              const count = item.count?.(attention) ?? 0;
              return (
                <Link key={item.to} to={item.to} className="row" onClick={() => setMoreOpen(false)}>
                  <span className="row-icon">
                    <item.icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="grow">{item.label}</span>
                  {count > 0 && <span className="chip-count">{count}</span>}
                  <ChevronRight size={18} className="row-chevron" />
                </Link>
              );
            })}
          <a href="#/" className="row" onClick={() => setMoreOpen(false)}>
            <span className="row-icon">
              <ArrowUpRight size={18} strokeWidth={1.8} />
            </span>
            <span className="grow">View client app</span>
          </a>
        </nav>
      </Sheet>
    </div>
  );
}

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <p className="adm-offline" role="status" style={{ marginTop: 12 }}>
      <WifiOff size={16} /> You're offline. Changes are saved on this device and nothing is lost.
    </p>
  );
}

/** Branch picker shown on every admin page. The desk usually runs one branch; the owner looks at all. */
export function BranchSwitch({ allowAll = true }: { allowAll?: boolean }) {
  const scope = useBranchScope();
  const [open, setOpen] = useState(false);
  const options: BranchScope[] = [...(allowAll ? ["all" as const] : []), ...BRANCHES.filter((b) => b.active).map((b) => b.id)];
  const shown = !allowAll && scope === "all" ? BRANCHES[0]!.id : scope;
  return (
    <>
      <button className="chip branch-switch" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <MapPin size={15} strokeWidth={1.8} />
        {scopeLabel(shown)}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Which branch?">
        <div className="stack gap-8">
          {options.map((option) => (
            <button
              key={option}
              className={`select-card ${option === shown ? "is-selected" : ""}`}
              onClick={() => {
                setBranchScope(option);
                setOpen(false);
              }}
              aria-pressed={option === shown}
            >
              <span className="grow stack gap-4">
                <span className="t-title">{scopeLabel(option)}</span>
                <span className="muted t-cap">
                  {option === "all" ? "Every branch together: the owner's view" : BRANCHES.find((b) => b.id === option)?.address}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export interface PageProps {
  title: string;
  /** Line under the title, e.g. the open status. */
  status?: ReactNode;
  /** The page's controls and its one primary action. */
  actions?: ReactNode;
  back?: { to: string; label: string };
  children: ReactNode;
  /** Title shown small in the bar once scrolled, when it differs from the page title. */
  barTitle?: string;
}

/** Sticky top bar + page title block, shared by every admin screen. */
export function AdminPage({ title, status, actions, back, children, barTitle }: PageProps) {
  const scrolled = useScrolled(back ? 8 : 40);
  const first = useFirstVisit(`title:${title}`);
  useEffect(() => {
    document.title = `${title} · ${SALON.name} admin`;
  }, [title]);
  return (
    <>
      <header className={`adm-bar ${scrolled ? "is-solid" : ""}`}>
        {back && (
          <Link to={back.to} className="adm-back">
            <ArrowLeft size={20} strokeWidth={1.8} />
            <span className="desktop-only">{back.label}</span>
          </Link>
        )}
        <span className="adm-bar-title" aria-hidden={!scrolled}>
          {barTitle ?? title}
        </span>
        <GlobalSearch />
        <AttentionButton />
      </header>
      <main className="adm-page">
        <div className="adm-title-row">
          <div style={{ minWidth: 0 }}>
            <motion.h1 {...(first ? blurIn() : {})}>{title}</motion.h1>
            {status && <div className="adm-status">{status}</div>}
          </div>
          {actions && <div className="adm-title-actions">{actions}</div>}
        </div>
        {children}
      </main>
    </>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/admin/clients?q=${encodeURIComponent(q)}` : "/admin/clients");
    setSheetOpen(false);
    setValue("");
    inputRef.current?.blur();
  };

  return (
    <>
      <form className="adm-search desktop-only" role="search" onSubmit={submit}>
        <Search size={17} strokeWidth={1.8} />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search clients…"
          aria-label="Search clients by name or phone"
          enterKeyHint="search"
        />
        <span className="adm-kbd" aria-hidden="true">
          {mac ? "⌘K" : "Ctrl K"}
        </span>
      </form>
      <button className="icon-btn is-plain mobile-only" onClick={() => setSheetOpen(true)} aria-label="Search">
        <Search size={21} strokeWidth={1.8} />
      </button>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Search">
        <form onSubmit={submit} className="stack gap-12" role="search">
          <input
            className="adm-input"
            type="search"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Name or phone number"
            aria-label="Search clients"
            enterKeyHint="search"
          />
          <button className="btn btn-dark btn-block" type="submit">
            Search clients
          </button>
        </form>
      </Sheet>
    </>
  );
}

function AttentionButton() {
  const [open, setOpen] = useState(false);
  const a = useAttention();
  const items = [
    { n: a.late, text: a.late === 1 ? "client is past their start time" : "clients are past their start time", to: "/admin", icon: CalendarClock },
    { n: a.requests, text: a.requests === 1 ? "online booking to confirm" : "online bookings to confirm", to: "/admin/diary", icon: CalendarDays },
    { n: a.rebook, text: a.rebook === 1 ? "regular is due back" : "regulars are due back", to: "/admin/clients?view=rebook", icon: Users },
    { n: a.reviews, text: a.reviews === 1 ? "review waiting for approval" : "reviews waiting for approval", to: "/admin/reviews", icon: Star },
  ].filter((i) => i.n > 0);
  return (
    <>
      <button
        className="icon-btn is-plain adm-bell"
        onClick={() => setOpen(true)}
        aria-label={a.total ? `${a.total} things need attention` : "Nothing needs attention"}
      >
        <Bell size={21} strokeWidth={1.8} />
        {a.total > 0 && <span className="adm-bell-dot">{a.total}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Needs attention">
        {items.length ? (
          <nav className="list-card" style={{ margin: "0 -20px" }}>
            {items.map((item) => (
              <Link key={item.text} to={item.to} className="row" onClick={() => setOpen(false)}>
                <span className="row-icon">
                  <item.icon size={18} strokeWidth={1.8} />
                </span>
                <span className="grow">
                  <b style={{ fontWeight: 600 }}>{item.n}</b> {item.text}
                </span>
                <ChevronRight size={18} className="row-chevron" />
              </Link>
            ))}
          </nav>
        ) : (
          <p className="muted">You're all caught up.</p>
        )}
      </Sheet>
    </>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <span className="empty-icon">{icon}</span>
      <p className="t-title">{title}</p>
      {body && (
        <p className="muted" style={{ maxWidth: "40ch" }}>
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
