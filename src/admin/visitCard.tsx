import { ArrowRight, MapPin } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge, Photo } from "../components/Bits";
import { useNotify } from "../components/Notify";
import { branchById } from "../data/business";
import { serviceById, servicePhoto } from "../data/catalog";
import { customerById, desk, useAppData } from "../data/store";
import type { Customer, Visit } from "../data/types";
import { fmtDayShort, fmtTime, money, parseLocal } from "../lib/format";
import { durationLabel } from "../lib/pricing";
import { badgeFor, balanceDue, isActive, nextStep, type VisitStep } from "../lib/visits";
import { PaymentSheet, VisitSheet } from "./sheets";

export function visitTitle(v: Visit): string {
  const first = serviceById(v.items[0]?.serviceId ?? "")?.name ?? "Visit";
  return v.items.length > 1 ? `${first} + ${v.items.length - 1} more` : first;
}

/** One visit sheet and one payment sheet for a whole screen. Cards call open() or run(). */
export function useVisitActions() {
  const data = useAppData();
  const notify = useNotify();
  const [openId, setOpenId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const paying = payId ? data.visits.find((v) => v.id === payId) : undefined;

  const run = (visit: Visit, step: VisitStep) => {
    const who = customerById(data, visit.customerId)?.name ?? visit.number;
    if (step.kind === "pay") {
      setPayId(visit.id);
      setPayOpen(true);
      return;
    }
    const result = desk.moveTo(visit.id, step.to);
    if ("error" in result) return notify("Couldn't update the visit", result.error);
    notify(badgeFor(result.visit, new Date()).label, `${visit.number} for ${who}.`);
  };

  const sheets: ReactNode = (
    <>
      <VisitSheet visitId={openId} open={openId !== null} onClose={() => setOpenId(null)} />
      {paying && (
        <PaymentSheet
          visit={paying}
          open={payOpen}
          onClose={() => setPayOpen(false)}
          onPaid={(amount, settled) => {
            notify("Payment recorded", `${money(amount)} on ${paying.number}.`);
            if (!settled || paying.status !== "in-chair") return;
            const result = desk.moveTo(paying.id, "done");
            if ("error" in result) notify("Couldn't finish the visit", result.error);
          }}
        />
      )}
    </>
  );

  return { open: setOpenId, run, sheets };
}

export function MoneyTag({ visit }: { visit: Visit }) {
  if (visit.status === "cancelled" || visit.status === "no-show") return null;
  const owed = balanceDue(visit);
  if (owed === 0) return <span className="money-tag is-paid">Paid {money(visit.total)}</span>;
  if (visit.status === "done" || visit.status === "in-chair") return <span className="money-tag is-owed">{money(owed)} owed</span>;
  return <span className="money-tag">{money(visit.total)}</span>;
}

/** Result card: what was booked, who with, where it stands, and the one next step. */
export function VisitCard({ visit, customer, now, onOpen, onStep, showClient = true }: { visit: Visit; customer?: Customer; now: Date; onOpen: (id: string) => void; onStep: (visit: Visit, step: VisitStep) => void; showClient?: boolean }) {
  const data = useAppData();
  const service = serviceById(visit.items[0]?.serviceId ?? "");
  const staff = data.staff.find((s) => s.id === visit.staffId);
  const branch = branchById(visit.branchId);
  const badge = badgeFor(visit, now);
  const step = nextStep(visit);
  const start = parseLocal(visit.start);
  const late = isActive(visit) && (visit.status === "requested" || visit.status === "confirmed") && start < now;
  const title = visitTitle(visit);
  return (
    <article className="res-card">
      <button className="res-card-link" onClick={() => onOpen(visit.id)} aria-label={`${title}${customer ? ` for ${customer.name}` : ""}, ${visit.number}, ${badge.label}`} />
      <div className="res-thumb" aria-hidden="true">
        <Photo tone={service?.tone ?? "mist"} src={service ? servicePhoto(service) : undefined} sizes="44px" height={44} radius={8} markSize={18} />
      </div>
      <div className="res-top">
        <p className="res-title grow">{title}</p>
      </div>
      <p className="res-sub">
        {showClient && customer && (
          <>
            <Link to={`/admin/clients/${customer.id}`}>{customer.name}</Link>
            {" · "}
          </>
        )}
        <span className="t-mono">{visit.number}</span>
      </p>
      <div className="res-meta">
        {branch && (
          <span className="inline" style={{ gap: 4 }}>
            <MapPin size={13} aria-hidden="true" />
            {branch.name}
          </span>
        )}
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <MoneyTag visit={visit} />
      </div>
      <p className="res-snippet">
        With {staff?.name ?? "anyone free"} · {durationLabel(visit.minutes)}
        {visit.notes ? ` · “${visit.notes}”` : ""}
      </p>
      <div className="res-foot">
        <span className={late ? "is-late" : "muted"}>
          {fmtDayShort(start)}, {fmtTime(start)}
          {late ? " · past start time" : ""}
        </span>
        {step && (
          <button className="res-action" onClick={() => onStep(visit, step)}>
            {step.label} <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}
