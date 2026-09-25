import { ArrowLeft, Ban, CalendarPlus, Check, ChevronRight, CircleAlert, Clock, Lock, MessageCircle, Navigation, Phone, ReceiptText, RefreshCw, RotateCcw, Store } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AccountSheet, FindVisitSheet } from "../components/AccountSheets";
import { CalendarSheet } from "../components/ActionSheets";
import { Badge, Photo, Skeleton, useSkeleton } from "../components/Bits";
import { Button } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { MapCard } from "../components/MapCard";
import { useNotify } from "../components/Notify";
import { SuccessScreen } from "../components/Overlays";
import { PaystackSheet } from "../components/Paystack";
import { Sheet } from "../components/Sheet";
import { branchById, POLICIES, SALON } from "../data/business";
import { ROLE_LABEL, serviceById } from "../data/catalog";
import { accessOf, accountOf, actions, customerById, useAppData, type OnlinePayment } from "../data/store";
import type { Visit } from "../data/types";
import { slotsFor } from "../lib/booking";
import { amountDue, canViewVisit } from "../lib/checkout";
import { formatGhPhone, mapsLinks, telLink, whatsappLink } from "../lib/contact";
import { addDays, fmtDate, fmtDayLong, fmtDayShort, fmtTime, money, parseLocal, plural, startOfDay } from "../lib/format";
import { durationLabel } from "../lib/pricing";
import { STAGES, STATUS_LABEL, badgeFor, balanceDue, canCancel, isActive, isLateCancel, nextAction, paidTotal, stageIndex, whenPhrase } from "../lib/visits";
import { enter, spring } from "../motion";

export function VisitDetail() {
  const { visitId } = useParams();
  const data = useAppData();
  const loading = useSkeleton(600);
  const visit = data.visits.find((v) => v.id === visitId);

  if (loading) return <DetailSkeleton />;
  // Visits open only on the phone they were booked or found on, or for the account they belong to.
  if (visit && !canViewVisit(visit, accessOf(data))) return <NotOnThisPhone />;
  if (!visit) {
    return (
      <main className="screen">
        <TopBar back alwaysSolid />
        <div className="empty" style={{ marginTop: "12vh" }}>
          <span className="empty-icon">
            <CircleAlert size={24} />
          </span>
          <p className="t-title">We couldn't find that booking</p>
          <p className="muted">It may have been removed when the demo was reset.</p>
          <Link to="/visits" className="btn btn-outline" style={{ marginTop: 8 }}>
            See my visits
          </Link>
        </div>
      </main>
    );
  }
  return <VisitView visit={visit} />;
}

function NotOnThisPhone() {
  const [findOpen, setFindOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <main className="screen">
      <TopBar back alwaysSolid />
      <div className="empty" style={{ marginTop: "12vh" }}>
        <span className="empty-icon">
          <Lock size={24} />
        </span>
        <p className="t-title">This booking isn't on this phone</p>
        <p className="muted" style={{ maxWidth: "38ch" }}>
          To keep bookings private, open it with the booking number and the WhatsApp number you booked with, or log in to your account.
        </p>
        <div className="inline" style={{ gap: 8, marginTop: 8 }}>
          <Button variant="dark" onClick={() => setFindOpen(true)}>
            Find my booking
          </Button>
          <Button onClick={() => setLoginOpen(true)}>Log in</Button>
        </div>
      </div>
      <FindVisitSheet open={findOpen} onClose={() => setFindOpen(false)} />
      <AccountSheet open={loginOpen} onClose={() => setLoginOpen(false)} mode="login" />
    </main>
  );
}

function DetailSkeleton() {
  return (
    <main className="screen" aria-busy="true">
      <Skeleton w="calc(100% + 32px)" h={240} r={0} style={{ marginInline: -16 }} />
      <div className="stack gap-12" style={{ marginTop: 20 }}>
        <Skeleton w={110} h={28} r={500} />
        <Skeleton w="70%" h={30} />
        <Skeleton w="35%" h={14} />
        <Skeleton h={150} r={8} style={{ marginTop: 12 }} />
        <Skeleton h={180} r={8} />
      </div>
    </main>
  );
}

function VisitView({ visit }: { visit: Visit }) {
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const now = new Date();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelledShow, setCancelledShow] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const customer = customerById(data, visit.customerId);
  const account = accountOf(data);
  const branch = branchById(visit.branchId);
  const staff = data.staff.find((s) => s.id === visit.staffId);

  const first = visit.items[0];
  const service = first ? serviceById(first.serviceId) : undefined;
  const title = service ? `${service.name}${visit.items.length > 1 ? ` + ${visit.items.length - 1} more` : ""}` : "Visit";
  const start = parseLocal(visit.start);
  const due = amountDue(visit);
  const action = nextAction(visit, now, due.amount);
  const badge = badgeFor(visit, now);
  const balance = balanceDue(visit);
  const paid = paidTotal(visit);
  const live = isActive(visit);
  const upcoming = live && start > now;
  const maps = mapsLinks(`${branch?.name ?? SALON.name} ${branch?.plusCode ?? branch?.address ?? ""}`);
  const phone = branch?.phone ?? SALON.phone;
  const waText = `Hi ${SALON.name}, it's ${customer?.name ?? "a client"} about booking ${visit.number} (${title}).`;
  const payLabel = due.label === "deposit" ? `Pay ${money(due.amount)} deposit` : `Pay ${money(due.amount)} balance`;
  const late = isLateCancel(visit, now, POLICIES.cancelWindowHours);

  const pay = useCallback(
    (payment: OnlinePayment): string | null => {
      const result = actions.pay(visit.id, payment);
      if ("error" in result) return result.error;
      setPayOpen(false);
      window.setTimeout(() => notify("Payment received", `Receipt ${result.payment.receiptNo} is ready${customer?.email ? ` and on its way to ${customer.email}` : ""}.`), 400);
      return null;
    },
    [visit.id, notify, customer?.email],
  );
  const calendarEvent = upcoming
    ? {
        title: `${title} at ${SALON.name}`,
        start,
        minutes: visit.minutes,
        location: branch?.address ?? "",
        details: `Booking ${visit.number} with ${staff?.name ?? "our team"}. Please arrive 10 minutes early.`,
      }
    : null;

  const runAction = () => {
    switch (action?.cta?.kind) {
      case "whatsapp":
        window.open(whatsappLink(phone, waText), "_blank", "noopener");
        break;
      case "pay":
        setPayOpen(true);
        break;
      case "calendar":
        setCalendarOpen(true);
        break;
      case "directions":
        setDirectionsOpen(true);
        break;
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    await new Promise((r) => window.setTimeout(r, 900));
    actions.cancel(visit.id);
    setCancelling(false);
    setCancelOpen(false);
    setCancelledShow(true);
  };

  const onCancelledDone = useCallback(() => {
    setCancelledShow(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => notify("Booking cancelled", `${visit.number} has been cancelled. Message us if you change your mind.`), 500);
  }, [notify, visit.number]);

  const statusTimes = new Map(visit.history.map((h) => [h.status, h.at]));
  const current = stageIndex(visit.status);

  // Rendered under the banner on phones and tablets, and in the side column on desktop.
  const actionsNav = (className: string) => (
    <nav className={`card list-card ${className}`} style={{ marginTop: 12 }} aria-label="Booking actions">
      {upcoming ? (
        <>
          {calendarEvent && (
            <button className="row" onClick={() => setCalendarOpen(true)}>
              <span className="row-icon is-pink">
                <CalendarPlus size={18} strokeWidth={1.7} />
              </span>
              <span className="grow stack">
                <span>Add visit to calendar</span>
                <span className="subtle t-cap">{`${fmtDayShort(start)} at ${fmtTime(start)}`}</span>
              </span>
              <ChevronRight size={18} className="row-chevron" />
            </button>
          )}
          <button className="row" onClick={() => setDirectionsOpen(true)}>
            <span className="row-icon">
              <Navigation size={18} strokeWidth={1.7} />
            </span>
            <span className="grow">Get directions</span>
            <ChevronRight size={18} className="row-chevron" />
          </button>
        </>
      ) : (
        <Link className="row" to={`/book?rebook=${visit.id}`}>
          <span className="row-icon is-pink">
            <RotateCcw size={18} strokeWidth={1.7} />
          </span>
          <span className="grow">Book again</span>
          <ChevronRight size={18} className="row-chevron" />
        </Link>
      )}
      <a className="row" href={whatsappLink(phone, waText)} target="_blank" rel="noreferrer">
        <span className="row-icon">
          <MessageCircle size={18} strokeWidth={1.7} />
        </span>
        <span className="grow">Message on WhatsApp</span>
        <ChevronRight size={18} className="row-chevron" />
      </a>
      <Link className="row" to="/branches">
        <span className="row-icon">
          <Store size={18} strokeWidth={1.7} />
        </span>
        <span className="grow">Branch details</span>
        <ChevronRight size={18} className="row-chevron" />
      </Link>
    </nav>
  );

  return (
    <main className="screen">
      <TopBar back title={title} solidAfter={190} backRow="Back" />

      <div className="detail-hero">
        <Photo tone={service?.tone ?? "mist"} src={service?.photo} alt={title} sizes="(min-width: 1024px) 1200px, 100vw" height={250} radius={0} markSize={110} />
        <div className="scrim" />
        <button className="icon-btn mobile-only" style={{ left: 16 }} onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>
        <h1>{title}</h1>
      </div>

      <motion.div className="detail-body" {...enter(24)}>
        <div>
          <Badge tone={badge.tone} icon={visit.status === "cancelled" || visit.status === "no-show" ? <Ban size={14} /> : badge.tone === "gold" ? <CircleAlert size={14} /> : <Check size={14} />}>
            {badge.label}
          </Badge>
        </div>
        <h2 className="t-h2">{fmtDayLong(start)} at {fmtTime(start)}</h2>
        <p className="muted">
          {visit.number} · {branch?.name} · with {staff?.name ?? "our team"} · {durationLabel(visit.minutes)}
        </p>

        {action && (
          <motion.div className={`banner ${badge.tone === "gold" || (visit.status === "requested" && paid === 0) ? "is-sand" : ""}`} style={{ marginTop: 12 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.small, delay: 0.1 }}>
            <p className="t-title">{action.title}</p>
            <p className="muted">{action.body}</p>
            {action.cta && (
              <button className="banner-cta" onClick={runAction}>
                {action.cta.label} <ChevronRight size={16} />
              </button>
            )}
          </motion.div>
        )}

        {!account && customer && !customer.hasAccount && (
          <motion.section className="account-card" style={{ marginTop: 12 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.small, delay: 0.15 }}>
            <p className="t-title">Keep this booking on any phone</p>
            <p className="muted">Optional. Save an account with {formatGhPhone(customer.phone)} and your visits and receipts go wherever you log in.</p>
            <div className="account-card-actions">
              <Button variant="magenta" size="sm" onClick={() => setAccountOpen(true)}>
                Create account
              </Button>
            </div>
          </motion.section>
        )}

        {actionsNav("lt-desk")}

        <div className="detail-layout">
          <div className="detail-main" style={{ minWidth: 0 }}>
            {visit.status !== "cancelled" && visit.status !== "no-show" && (
              <section className="section">
                <h2 className="t-h3">Progress</h2>
                <div className="card card-pad timeline">
                  {STAGES.map((stage, i) => {
                    const done = i < current || visit.status === "done";
                    const isCurrent = i === current && visit.status !== "done";
                    const at = statusTimes.get(stage);
                    return (
                      <motion.div key={stage} className={`tl-step ${done ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.small, delay: 0.05 * i }}>
                        <span className="tl-dot" aria-hidden="true">
                          {done && <Check size={13} strokeWidth={3} />}
                        </span>
                        <span className="tl-label">
                          {STATUS_LABEL[stage]}
                          {isCurrent && <span className="sr-only"> (current step)</span>}
                        </span>
                        <span className="subtle t-cap" style={{ lineHeight: "24px" }}>
                          {at ? fmtDayShort(new Date(at)) : stage === "arrived" ? fmtTime(start) : ""}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="section">
              <h2 className="t-h3">Overview</h2>
              <div className="card card-pad stack gap-12">
                {visit.items.map((item) => {
                  const s = serviceById(item.serviceId);
                  return (
                    <div key={item.id} className="kv">
                      <span className="stack">
                        <span>{s?.name ?? "Service"}</span>
                        <span className="subtle t-cap">
                          {durationLabel(item.minutes)} with {staff?.name.split(" ")[0] ?? "our team"}
                          {staff ? ` · ${ROLE_LABEL[staff.role]}` : ""}
                        </span>
                      </span>
                      <span>{money(item.price)}</span>
                    </div>
                  );
                })}
                <div className="divider" style={{ margin: 0 }} />
                <div className="kv kv-total">
                  <span>Total</span>
                  <span>{money(visit.total)}</span>
                </div>
                <div className="kv muted">
                  <span>Paid</span>
                  <span>{money(paid)}</span>
                </div>
                {visit.status !== "cancelled" && (
                  <div className="kv" style={{ fontWeight: 500 }}>
                    <span>Balance</span>
                    <span>{money(balance)}</span>
                  </div>
                )}
                {visit.status !== "cancelled" && visit.status !== "no-show" && due.amount > 0 && (
                  <>
                    <Button variant="dark" block onClick={() => setPayOpen(true)} style={{ marginTop: 4 }}>
                      {payLabel}
                    </Button>
                    <p className="inline t-cap subtle" style={{ justifyContent: "center", gap: 6 }}>
                      <Lock size={13} /> Mobile Money or card through Paystack
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="section">
              <h2 className="t-h3">Receipts</h2>
              {visit.payments.length ? (
                <div className="card list-card">
                  {visit.payments.map((p) => (
                    <Link key={p.id} className="row" to={`/visits/${visit.id}/receipts/${p.id}`}>
                      <span className="row-icon">
                        <ReceiptText size={18} strokeWidth={1.7} />
                      </span>
                      <span className="grow stack">
                        <span>{p.kind === "deposit" ? "Deposit receipt" : p.kind === "final" ? "Final payment receipt" : "Part payment receipt"}</span>
                        <span className="t-cap" style={{ color: "var(--warning-ink)" }}>
                          <span className="t-mono">{p.receiptNo}</span> · {fmtDate(new Date(p.at))}
                        </span>
                      </span>
                      <span className="tabular">{money(p.amount)}</span>
                      <ChevronRight size={18} className="row-chevron" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="card card-pad muted">Your official receipt appears here after each payment.</p>
              )}
            </section>

            <section className="section">
              <h2 className="t-h3">More details</h2>
              <div className="card">
                <div className="card-pad stack gap-4">
                  <p className="t-title">Cancellation policy</p>
                  <p className="muted">Free to cancel or move up to {POLICIES.cancelWindowHours} hours before. After that, or if you don't come, the deposit is kept.</p>
                </div>
                {live && (
                  <div className="list-card" style={{ paddingTop: 0 }}>
                    {canCancel(visit) ? (
                      <>
                        <button className="row" onClick={() => setMoveOpen(true)}>
                          <RefreshCw size={18} strokeWidth={1.7} />
                          <span className="grow">Change the time</span>
                          <ChevronRight size={18} className="row-chevron" />
                        </button>
                        <button className="row" onClick={() => setCancelOpen(true)}>
                          <Ban size={18} strokeWidth={1.7} />
                          <span className="grow">Cancel booking</span>
                          <ChevronRight size={18} className="row-chevron" />
                        </button>
                      </>
                    ) : (
                      <p className="row muted t-body">You've checked in, so this visit can't be changed in the app. Ask at the front desk.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="card card-pad stack gap-4">
                <p className="t-title">Important info</p>
                <p className="muted">Please arrive 10 minutes early. "From" prices are confirmed at the chair before we start.</p>
              </div>
              {visit.notes && (
                <div className="card card-pad stack gap-4">
                  <p className="t-title">Your note</p>
                  <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {visit.notes}
                  </p>
                </div>
              )}
            </section>

            {branch && (
              <section className="section lt-desk">
                <h2 className="t-h3">Getting there</h2>
                <MapCard branch={branch} now={now} />
              </section>
            )}

            <p className="t-cap subtle" style={{ textAlign: "center", padding: "24px 0 8px" }}>
              Booking ref: <span className="t-mono">{visit.number}</span>
            </p>
          </div>

          <aside className="detail-aside desk" aria-label="Booking actions and location">
            {actionsNav("")}
            {branch && <MapCard branch={branch} now={now} />}
          </aside>
        </div>
      </motion.div>

      <CalendarSheet open={calendarOpen} onClose={() => setCalendarOpen(false)} event={calendarEvent} uid={`${visit.number}-visit`} />
      <PaystackSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={due.amount}
        label={`${due.label === "deposit" ? "Deposit" : "Balance"} for ${visit.number}`}
        email={customer?.email ?? ""}
        phone={customer?.phone ?? ""}
        onPaid={pay}
      />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} mode="create" defaultName={customer?.name} defaultPhone={customer ? formatGhPhone(customer.phone) : ""} />
      <MoveSheet open={moveOpen} onClose={() => setMoveOpen(false)} visit={visit} onMoved={(at) => notify("Booking moved", `Now ${fmtDayShort(parseLocal(at))} at ${fmtTime(parseLocal(at))}.`)} />

      <Sheet open={directionsOpen} onClose={() => setDirectionsOpen(false)} title="Get directions">
        <div className="stack gap-12">
          {branch?.landmark && <p className="muted">{branch.landmark}</p>}
          <a className="btn btn-outline btn-block" href={maps.google} target="_blank" rel="noreferrer" onClick={() => setDirectionsOpen(false)}>
            Open in Google Maps
          </a>
          <a className="btn btn-outline btn-block" href={maps.apple} target="_blank" rel="noreferrer" onClick={() => setDirectionsOpen(false)}>
            Open in Apple Maps
          </a>
        </div>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Are you sure you want to cancel?">
        <div className="stack gap-16">
          <div className="card" style={{ display: "flex", overflow: "hidden", background: "var(--ground)", boxShadow: "none" }}>
            <Photo tone={service?.tone ?? "mist"} src={service?.photo} sizes="80px" height={96} radius={0} markSize={30} className="order-thumb" />
            <div className="card-pad stack" style={{ padding: 12 }}>
              <p className="t-title">{title}</p>
              <p className="muted t-cap">{whenPhrase(visit, now)}</p>
              <p className="muted t-cap">
                {money(visit.total)} · {visit.number}
              </p>
            </div>
          </div>
          {paid > 0 && (
            <p className="info-line">
              <ReceiptText size={16} />
              <span>
                {late
                  ? `This visit is less than ${POLICIES.cancelWindowHours} hours away, so your ${money(paid)} deposit is kept. Message the branch if something came up.`
                  : `Your ${money(paid)} deposit is refunded through Paystack to the Mobile Money number or card you paid with.`}
              </span>
            </p>
          )}
          <p className="muted">Not sure? Talk to {branch?.name ?? SALON.name} first.</p>
          <div className="inline" style={{ gap: 8 }}>
            <a className="btn btn-outline btn-sm" href={telLink(phone)}>
              <Phone size={15} /> Call
            </a>
            <a className="btn btn-outline btn-sm" href={whatsappLink(phone, waText)} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <Button block onClick={() => setCancelOpen(false)}>
              Go back
            </Button>
            <Button variant="danger" block loading={cancelling} onClick={confirmCancel}>
              Yes, cancel
            </Button>
          </div>
        </div>
      </Sheet>

      <SuccessScreen open={cancelledShow} title="Booking cancelled" tone="cancel" onDone={onCancelledDone} />
    </main>
  );
}

/** Same services, same stylist, another time. The double-booking guard in the store still has the last word. */
function MoveSheet({ open, onClose, visit, onMoved }: { open: boolean; onClose: () => void; visit: Visit; onMoved: (start: string) => void }) {
  const data = useAppData();
  const now = new Date();
  const branch = branchById(visit.branchId);
  const staff = data.staff.find((s) => s.id === visit.staffId);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  if (!branch || !staff) return null;
  const day = addDays(startOfDay(now), offset);
  const slots = slotsFor({ branch, staff, day, minutes: visit.minutes, visits: data.visits.filter((v) => v.id !== visit.id), now }, { stepMinutes: 15, gapMinutes: POLICIES.turnaroundMinutes });

  return (
    <Sheet open={open} onClose={onClose} title="Change the time">
      <div className="stack gap-12">
        <p className="muted">
          Same services with {staff.name} at {branch.name}. Pick another slot.
        </p>
        <div className="chips" role="group" aria-label="Choose a day">
          {Array.from({ length: 14 }, (_, i) => i).map((i) => (
            <button key={i} className={`chip ${i === offset ? "is-active" : ""}`} onClick={() => setOffset(i)} aria-pressed={i === offset}>
              {fmtDayShort(addDays(startOfDay(now), i))}
            </button>
          ))}
        </div>
        {slots.length === 0 ? (
          <p className="muted inline" style={{ gap: 8 }}>
            <Clock size={16} /> Nothing free that day with {staff.name.split(" ")[0]}. Try another, or message the branch.
          </p>
        ) : (
          <div className="slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {slots.map((slot) => (
              <button
                key={slot}
                className="slot"
                style={{ justifyContent: "center", paddingInline: 0 }}
                onClick={() => {
                  const result = actions.reschedule(visit.id, slot);
                  if ("error" in result) {
                    setError(result.error);
                    return;
                  }
                  setError("");
                  onClose();
                  onMoved(slot);
                }}
              >
                {fmtTime(parseLocal(slot))}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="t-cap" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <p className="subtle t-cap">{plural(slots.length, "time")} free on {fmtDayShort(day)}.</p>
      </div>
    </Sheet>
  );
}
