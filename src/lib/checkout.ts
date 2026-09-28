import type { ContactDetails, Customer, Payment, Visit } from "../data/types";
import { formatGhPhone, normalizeGhPhone } from "./contact";
import { balanceDue } from "./visits";

/* ---------------- Contact details ---------------- */

export type ContactErrors = Partial<Record<keyof ContactDetails, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const EMPTY_CONTACT: ContactDetails = { name: "", phone: "", email: "", area: "" };

export function contactFromCustomer(customer: Customer): ContactDetails {
  return { name: customer.name, phone: formatGhPhone(customer.phone), email: customer.email, area: customer.area };
}

/** Field errors for the booking form. */
export function validateContact(contact: ContactDetails): ContactErrors {
  const errors: ContactErrors = {};
  const name = contact.name.trim();
  if (name.length < 2 || !/\p{L}/u.test(name)) errors.name = "Enter your full name.";
  if (!normalizeGhPhone(contact.phone)) errors.phone = "Enter a Ghana WhatsApp number, like 024 123 4567.";
  // Optional: nothing is paid online, so there are no emailed receipts to send.
  if (contact.email.trim() && !EMAIL_RE.test(contact.email.trim())) errors.email = "Check your email address, like ama@gmail.com, or leave it empty.";
  if (contact.area.trim().length < 2) errors.area = "Enter your town or area.";
  return errors;
}

export function cleanContact(contact: ContactDetails): ContactDetails {
  return {
    name: contact.name.trim().replace(/\s+/g, " "),
    phone: formatGhPhone(contact.phone),
    email: contact.email.trim().toLowerCase(),
    area: contact.area.trim(),
  };
}

export const samePhone = (a: string, b: string) => {
  const na = normalizeGhPhone(a);
  return na !== null && na === normalizeGhPhone(b);
};

/**
 * Finds the customer by WhatsApp number (or by id when signed in) and updates their details,
 * or creates a new guest record. Keeps account status, points and the hair record.
 */
export function upsertCustomer(
  customers: Customer[],
  contact: ContactDetails,
  opts: { customerId?: string | null; now: Date; newId: () => string },
): { customers: Customer[]; customer: Customer } {
  const existing = customers.find((c) => (opts.customerId ? c.id === opts.customerId : samePhone(c.phone, contact.phone)));
  const details = { name: contact.name, phone: contact.phone, email: contact.email, area: contact.area };
  if (existing) {
    const customer = { ...existing, ...details };
    return { customers: customers.map((c) => (c.id === existing.id ? customer : c)), customer };
  }
  const customer: Customer = { id: opts.newId(), ...details, memberSince: opts.now.toISOString(), hasAccount: false, points: 0, source: "app" };
  return { customers: [...customers, customer], customer };
}

/* ---------------- Who can see which visit ---------------- */

export interface Access {
  /** Signed-in account on this phone, if any. */
  customerId: string | null;
  /** Visits booked or found on this phone without an account. */
  deviceVisitIds: string[];
}

export function canViewVisit(visit: Pick<Visit, "id" | "customerId">, access: Access): boolean {
  return (access.customerId !== null && visit.customerId === access.customerId) || access.deviceVisitIds.includes(visit.id);
}

export function visibleVisits<T extends Pick<Visit, "id" | "customerId" | "start">>(visits: T[], access: Access): T[] {
  return visits.filter((v) => canViewVisit(v, access)).sort((a, b) => b.start.localeCompare(a.start));
}

/** Accepts "RH-1041", "rh1041" or "1041". */
export function normalizeVisitNumber(input: string): string | null {
  const digits = input.trim().toUpperCase().replace(/^RH[\s-]*/, "");
  return /^\d{3,6}$/.test(digits) ? `RH-${digits.padStart(4, "0")}` : null;
}

/** A visit matches only when both the booking number and the customer's WhatsApp number agree. */
export function findVisit(visits: Visit[], customers: Customer[], visitNumber: string, phone: string): Visit | null {
  const number = normalizeVisitNumber(visitNumber);
  if (!number || !normalizeGhPhone(phone)) return null;
  const visit = visits.find((v) => v.number === number);
  const owner = visit && customers.find((c) => c.id === visit.customerId);
  return visit && owner && samePhone(owner.phone, phone) ? visit : null;
}

/* ---------------- Payments ---------------- */

export function paymentKindFor(visit: Pick<Visit, "total" | "payments">, amount: number): Payment["kind"] {
  if (amount >= balanceDue(visit)) return "final";
  // Everything is paid at the desk, so money short of the full bill is a part payment. "deposit" only
  // survives on payments recorded before the salon dropped online deposits.
  return "part";
}

/* ---------------- One-time codes ---------------- */

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;

export interface PendingCode {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

export type CodeCheck = "ok" | "wrong" | "expired" | "locked" | "missing";

/** Checks a typed code. Returns the result and the pending code to keep (null once used up). */
export function checkCode(pending: PendingCode | null, phone: string, input: string, now: number): { result: CodeCheck; pending: PendingCode | null } {
  if (!pending || !samePhone(pending.phone, phone)) return { result: "missing", pending };
  if (now > pending.expiresAt) return { result: "expired", pending: null };
  if (pending.attempts >= CODE_MAX_ATTEMPTS) return { result: "locked", pending: null };
  if (input.trim() === pending.code) return { result: "ok", pending: null };
  const next = { ...pending, attempts: pending.attempts + 1 };
  const locked = next.attempts >= CODE_MAX_ATTEMPTS;
  return { result: locked ? "locked" : "wrong", pending: locked ? null : next };
}

export const CODE_MESSAGE: Record<Exclude<CodeCheck, "ok">, string> = {
  wrong: "That code doesn't match. Check the latest message and try again.",
  expired: "That code has expired. Send a new one.",
  locked: "Too many tries. Send a new code.",
  missing: "Send a code to this number first.",
};
