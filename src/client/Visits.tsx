import { CalendarDays, ChevronRight, ReceiptText, Smartphone } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AccountSheet, FindVisitSheet } from "../components/AccountSheets";
import { Photo, Skeleton, useSkeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { branchById } from "../data/business";
import { serviceById, servicePhoto } from "../data/catalog";
import { accessOf, accountOf, useAppData } from "../data/store";
import type { Visit } from "../data/types";
import { visibleVisits } from "../lib/checkout";
import { fmtDay, fmtDayShort, fmtTime, money, parseLocal, plural } from "../lib/format";
import { badgeFor, isActive } from "../lib/visits";
import { spring } from "../motion";

type Tab = "visits" | "receipts";

export function Visits() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "visits";
  const loading = useSkeleton(550);
  const data = useAppData();
  const now = new Date();
  const [sheet, setSheet] = useState<"find" | "login" | null>(null);

  // Guests see visits booked or found on this phone; accounts see all of theirs.
  const account = accountOf(data);
  const visits = useMemo(() => visibleVisits(data.visits, accessOf(data)), [data]);
  const upcoming = visits.filter((v) => isActive(v) && parseLocal(v.start) >= now).sort((a, b) => a.start.localeCompare(b.start));
  const past = visits.filter((v) => !upcoming.includes(v));
  const receipts = useMemo(() => visits.flatMap((v) => v.payments.map((p) => ({ visit: v, payment: p }))).sort((a, b) => b.payment.at.localeCompare(a.payment.at)), [visits]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "visits", label: "Visits", count: upcoming.length },
    { id: "receipts", label: "Receipts" },
  ];

  return (
    <main className="screen is-narrow">
      <header className="page-title" style={{ paddingTop: 20 }}>
        <h1 className="t-h1">Visits</h1>
      </header>
      <div className="chips sticky-under-nav" role="tablist" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--ground)", paddingBlock: 8 }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`chip ${tab === t.id ? "is-active" : ""}`} onClick={() => setParams(t.id === "visits" ? {} : { tab: t.id }, { replace: true })}>
            {t.label}
            {t.count ? <span className="chip-count">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="stack gap-16" style={{ marginTop: 20 }} aria-busy="true">
          <Skeleton w="30%" h={20} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="inline" style={{ gap: 12 }}>
              <Skeleton w={60} h={60} r={7} />
              <div className="grow stack gap-8">
                <Skeleton w="60%" h={14} />
                <Skeleton w="80%" h={12} />
              </div>
              <Skeleton w={70} h={34} r={500} />
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.small}>
            {!account && (
              <div className="card card-pad between" style={{ gap: 12, marginTop: 12 }}>
                <span className="inline muted t-cap" style={{ gap: 8 }}>
                  <Smartphone size={16} />
                  {visits.length ? "Showing visits on this phone." : "Visits you book on this phone show here."}
                </span>
                <span className="inline t-cap" style={{ gap: 12 }}>
                  <button className="link hit" onClick={() => setSheet("find")}>
                    Find a booking
                  </button>
                  <button className="link hit" onClick={() => setSheet("login")}>
                    Log in
                  </button>
                </span>
              </div>
            )}

            {tab === "visits" &&
              (visits.length === 0 ? (
                <Empty
                  icon={<CalendarDays size={24} />}
                  title={account ? "No visits yet" : "No visits on this phone yet"}
                  body={account ? "Visits you book with the salon will show here." : "Booked on another phone? Find it with your booking number and WhatsApp number."}
                  cta={{ to: "/book", label: "Book a visit" }}
                />
              ) : (
                <div className="orders-sections">
                  {upcoming.length > 0 && <VisitSection title="Coming up" visits={upcoming} now={now} />}
                  {past.length > 0 && <VisitSection title="Past" visits={past} now={now} />}
                </div>
              ))}

            {tab === "receipts" &&
              (receipts.length === 0 ? (
                <Empty icon={<ReceiptText size={24} />} title="No receipts yet" body="Official receipts appear here after each payment." />
              ) : (
                <section className="section">
                  <h2 className="t-h3">All receipts</h2>
                  <div className="card list-card">
                    {receipts.map(({ visit, payment }) => (
                      <Link key={payment.id} to={`/visits/${visit.id}/receipts/${payment.id}`} className="row">
                        <span className="row-icon">
                          <ReceiptText size={18} strokeWidth={1.7} />
                        </span>
                        <span className="grow stack">
                          <span className="t-mono" style={{ fontSize: 13 }}>
                            {payment.receiptNo}
                          </span>
                          <span className="subtle t-cap">
                            {visit.number} · {fmtDay(new Date(payment.at))}
                          </span>
                        </span>
                        <span className="tabular" style={{ fontWeight: 500 }}>
                          {money(payment.amount)}
                        </span>
                        <ChevronRight size={18} className="row-chevron" />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
          </motion.div>
        </AnimatePresence>
      )}

      <FindVisitSheet open={sheet === "find"} onClose={() => setSheet(null)} />
      <AccountSheet open={sheet === "login"} onClose={() => setSheet(null)} mode="login" />
    </main>
  );
}

function VisitSection({ title, visits, now }: { title: string; visits: Visit[]; now: Date }) {
  const navigate = useNavigate();
  return (
    <section className="section">
      <h2 className="t-h3">{title}</h2>
      <div className="stack order-list-card">
        {visits.map((visit, i) => {
          const first = visit.items[0];
          const service = first ? serviceById(first.serviceId) : undefined;
          const extra = visit.items.length > 1 ? ` + ${visit.items.length - 1} more` : "";
          const start = parseLocal(visit.start);
          const live = isActive(visit) && start >= now;
          const badge = badgeFor(visit, now);
          return (
            <motion.div key={visit.id} className="order-row" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.small, delay: i * 0.05 }}>
              <Link to={`/visits/${visit.id}`} className="inline grow" style={{ gap: 12 }}>
                <Photo tone={service?.tone ?? "mist"} src={service ? servicePhoto(service) : undefined} sizes="60px" height={60} radius="var(--r-img)" markSize={22} className="order-thumb" />
                <span className="grow stack" style={{ minWidth: 0 }}>
                  <span className="t-title truncate">{(service?.name ?? "Visit") + extra}</span>
                  <span className="muted t-cap">
                    {fmtDayShort(start)} at {fmtTime(start)} · {branchById(visit.branchId)?.name}
                  </span>
                  <span className="subtle t-cap tabular">
                    {money(visit.total)} · {plural(visit.items.length, "service")} · {badge.label}
                  </span>
                </span>
              </Link>
              {live ? (
                <Button size="sm" onClick={() => navigate(`/visits/${visit.id}`)}>
                  View
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate(`/book?rebook=${visit.id}`)}>
                  Book again
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Empty({ icon, title, body, cta }: { icon: ReactNode; title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <p className="t-title">{title}</p>
      <p className="muted">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn btn-outline" style={{ marginTop: 8 }}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
