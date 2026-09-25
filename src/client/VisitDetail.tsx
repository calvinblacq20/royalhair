import { CalendarPlus, MapPin, MessageCircle, Navigation, Phone, Receipt as ReceiptIcon, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/Bits";
import { Button, Cta } from "../components/Button";
import { TopBar } from "../components/Chrome";
import { useNotify } from "../components/Notify";
import { PaystackSheet } from "../components/Paystack";
import { Sheet } from "../components/Sheet";
import { branchById, POLICIES, SALON } from "../data/business";
import { serviceById } from "../data/catalog";
import { accessOf, actions, useAppData } from "../data/store";
import { slotsFor } from "../lib/booking";
import { amountDue, canViewVisit } from "../lib/checkout";
import { formatGhPhone, googleCalendarLink, mapsLinks, telLink, whatsappLink } from "../lib/contact";
import { fmtDayLong, fmtDayShort, fmtTime, money, parseLocal } from "../lib/format";
import { durationLabel } from "../lib/pricing";
import { badgeFor, balanceDue, canCancel, isLateCancel, nextAction, paidTotal, STATUS_LABEL, stageIndex, STAGES } from "../lib/visits";

export function VisitDetail() {
  const { visitId = "" } = useParams();
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const now = new Date();

  const visit = data.visits.find((v) => v.id === visitId);
  const [payOpen, setPayOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState("");

  if (!visit || !canViewVisit(visit, accessOf(data))) {
    return (
      <main className="screen is-narrow">
        <TopBar back title="Booking" alwaysSolid backRow="My visits" />
        <div className="empty" style={{ marginTop: "18vh" }}>
          <p className="t-title">This booking isn't on this phone</p>
          <p className="muted">Use "Find a booking" on the visits screen with your booking number and WhatsApp number.</p>
          <Link className="btn btn-dark" to="/visits" style={{ marginTop: 12 }}>
            Go to my visits
          </Link>
        </div>
      </main>
    );
  }

  const branch = branchById(visit.branchId);
  const staff = data.staff.find((s) => s.id === visit.staffId);
  const customer = data.customers.find((c) => c.id === visit.customerId);
  const start = parseLocal(visit.start);
  const badge = badgeFor(visit, now);
  const due = amountDue(visit);
  const balance = balanceDue(visit);
  const action = nextAction(visit, now, due.amount);
  const names = visit.items.map((i) => serviceById(i.serviceId)?.name ?? "Service").join(", ");
  const stage = stageIndex(visit.status);

  const calendar = googleCalendarLink({
    title: `${names} at ${SALON.name} ${branch?.name ?? ""}`.trim(),
    start,
    minutes: visit.minutes,
    location: branch?.address ?? "",
    details: `Booking ${visit.number} with ${staff?.name ?? "our team"}.`,
  });

  return (
    <main className="screen is-narrow">
      <TopBar back title={visit.number} alwaysSolid backRow="My visits" />

      <header className="visit-head stack gap-8">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <h1 className="t-h2">{names}</h1>
        <p className="t-lead">
          {fmtDayLong(start)} at {fmtTime(start)}
        </p>
        <p className="muted">
          {branch?.name} · with {staff?.name ?? "our team"} · {durationLabel(visit.minutes)}
        </p>
      </header>

      {action && (
        <section className="card card-pad stack gap-8 banner">
          <p className="t-title">{action.title}</p>
          <p className="muted">{action.body}</p>
          {action.cta && (
            <div className="banner-cta">
              {action.cta.kind === "pay" && <Cta onClick={() => setPayOpen(true)}>Pay {money(due.amount)}</Cta>}
              {action.cta.kind === "calendar" && (
                <a className="btn btn-outline" href={calendar} target="_blank" rel="noreferrer">
                  <CalendarPlus size={16} strokeWidth={1.8} />
                  Add to calendar
                </a>
              )}
              {action.cta.kind === "directions" && branch && (
                <a className="btn btn-outline" href={mapsLinks(`${branch.name} ${branch.address}`).google} target="_blank" rel="noreferrer">
                  <Navigation size={16} strokeWidth={1.8} />
                  Get directions
                </a>
              )}
              {action.cta.kind === "whatsapp" && (
                <a
                  className="btn btn-outline"
                  href={whatsappLink(branch?.phone ?? SALON.phone, `Hello, about booking ${visit.number}.`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={16} strokeWidth={1.8} />
                  Chat on WhatsApp
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {visit.status !== "cancelled" && visit.status !== "no-show" && (
        <section className="section">
          <h2 className="t-h3">Where it's up to</h2>
          <ol className="timeline">
            {STAGES.map((status, i) => (
              <li key={status} className={`tl-step ${i <= stage ? "is-done" : ""}`}>
                <span className="tl-dot" aria-hidden="true" />
                <span className="tl-label">{STATUS_LABEL[status]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="section">
        <h2 className="t-h3">What you're having</h2>
        <div className="card card-pad stack gap-8">
          {visit.items.map((item) => {
            const service = serviceById(item.serviceId);
            return (
              <div key={item.id} className="kv">
                <span>
                  {service?.name ?? "Service"}
                  <span className="subtle t-cap" style={{ display: "block" }}>
                    {durationLabel(item.minutes)}
                  </span>
                </span>
                <span>{money(item.price)}</span>
              </div>
            );
          })}
          <div className="divider" />
          <div className="kv kv-total">
            <span>Total</span>
            <span>{money(visit.total)}</span>
          </div>
          {paidTotal(visit) > 0 && (
            <div className="kv muted">
              <span>Paid so far</span>
              <span>{money(paidTotal(visit))}</span>
            </div>
          )}
          <div className="kv">
            <span className="muted">{balance > 0 ? "To pay at the salon" : "Settled"}</span>
            <span>{money(balance)}</span>
          </div>
        </div>
      </section>

      {branch && (
        <section className="section">
          <h2 className="t-h3">Getting there</h2>
          <div className="card list-card">
            <a className="row" href={mapsLinks(`${branch.name} ${branch.plusCode ?? branch.address}`).google} target="_blank" rel="noreferrer">
              <span className="row-icon" aria-hidden="true">
                <MapPin size={18} strokeWidth={1.8} />
              </span>
              <span className="grow stack gap-4">
                <span>{branch.address}</span>
                {branch.landmark && <span className="subtle t-cap">{branch.landmark}</span>}
              </span>
            </a>
            <a className="row" href={telLink(branch.phone)}>
              <span className="row-icon" aria-hidden="true">
                <Phone size={18} strokeWidth={1.8} />
              </span>
              <span className="grow">Call {branch.name} · {formatGhPhone(branch.phone)}</span>
            </a>
          </div>
        </section>
      )}

      {visit.notes && (
        <section className="section">
          <h2 className="t-h3">Your note</h2>
          <p className="card card-pad muted">{visit.notes}</p>
        </section>
      )}

      {visit.payments.length > 0 && (
        <section className="section">
          <h2 className="t-h3">Receipts</h2>
          <div className="card list-card">
            {visit.payments.map((payment) => (
              <Link key={payment.id} className="row" to={`/visits/${visit.id}/receipts/${payment.id}`}>
                <span className="row-icon" aria-hidden="true">
                  <ReceiptIcon size={18} strokeWidth={1.8} />
                </span>
                <span className="grow stack gap-4">
                  <span className="t-title">{money(payment.amount)}</span>
                  <span className="subtle t-cap t-mono">{payment.receiptNo}</span>
                </span>
                <span className="subtle t-cap">{fmtDayShort(new Date(payment.at))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {!canCancel(visit) && (
        <section className="section">
          <Button block icon={<RotateCcw size={16} />} onClick={() => navigate(`/book?rebook=${visit.id}`)}>
            Book this again
          </Button>
        </section>
      )}

      {canCancel(visit) && (
        <section className="section stack gap-8">
          <Button block onClick={() => setMoveOpen(true)}>
            Change the time
          </Button>
          <Button variant="danger" block onClick={() => setCancelOpen(true)}>
            Cancel this booking
          </Button>
        </section>
      )}

      <PaystackSheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        amount={due.amount}
        label={`${due.label === "deposit" ? "Deposit" : "Balance"} for ${visit.number}`}
        email={customer?.email ?? ""}
        phone={customer?.phone ?? ""}
        onPaid={(payment) => {
          const result = actions.pay(visit.id, payment);
          if ("error" in result) return result.error;
          notify("Payment received", `${money(payment.amount)} for booking ${visit.number}.`);
          setPayOpen(false);
          return null;
        }}
      />

      <MoveSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        visitId={visit.id}
        onMoved={(when) => {
          notify("Booking moved", `Now ${fmtDayShort(parseLocal(when))} at ${fmtTime(parseLocal(when))}.`);
          setMoveOpen(false);
        }}
        onError={setError}
      />

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking?">
        <div className="stack gap-12">
          <p className="muted">
            {isLateCancel(visit, now, POLICIES.cancelWindowHours)
              ? `This visit is less than ${POLICIES.cancelWindowHours} hours away, so your deposit is not refunded automatically. Message the branch and we'll do what we can.`
              : "Your slot goes back on the diary straight away. Any deposit stays on your account for next time."}
          </p>
          <Button
            variant="danger"
            block
            onClick={() => {
              actions.cancel(visit.id);
              setCancelOpen(false);
              notify("Booking cancelled", `${visit.number} has been cancelled.`);
              navigate("/visits");
            }}
          >
            Yes, cancel it
          </Button>
          <Button block onClick={() => setCancelOpen(false)}>
            Keep my booking
          </Button>
          {branch && (
            <a className="btn btn-outline btn-block" href={telLink(branch.phone)}>
              <Phone size={16} strokeWidth={1.8} />
              Not sure? Call {branch.name}
            </a>
          )}
        </div>
      </Sheet>
    </main>
  );
}

interface MoveProps {
  open: boolean;
  onClose: () => void;
  visitId: string;
  onMoved: (start: string) => void;
  onError: (message: string) => void;
}

function MoveSheet({ open, onClose, visitId, onMoved, onError }: MoveProps) {
  const data = useAppData();
  const now = new Date();
  const visit = data.visits.find((v) => v.id === visitId);
  const branch = visit && branchById(visit.branchId);
  const staff = data.staff.find((s) => s.id === visit?.staffId);
  const [dayOffset, setDayOffset] = useState(1);

  if (!visit || !branch || !staff) return null;
  const day = new Date(now);
  day.setDate(day.getDate() + dayOffset);
  // The visit's own slot is excluded from its own clash check, so its current time stays offered.
  const slots = slotsFor({ branch, staff, day, minutes: visit.minutes, visits: data.visits.filter((v) => v.id !== visit.id), now });

  return (
    <Sheet open={open} onClose={onClose} title="Change the time">
      <div className="stack gap-12">
        <p className="muted">
          Same services, same stylist ({staff.name}). Pick another slot at {branch.name}.
        </p>
        <div className="chips hscroll" role="group" aria-label="Choose a day">
          {Array.from({ length: 14 }, (_, i) => i + 1).map((offset) => {
            const candidate = new Date(now);
            candidate.setDate(candidate.getDate() + offset);
            return (
              <button
                key={offset}
                className={`chip ${offset === dayOffset ? "is-active" : ""}`}
                onClick={() => setDayOffset(offset)}
                aria-pressed={offset === dayOffset}
              >
                {fmtDayShort(candidate)}
              </button>
            );
          })}
        </div>
        {slots.length === 0 ? (
          <p className="muted">Nothing free that day. Try another, or message the branch.</p>
        ) : (
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                key={slot}
                className="slot"
                onClick={() => {
                  const result = actions.reschedule(visit.id, slot);
                  if ("error" in result) {
                    onError(result.error);
                    onClose();
                    return;
                  }
                  onMoved(slot);
                }}
              >
                {fmtTime(parseLocal(slot))}
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
