import { CalendarPlus, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, SectionHead } from "../components/Bits";
import { Button, Cta } from "../components/Button";
import { useNotify } from "../components/Notify";
import { Sheet } from "../components/Sheet";
import { branchById } from "../data/business";
import { serviceById } from "../data/catalog";
import { accessOf, actions, useAppData } from "../data/store";
import { CODE_MESSAGE, visibleVisits } from "../lib/checkout";
import { fmtDayShort, fmtTime, money, parseLocal } from "../lib/format";
import { badgeFor, isActive } from "../lib/visits";

export function Visits() {
  const data = useAppData();
  const navigate = useNavigate();
  const notify = useNotify();
  const now = new Date();
  const mine = visibleVisits(data.visits, accessOf(data));
  const upcoming = mine.filter((v) => isActive(v) && parseLocal(v.start) >= now).reverse();
  const past = mine.filter((v) => !isActive(v) || parseLocal(v.start) < now);

  const [findOpen, setFindOpen] = useState(false);

  return (
    <main className="screen">
      <div className="between" style={{ alignItems: "baseline" }}>
        <h1 className="t-h1 page-title">My visits</h1>
        <button className="link hit" onClick={() => setFindOpen(true)}>
          Find a booking
        </button>
      </div>

      {mine.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <CalendarPlus size={26} strokeWidth={1.6} />
          </span>
          <p className="t-title">Nothing booked on this phone</p>
          <p className="muted">
            Book a visit and it appears here. Booked on another phone or by WhatsApp? Use "Find a booking".
          </p>
          <div className="inline gap-8" style={{ marginTop: 12 }}>
            <Cta onClick={() => navigate("/book")}>Book a visit</Cta>
            <Button onClick={() => setFindOpen(true)}>Find a booking</Button>
          </div>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="section">
              <SectionHead title="Coming up" />
              <div className="stack gap-8">
                {upcoming.map((visit) => (
                  <VisitRow key={visit.id} visitId={visit.id} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="section">
              <SectionHead title="Past visits" />
              <div className="stack gap-8">
                {past.map((visit) => (
                  <VisitRow key={visit.id} visitId={visit.id} rebook />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <FindSheet open={findOpen} onClose={() => setFindOpen(false)} onFound={(id) => navigate(`/visits/${id}`)} notify={notify} />
    </main>
  );
}

function VisitRow({ visitId, rebook }: { visitId: string; rebook?: boolean }) {
  const data = useAppData();
  const navigate = useNavigate();
  const visit = data.visits.find((v) => v.id === visitId);
  if (!visit) return null;
  const badge = badgeFor(visit, new Date());
  const branch = branchById(visit.branchId);
  const staff = data.staff.find((s) => s.id === visit.staffId);
  const names = visit.items.map((i) => serviceById(i.serviceId)?.name ?? "Service").join(", ");
  const start = parseLocal(visit.start);

  return (
    <Link className="card card-pad visit-row" to={`/visits/${visit.id}`}>
      <div className="visit-when" aria-hidden="true">
        <b>{start.getDate()}</b>
        <span>{fmtDayShort(start).split(", ")[1]?.split(" ")[1]}</span>
      </div>
      <div className="grow stack gap-4">
        <p className="t-title">{names}</p>
        <p className="muted t-cap">
          {fmtDayShort(start)} at {fmtTime(start)} · {branch?.name}
        </p>
        <p className="subtle t-cap">with {staff?.name ?? "our team"}</p>
      </div>
      <div className="stack gap-8" style={{ alignItems: "flex-end" }}>
        {rebook ? (
          <button
            className="btn btn-outline btn-sm"
            onClick={(event) => {
              // The row is a link to the visit; this button books the same thing again instead.
              event.preventDefault();
              navigate(`/book?rebook=${visit.id}`);
            }}
          >
            Book again
          </button>
        ) : (
          <Badge tone={badge.tone}>{badge.label}</Badge>
        )}
        <span className="tabular t-cap">{money(visit.total)}</span>
      </div>
    </Link>
  );
}

interface FindProps {
  open: boolean;
  onClose: () => void;
  onFound: (visitId: string) => void;
  notify: (title: string, body: string) => void;
}

/** A booking made on another phone is only revealed after a code sent to the client's own number. */
function FindSheet({ open, onClose, onFound, notify }: FindProps) {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"look" | "verify">("look");
  const [foundId, setFoundId] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setStage("look");
    setCode("");
    setError("");
    setFoundId("");
  };

  const look = () => {
    const visit = actions.lookUpVisit(number, phone);
    if (!visit) {
      setError("No booking matches that number and WhatsApp number.");
      return;
    }
    setFoundId(visit.id);
    const sent = actions.sendCode(phone);
    notify("Your code", `Code ${sent} opens booking ${visit.number} on this phone.`);
    setStage("verify");
    setError("");
  };

  const verify = () => {
    const result = actions.checkCode(phone, code);
    if (result !== "ok") {
      setError(CODE_MESSAGE[result]);
      return;
    }
    actions.addVisitToDevice(foundId);
    onClose();
    reset();
    onFound(foundId);
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title="Find a booking"
    >
      {stage === "look" ? (
        <div className="stack gap-12">
          <p className="muted">Enter your booking number and the WhatsApp number you booked with.</p>
          <label className="field">
            <span>Booking number</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="RH-1042" />
          </label>
          <label className="field">
            <span>WhatsApp number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="024 123 4567" />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="dark" block onClick={look} icon={<Search size={16} />}>
            Find it
          </Button>
        </div>
      ) : (
        <div className="stack gap-12">
          <p className="muted">We sent a 6-digit code to {phone}. Enter it to open the booking on this phone.</p>
          <label className="field">
            <span>Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="dark" block onClick={verify}>
            Open booking
          </Button>
        </div>
      )}
    </Sheet>
  );
}
