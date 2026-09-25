import type { Visit, VisitStatus } from "../data/types";
import { fmtTime, money, parseLocal, relativeDay } from "./format";

/** The order a visit moves through the day. Cancelled and no-show sit outside it. */
export const STAGES: VisitStatus[] = ["requested", "confirmed", "arrived", "in-chair", "done"];

export const STATUS_LABEL: Record<VisitStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  arrived: "Arrived",
  "in-chair": "In the chair",
  done: "Done",
  cancelled: "Cancelled",
  "no-show": "No-show",
};

export type BadgeTone = "magenta" | "gold" | "sage" | "plum" | "mist" | "danger" | "wash";

export function paidTotal(visit: Pick<Visit, "payments">): number {
  return visit.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function balanceDue(visit: Pick<Visit, "payments" | "total">): number {
  return Math.max(0, visit.total - paidTotal(visit));
}

export function isActive(visit: Pick<Visit, "status">): boolean {
  return visit.status !== "done" && visit.status !== "cancelled" && visit.status !== "no-show";
}

/** Clients can cancel or move a visit until they are marked arrived. */
export function canCancel(visit: Pick<Visit, "status">): boolean {
  return visit.status === "requested" || visit.status === "confirmed";
}

/** Inside the cancellation window the deposit is the salon's to decide on, so send them to WhatsApp. */
export function isLateCancel(visit: Pick<Visit, "start">, now: Date, windowHours: number): boolean {
  return parseLocal(visit.start).getTime() - now.getTime() < windowHours * 3_600_000;
}

export function stageIndex(status: VisitStatus): number {
  return STAGES.indexOf(status);
}

export interface Badge {
  label: string;
  tone: BadgeTone;
}

export function badgeFor(visit: Pick<Visit, "status" | "payments" | "total" | "start">, now: Date): Badge {
  switch (visit.status) {
    case "cancelled":
      return { label: "Cancelled", tone: "danger" };
    case "no-show":
      return { label: "No-show", tone: "danger" };
    case "done":
      return balanceDue(visit) > 0 ? { label: "Balance due", tone: "gold" } : { label: "Done", tone: "mist" };
    case "in-chair":
      return { label: "In the chair", tone: "magenta" };
    case "arrived":
      return { label: "Arrived", tone: "sage" };
    case "requested":
      return { label: "Awaiting confirmation", tone: "plum" };
    default:
      return parseLocal(visit.start) < now ? { label: "Running late", tone: "gold" } : { label: "Confirmed", tone: "sage" };
  }
}

/** "today at 14:30", "tomorrow at 09:00" or "Tue, 15 Sept at 09:00" */
export function whenPhrase(visit: Pick<Visit, "start">, now: Date): string {
  const start = parseLocal(visit.start);
  const rel = relativeDay(start, now);
  const day = rel === "Today" || rel === "Tomorrow" ? rel.toLowerCase() : rel;
  return `${day} at ${fmtTime(start)}`;
}

export interface NextAction {
  title: string;
  body: string;
  cta?: { label: string; kind: "whatsapp" | "pay" | "calendar" | "directions" };
}

export function nextAction(visit: Visit, now: Date, deposit: number): NextAction | null {
  const balance = balanceDue(visit);
  switch (visit.status) {
    case "requested":
      return paidTotal(visit) > 0
        ? {
            title: "Deposit received",
            body: "We'll confirm your stylist and time on WhatsApp shortly.",
            cta: { label: "Chat on WhatsApp", kind: "whatsapp" },
          }
        : {
            title: `Hold your slot with a ${money(deposit)} deposit`,
            body: "Your time is held for an hour. A deposit confirms it and comes off your bill.",
            cta: { label: "Pay deposit", kind: "pay" },
          };
    case "confirmed": {
      const start = parseLocal(visit.start);
      if (start > now) {
        return {
          title: `You're booked for ${whenPhrase(visit, now)}`,
          body: balance > 0 ? `${money(balance)} to pay at the salon. Come ten minutes early if you can.` : "Fully paid. Come ten minutes early if you can.",
          cta: { label: "Add to calendar", kind: "calendar" },
        };
      }
      return {
        title: "We're expecting you",
        body: "Let the front desk know you've arrived and we'll seat you.",
        cta: { label: "Get directions", kind: "directions" },
      };
    }
    case "arrived":
      return { title: "You're checked in", body: "Your stylist will call you shortly." };
    case "in-chair":
      return { title: "Enjoy your visit", body: "Anything else you'd like added? Just ask your stylist." };
    case "done":
      return balance > 0
        ? { title: "Balance to settle", body: `${money(balance)} is still outstanding on this visit.`, cta: { label: "Pay balance", kind: "pay" } }
        : visit.rebookDue
          ? { title: "Book your next visit", body: `Based on what you had done, you're due back around ${relativeDay(parseLocal(visit.rebookDue), now)}.` }
          : null;
    default:
      return null;
  }
}

/** Returns an error message, or null when the payment is valid. */
export function validatePayment(visit: Pick<Visit, "payments" | "total" | "status">, amount: number): string | null {
  if (visit.status === "cancelled") return "This visit is cancelled, so it can't take payments.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount above zero.";
  const balance = balanceDue(visit);
  if (amount > balance) return `That's more than the ${money(balance)} balance.`;
  return null;
}
