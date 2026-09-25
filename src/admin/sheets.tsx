import { AlertTriangle, ArrowRight, Banknote, MessageCircle, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/Bits";
import { Button } from "../components/Button";
import { useNotify } from "../components/Notify";
import { Sheet } from "../components/Sheet";
import { branchById, SALON } from "../data/business";
import { serviceById } from "../data/catalog";
import { desk, useAppData } from "../data/store";
import type { PaymentMethod, Visit, VisitStatus } from "../data/types";
import { whatsappLink } from "../lib/contact";
import { fmtDayShort, fmtTime, money, parseLocal } from "../lib/format";
import { durationLabel } from "../lib/pricing";
import { badgeFor, balanceDue, isActive, paidTotal } from "../lib/visits";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "momo", label: "MoMo" },
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank" },
];

/** The one next step for each stage of the day, so the desk never hunts for the right button. */
const NEXT: Partial<Record<VisitStatus, { to: VisitStatus; label: string }>> = {
  requested: { to: "confirmed", label: "Confirm booking" },
  confirmed: { to: "arrived", label: "Mark arrived" },
  arrived: { to: "in-chair", label: "Seat in the chair" },
  "in-chair": { to: "done", label: "Finish visit" },
};

export function VisitSheet({ visitId, open, onClose }: { visitId: string | null; open: boolean; onClose: () => void }) {
  const data = useAppData();
  const notify = useNotify();
  const visit = data.visits.find((v) => v.id === visitId);
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState("");

  if (!visit) return null;
  const customer = data.customers.find((c) => c.id === visit.customerId);
  const staff = data.staff.find((s) => s.id === visit.staffId);
  const branch = branchById(visit.branchId);
  const start = parseLocal(visit.start);
  const badge = badgeFor(visit, new Date());
  const balance = balanceDue(visit);
  const next = NEXT[visit.status];
  const allergy = customer?.hair?.allergies;

  const move = (status: VisitStatus, opts?: { allowOwing?: boolean }) => {
    const result = desk.moveTo(visit.id, status, new Date(), opts);
    if ("error" in result) {
      setError(result.error);
      if (status === "done") setPayOpen(true);
      return;
    }
    setError("");
    notify("Updated", `${customer?.name ?? "Visit"} · ${badgeFor(result.visit, new Date()).label}`);
    if (status === "done" || status === "no-show" || status === "cancelled") onClose();
  };

  const update = whatsappLink(
    customer?.phone ?? "",
    `Hello ${customer?.name.split(" ")[0] ?? ""}, this is ${SALON.name} ${branch?.name ?? ""}. Your ${visit.items
      .map((i) => serviceById(i.serviceId)?.name)
      .join(" and ")} with ${staff?.name ?? "us"} is on ${fmtDayShort(start)} at ${fmtTime(start)}. Booking ${visit.number}.`,
  );

  return (
    <>
      <Sheet open={open} onClose={onClose} title={customer?.name ?? "Visit"}>
        <div className="stack gap-16">
          <div className="inline gap-8" style={{ flexWrap: "wrap" }}>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <span className="subtle t-cap t-mono">{visit.number}</span>
            <span className="subtle t-cap">· {visit.source === "walkin" ? "Walk-in" : visit.source === "online" ? "Booked online" : `By ${visit.source}`}</span>
          </div>

          {allergy && (
            <div className="allergy-alert" role="alert">
              <AlertTriangle size={18} strokeWidth={2} />
              <span>
                <b>Check before starting:</b> {allergy}
              </span>
            </div>
          )}

          <div className="card card-pad stack gap-8" style={{ boxShadow: "none", background: "var(--ground)" }}>
            <div className="kv">
              <span className="muted">When</span>
              <span>
                {fmtDayShort(start)}, {fmtTime(start)} · {durationLabel(visit.minutes)}
              </span>
            </div>
            <div className="kv">
              <span className="muted">With</span>
              <span>
                {staff?.name ?? "Unassigned"} · {branch?.name}
              </span>
            </div>
            <div className="divider" />
            {visit.items.map((item) => (
              <div key={item.id} className="kv">
                <span>{serviceById(item.serviceId)?.name ?? "Service"}</span>
                <span>{money(item.price)}</span>
              </div>
            ))}
            <div className="divider" />
            <div className="kv kv-total">
              <span>Total</span>
              <span>{money(visit.total)}</span>
            </div>
            <div className="kv muted">
              <span>Paid</span>
              <span>{money(paidTotal(visit))}</span>
            </div>
            <div className="kv">
              <span>{balance > 0 ? "Still to pay" : "Settled"}</span>
              <span>{money(balance)}</span>
            </div>
          </div>

          {customer?.hair?.notes && (
            <p className="muted t-cap">
              <b style={{ color: "var(--ink)" }}>Hair notes:</b> {customer.hair.notes}
            </p>
          )}
          {visit.notes && (
            <p className="muted t-cap">
              <b style={{ color: "var(--ink)" }}>Client's note:</b> {visit.notes}
            </p>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="stack gap-8">
            {next && isActive(visit) && (
              <Button variant="dark" block onClick={() => move(next.to)} icon={<ArrowRight size={16} />}>
                {next.label}
              </Button>
            )}
            {balance > 0 && visit.status !== "cancelled" && (
              <Button block onClick={() => setPayOpen(true)} icon={<Banknote size={16} />}>
                Take payment · {money(balance)}
              </Button>
            )}
            <a className="btn btn-outline btn-block" href={update} target="_blank" rel="noreferrer" onClick={() => desk.markUpdateSent(visit.id)}>
              <MessageCircle size={16} strokeWidth={1.8} />
              WhatsApp the client
            </a>
            {customer && (
              <Link className="btn btn-outline btn-block" to={`/admin/clients/${customer.id}`} onClick={onClose}>
                <UserRound size={16} strokeWidth={1.8} />
                Client record
              </Link>
            )}
            {(visit.status === "requested" || visit.status === "confirmed") && (
              <div className="inline gap-8">
                <Button block onClick={() => move("no-show")}>
                  No-show
                </Button>
                <Button variant="danger" block onClick={() => move("cancelled")}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </Sheet>

      <PaymentSheet
        visit={visit}
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onPaid={(amount, settled) => {
          setError("");
          notify("Payment recorded", `${money(amount)} from ${customer?.name ?? "client"}.`);
          if (settled && visit.status === "in-chair") move("done");
        }}
      />
    </>
  );
}

export function PaymentSheet({ visit, open, onClose, onPaid }: { visit: Visit; open: boolean; onClose: () => void; onPaid: (amount: number, settled: boolean) => void }) {
  const balance = balanceDue(visit);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const value = Number(amount);
    const result = desk.recordPayment(visit.id, { amount: value, method, reference });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError("");
    onClose();
    onPaid(value, value >= balance);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Take payment">
      <div className="stack gap-12">
        <p className="muted">
          {money(balance)} still to pay on {visit.number}.
        </p>
        <div className="segmented" role="group" aria-label="Payment method">
          {METHODS.map((m) => (
            <button key={m.id} className={method === m.id ? "is-active" : ""} onClick={() => setMethod(m.id)} aria-pressed={method === m.id}>
              {m.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Amount (GH₵)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        {method !== "cash" && (
          <label className="field">
            <span>{method === "momo" ? "MoMo transaction ID" : "Reference"} (optional)</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button variant="dark" block onClick={submit}>
          Record {money(Number(amount) || 0)}
        </Button>
      </div>
    </Sheet>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  danger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack gap-12">
        <p className="muted">{body}</p>
        {children}
        <Button variant={danger ? "danger" : "dark"} block onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button block onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
