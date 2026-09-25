import { useSyncExternalStore } from "react";
import { rebookDue, totalMinutes, validateSlot } from "../lib/booking";
import { checkCode, CODE_TTL_MS, findVisit, paymentKindFor, paystackReference, samePhone, upsertCustomer, type Access, type CodeCheck, type PendingCode } from "../lib/checkout";
import { normalizeGhPhone } from "../lib/contact";
import { parseLocal } from "../lib/format";
import { receiptNumber, visitNumber } from "../lib/receipts";
import { balanceDue, canCancel, isActive, validatePayment } from "../lib/visits";
import { applyBranches, applySettings, cloneSettings, defaultBranches, defaultSettings, type SalonSettings } from "./business";
import { applyServices, defaultServices, serviceById } from "./catalog";
import { createSeed, SEED_VERSION, type AppData } from "./seed";
import type { Branch, ContactDetails, Customer, HairRecord, LeadSource, PaymentMethod, Payment, Review, ReviewStatus, Service, Staff, Visit, VisitItem, VisitSource, VisitStatus } from "./types";

const KEY = "royalhair-demo";

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version === SEED_VERSION) return withDefaultPhotos(parsed);
    }
  } catch (error) {
    console.warn("Could not read saved demo data, starting fresh.", error);
  }
  return createSeed(new Date());
}

/** Photos aren't editable, so a saved menu picks up photos added to the defaults later. */
function withDefaultPhotos(data: AppData): AppData {
  const photos = new Map(defaultServices().map((s) => [s.id, s.photo]));
  return { ...data, services: data.services.map((s) => (s.photo || !photos.get(s.id) ? s : { ...s, photo: photos.get(s.id) })) };
}

/** Copies saved prices, branches and salon details into the objects every screen reads. */
function publish(data: AppData) {
  applyServices(data.services);
  applyBranches(data.branches);
  applySettings(data.settings);
}

let state: AppData = load();
publish(state);
const listeners = new Set<() => void>();

function commit(next: AppData) {
  state = next;
  publish(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Could not save demo data.", error);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getAppData(): AppData {
  return state;
}

/* ---------------- Selectors ---------------- */

export const accessOf = (data: AppData): Access => ({ customerId: data.session.customerId, deviceVisitIds: data.device.visitIds });

/** The signed-in account, or null for guests. */
export const accountOf = (data: AppData): Customer | null => data.customers.find((c) => c.id === data.session.customerId && c.hasAccount) ?? null;

export const customerById = (data: AppData, id: string): Customer | undefined => data.customers.find((c) => c.id === id);

export const staffById = (data: AppData, id: string): Staff | undefined => data.staff.find((s) => s.id === id);

export const visitById = (data: AppData, id: string): Visit | undefined => data.visits.find((v) => v.id === id);

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

function randomToken(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type Result<T> = T | { error: string };

function itemsFor(serviceIds: string[], idFor: (i: number) => string): VisitItem[] | { error: string } {
  const services = serviceIds.map(serviceById);
  if (!services.length || services.some((s) => !s)) return { error: "Choose at least one service." };
  return (services as Service[]).map((service, i) => ({ id: idFor(i), serviceId: service.id, price: service.price, minutes: service.minutes }));
}

/**
 * The guard that makes double-booking impossible. Every write that places a visit in the
 * diary runs this against the live state, not against the slot list the screen was showing.
 */
function guardSlot(args: { branchId: string; staffId: string; start: string; minutes: number; now: Date; ignoreVisitId?: string }): string | null {
  const branch = state.branches.find((b) => b.id === args.branchId);
  if (!branch) return "We couldn't find that branch.";
  const staff = state.staff.find((s) => s.id === args.staffId);
  if (!staff) return "We couldn't find that team member.";
  if (staff.branchId !== branch.id) return `${staff.name} doesn't work at ${branch.name}.`;
  return validateSlot({ branch, staff, start: parseLocal(args.start), minutes: args.minutes, visits: state.visits, now: args.now, ignoreVisitId: args.ignoreVisitId });
}

/** Adds what the client told us about allergies to their hair record, keeping anything already there. */
function withAllergy(customer: Customer, allergies?: string): Customer {
  const text = allergies?.trim().slice(0, 500);
  if (!text) return customer;
  const existing = customer.hair?.allergies;
  if (existing?.toLowerCase().includes(text.toLowerCase())) return customer;
  return { ...customer, hair: { ...customer.hair, allergies: existing ? `${existing} · Client says: ${text}` : `Client says: ${text}` } };
}

/* ---------------- Payments ---------------- */

export interface OnlinePayment {
  amount: number;
  method: "momo" | "card";
  payer: string;
}

/** Builds a verified Paystack payment. In the live app this only happens after the server confirms the charge. */
function paymentFor(data: AppData, visit: Visit, pay: OnlinePayment, now: Date): { payment: Payment; receiptCounter: number } | { error: string } {
  const error = validatePayment(visit, pay.amount);
  if (error) return { error };
  const receiptCounter = data.counters.receipt + 1;
  return {
    receiptCounter,
    payment: {
      id: newId("p"),
      amount: pay.amount,
      method: pay.method,
      reference: paystackReference(visit.number, randomToken(6)),
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: paymentKindFor(visit, pay.amount),
      receivedBy: "Paystack (online)",
      payer: pay.payer,
    },
  };
}

/** A deposit on a requested visit confirms it; money after that just settles the bill. */
function withPayment(visit: Visit, payment: Payment): Visit {
  const confirms = visit.status === "requested" && payment.kind !== "part";
  return {
    ...visit,
    payments: [...visit.payments, payment],
    status: confirms ? "confirmed" : visit.status,
    history: confirms ? [...visit.history, { status: "confirmed" as VisitStatus, at: payment.at }] : visit.history,
  };
}

/* ---------------- One-time codes (demo: shown as a notification instead of a WhatsApp message) ---------------- */

let pendingCode: PendingCode | null = null;

/* ---------------- Client actions ---------------- */

export interface BookingDraft {
  branchId: string;
  staffId: string;
  serviceIds: string[];
  /** Local ISO date-time, YYYY-MM-DDTHH:mm. */
  start: string;
  contact: ContactDetails;
  remember: boolean;
  notes?: string;
  /**
   * Asked only when the basket has a relaxer, colour or dye. Goes onto the client's hair record so
   * the stylist sees it before starting, whoever takes the booking.
   */
  allergies?: string;
  /** Present when the deposit was paid at checkout. */
  payment?: OnlinePayment;
}

export const actions = {
  /** Books a visit, creating or updating the client and, if paid, the receipt, in one step. */
  book(draft: BookingDraft, now = new Date()): Result<{ visit: Visit; payment?: Payment }> {
    const items = itemsFor(draft.serviceIds, (i) => newId(`i${i}`));
    if ("error" in items) return items;
    const minutes = items.reduce((sum, item) => sum + item.minutes, 0);

    const clash = guardSlot({ branchId: draft.branchId, staffId: draft.staffId, start: draft.start, minutes, now });
    if (clash) return { error: clash };

    const upserted = upsertCustomer(state.customers, draft.contact, { customerId: state.session.customerId, now, newId: () => newId("c") });
    const customer = withAllergy(upserted.customer, draft.allergies);
    const customers = upserted.customers.map((c) => (c.id === customer.id ? customer : c));
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const createdAt = now.toISOString();
    const services = draft.serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));

    let visit: Visit = {
      id: newId("v"),
      number: visitNumber(state.counters.visit),
      customerId: customer.id,
      branchId: draft.branchId,
      staffId: draft.staffId,
      items,
      start: draft.start,
      minutes,
      createdAt,
      status: "requested",
      history: [{ status: "requested", at: createdAt }],
      source: "online",
      total,
      payments: [],
      notes: draft.notes?.trim() || undefined,
      rebookDue: rebookDue(services, parseLocal(draft.start)),
    };

    let receiptCounter = state.counters.receipt;
    let payment: Payment | undefined;
    if (draft.payment) {
      const result = paymentFor(state, visit, draft.payment, now);
      if ("error" in result) return { error: result.error };
      payment = result.payment;
      receiptCounter = result.receiptCounter;
      visit = withPayment(visit, payment);
    }

    commit({
      ...state,
      customers,
      visits: [visit, ...state.visits],
      // Guests keep the booking on this phone. Account bookings live in the account, so logging out hides them.
      device: state.session.customerId
        ? { ...state.device, branchId: draft.branchId }
        : { contact: draft.remember ? draft.contact : null, visitIds: [visit.id, ...state.device.visitIds], branchId: draft.branchId },
      counters: { visit: state.counters.visit + 1, receipt: receiptCounter },
    });
    return { visit, payment };
  },

  /** Pays a deposit or balance on an existing visit. */
  pay(visitId: string, pay: OnlinePayment, now = new Date()): Result<{ payment: Payment }> {
    const visit = state.visits.find((v) => v.id === visitId);
    if (!visit) return { error: "We couldn't find that booking." };
    const result = paymentFor(state, visit, pay, now);
    if ("error" in result) return result;
    commit({
      ...state,
      visits: state.visits.map((v) => (v.id === visitId ? withPayment(v, result.payment) : v)),
      counters: { ...state.counters, receipt: result.receiptCounter },
    });
    return { payment: result.payment };
  },

  /** Moves a booking to another time, with the same double-booking guard as a new one. */
  reschedule(visitId: string, start: string, now = new Date()): Result<{ visit: Visit }> {
    const visit = state.visits.find((v) => v.id === visitId);
    if (!visit) return { error: "We couldn't find that booking." };
    if (!canCancel(visit)) return { error: "This visit can no longer be moved online. Call the branch and we'll sort it." };
    const clash = guardSlot({ branchId: visit.branchId, staffId: visit.staffId, start, minutes: visit.minutes, now, ignoreVisitId: visit.id });
    if (clash) return { error: clash };
    const next = { ...visit, start };
    commit({ ...state, visits: state.visits.map((v) => (v.id === visitId ? next : v)) });
    return { visit: next };
  },

  cancel(visitId: string, now = new Date()) {
    const visit = state.visits.find((v) => v.id === visitId);
    if (!visit || !canCancel(visit)) return;
    commit({
      ...state,
      visits: state.visits.map((v) => (v.id === visitId ? { ...v, status: "cancelled", history: [...v.history, { status: "cancelled", at: now.toISOString() }] } : v)),
    });
  },

  /** Sends a 6-digit code to a WhatsApp number. Returns the code so the demo can show it as a notification. */
  sendCode(phone: string, now = Date.now()): string {
    const code = String(Math.floor(100000 + ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 900000)));
    pendingCode = { phone, code, expiresAt: now + CODE_TTL_MS, attempts: 0 };
    return code;
  },

  checkCode(phone: string, input: string, now = Date.now()): CodeCheck {
    const { result, pending } = checkCode(pendingCode, phone, input, now);
    pendingCode = pending;
    return result;
  },

  /** Customer record for a number, if the salon has one. */
  customerForPhone(phone: string): Customer | undefined {
    return state.customers.find((c) => samePhone(c.phone, phone));
  },

  /** Call after the code checks out. Turns the record for this number into an account (or creates one) and signs in. */
  createAccount(details: { name: string; phone: string; email?: string }, now = new Date()): Customer {
    const existing = actions.customerForPhone(details.phone);
    const customer: Customer = existing
      ? { ...existing, name: details.name || existing.name, email: details.email || existing.email, hasAccount: true }
      : { id: newId("c"), name: details.name, phone: details.phone, email: details.email ?? "", area: "", memberSince: now.toISOString(), hasAccount: true, points: 0 };
    commit({
      ...state,
      customers: existing ? state.customers.map((c) => (c.id === customer.id ? customer : c)) : [...state.customers, customer],
      session: { customerId: customer.id },
    });
    return customer;
  },

  /** Call after the code checks out. Returns null when the number has no account. */
  logIn(phone: string): Customer | null {
    const customer = state.customers.find((c) => c.hasAccount && samePhone(c.phone, phone));
    if (!customer) return null;
    commit({ ...state, session: { customerId: customer.id } });
    return customer;
  },

  logOut() {
    commit({ ...state, session: { customerId: null } });
  },

  /** Finds a booking by number and WhatsApp number. */
  lookUpVisit(numberInput: string, phone: string): Visit | null {
    return findVisit(state.visits, state.customers, numberInput, phone);
  },

  /** Call after the code checks out: keeps the found booking on this phone. */
  addVisitToDevice(visitId: string) {
    if (state.device.visitIds.includes(visitId)) return;
    commit({ ...state, device: { ...state.device, visitIds: [visitId, ...state.device.visitIds] } });
  },

  /** Remembers which branch this phone books at, so the form opens on it next time. */
  rememberBranch(branchId: string) {
    if (state.device.branchId === branchId) return;
    commit({ ...state, device: { ...state.device, branchId } });
  },

  /** Clears the remembered details and bookings listed on this phone. Nothing is deleted from the salon's records. */
  forgetDevice() {
    commit({ ...state, device: { contact: null, visitIds: [], branchId: state.device.branchId } });
  },

  resetDemo() {
    pendingCode = null;
    commit(createSeed(new Date()));
  },
};

/* ---------------- Owner side ---------------- */

export interface DeskPayment {
  amount: number;
  method: PaymentMethod;
  /** MoMo transaction ID or bank reference. Optional for cash. */
  reference?: string;
  /** Who at the desk took it. */
  receivedBy?: string;
}

export interface WalkInDraft {
  branchId: string;
  staffId: string;
  serviceIds: string[];
  start: string;
  source: VisitSource;
  /** An existing client, or the details of a new one. */
  customerId?: string;
  newClient?: { name: string; phone: string; area?: string; source: LeadSource };
  notes?: string;
  payment?: DeskPayment;
}

const findVisitById = (id: string) => state.visits.find((v) => v.id === id);
const updateVisit = (id: string, change: (visit: Visit) => Visit) => state.visits.map((v) => (v.id === id ? change(v) : v));
const withStatus = (visit: Visit, status: VisitStatus, now: Date): Visit => ({ ...visit, status, history: [...visit.history, { status, at: now.toISOString() }] });

const REFERENCE_FALLBACK: Record<PaymentMethod, string> = { cash: "Cash", momo: "MoMo", bank: "Bank transfer", card: "Card" };

function deskPayment(data: AppData, visit: Visit, pay: DeskPayment, now: Date): { payment: Payment; receiptCounter: number } | { error: string } {
  const error = validatePayment(visit, pay.amount);
  if (error) return { error };
  const receiptCounter = data.counters.receipt + 1;
  return {
    receiptCounter,
    payment: {
      id: newId("p"),
      amount: pay.amount,
      method: pay.method,
      reference: pay.reference?.trim().slice(0, 40) || REFERENCE_FALLBACK[pay.method],
      at: now.toISOString(),
      receiptNo: receiptNumber(now.getFullYear(), receiptCounter),
      kind: paymentKindFor(visit, pay.amount),
      receivedBy: pay.receivedBy?.trim() || "Front desk",
    },
  };
}

/** What the owner and branch managers do. Each returns an error message instead of throwing. */
export const desk = {
  /** Moves a visit through the day. Finishing needs the bill settled unless the desk allows it. */
  moveTo(visitId: string, status: VisitStatus, now = new Date(), opts: { allowOwing?: boolean } = {}): Result<{ visit: Visit }> {
    const visit = findVisitById(visitId);
    if (!visit) return { error: "We couldn't find that booking." };
    if (visit.status === status) return { visit };
    if (!isActive(visit) && status !== "cancelled") return { error: "This visit is already closed." };
    if (status === "done" && balanceDue(visit) > 0 && !opts.allowOwing) return { error: "This visit still has a balance to settle." };
    const next = withStatus(visit, status, now);
    commit({ ...state, visits: updateVisit(visitId, () => next) });
    return { visit: next };
  },

  recordPayment(visitId: string, pay: DeskPayment, now = new Date()): Result<{ payment: Payment }> {
    const visit = findVisitById(visitId);
    if (!visit) return { error: "We couldn't find that booking." };
    const result = deskPayment(state, visit, pay, now);
    if ("error" in result) return result;
    commit({
      ...state,
      visits: updateVisit(visitId, (v) => withPayment(v, result.payment)),
      counters: { ...state.counters, receipt: result.receiptCounter },
    });
    return { payment: result.payment };
  },

  /** Moves a visit to another time, staff member or branch. The double-booking guard still applies. */
  move(visitId: string, to: { start?: string; staffId?: string; branchId?: string }, now = new Date()): Result<{ visit: Visit }> {
    const visit = findVisitById(visitId);
    if (!visit) return { error: "We couldn't find that booking." };
    if (!isActive(visit)) return { error: "This visit is closed." };
    const next = { ...visit, start: to.start ?? visit.start, staffId: to.staffId ?? visit.staffId, branchId: to.branchId ?? visit.branchId };
    const clash = guardSlot({ branchId: next.branchId, staffId: next.staffId, start: next.start, minutes: next.minutes, now, ignoreVisitId: visit.id });
    if (clash) return { error: clash };
    commit({ ...state, visits: updateVisit(visitId, () => next) });
    return { visit: next };
  },

  /** Adds or removes services on a visit that is already in the chair. */
  setServices(visitId: string, serviceIds: string[], now = new Date()): Result<{ visit: Visit }> {
    const visit = findVisitById(visitId);
    if (!visit) return { error: "We couldn't find that booking." };
    if (!isActive(visit)) return { error: "This visit is closed." };
    const items = itemsFor(serviceIds, (i) => newId(`i${i}`));
    if ("error" in items) return items;
    const minutes = items.reduce((sum, item) => sum + item.minutes, 0);
    const total = items.reduce((sum, item) => sum + item.price, 0);
    const paid = visit.payments.reduce((sum, p) => sum + p.amount, 0);
    if (total < paid) return { error: "The bill can't be less than what's already paid." };
    const clash = guardSlot({ branchId: visit.branchId, staffId: visit.staffId, start: visit.start, minutes, now, ignoreVisitId: visit.id });
    if (clash) return { error: clash };
    const services = serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));
    const next = { ...visit, items, minutes, total, rebookDue: rebookDue(services, parseLocal(visit.start)) };
    commit({ ...state, visits: updateVisit(visitId, () => next) });
    return { visit: next };
  },

  /** A walk-in, phone or WhatsApp booking the desk takes down itself. Walk-ins are seated straight away. */
  create(draft: WalkInDraft, now = new Date()): Result<{ visit: Visit; payment?: Payment }> {
    const items = itemsFor(draft.serviceIds, (i) => newId(`i${i}`));
    if ("error" in items) return items;
    const minutes = items.reduce((sum, item) => sum + item.minutes, 0);

    const clash = guardSlot({ branchId: draft.branchId, staffId: draft.staffId, start: draft.start, minutes, now });
    if (clash) return { error: clash };

    let customers = state.customers;
    let customerId = draft.customerId;
    if (customerId) {
      if (!customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    } else {
      const client = draft.newClient;
      const name = client?.name.trim().replace(/\s+/g, " ") ?? "";
      if (name.length < 2) return { error: "Enter the client's name." };
      if (!client || !normalizeGhPhone(client.phone)) return { error: "Enter a Ghana phone number, like 024 123 4567." };
      const existing = customers.find((c) => samePhone(c.phone, client.phone));
      if (existing) {
        customerId = existing.id;
      } else {
        const created: Customer = { id: newId("c"), name, phone: client.phone.trim(), email: "", area: client.area?.trim() ?? "", memberSince: now.toISOString(), hasAccount: false, points: 0, source: client.source };
        customers = [...customers, created];
        customerId = created.id;
      }
    }

    const createdAt = now.toISOString();
    const walkIn = draft.source === "walkin";
    const services = draft.serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));
    let visit: Visit = {
      id: newId("v"),
      number: visitNumber(state.counters.visit),
      customerId,
      branchId: draft.branchId,
      staffId: draft.staffId,
      items,
      start: draft.start,
      minutes,
      createdAt,
      status: walkIn ? "arrived" : "confirmed",
      history: walkIn
        ? [{ status: "requested", at: createdAt }, { status: "confirmed", at: createdAt }, { status: "arrived", at: createdAt }]
        : [{ status: "requested", at: createdAt }, { status: "confirmed", at: createdAt }],
      source: draft.source,
      total: items.reduce((sum, item) => sum + item.price, 0),
      payments: [],
      notes: draft.notes?.trim() || undefined,
      rebookDue: rebookDue(services, parseLocal(draft.start)),
    };

    let receipt = state.counters.receipt;
    let payment: Payment | undefined;
    if (draft.payment && draft.payment.amount > 0) {
      const result = deskPayment(state, visit, draft.payment, now);
      if ("error" in result) return result;
      payment = result.payment;
      receipt = result.receiptCounter;
      visit = withPayment(visit, payment);
    }

    commit({ ...state, customers, visits: [visit, ...state.visits], counters: { visit: state.counters.visit + 1, receipt } });
    return { visit, payment };
  },

  markUpdateSent(visitId: string, now = new Date()) {
    if (!findVisitById(visitId)) return;
    commit({ ...state, visits: updateVisit(visitId, (v) => ({ ...v, lastUpdateAt: now.toISOString() })) });
  },

  /** The hair record: allergies, formula, notes. Never shown to the client. */
  saveHairRecord(customerId: string, record: HairRecord): Result<{ ok: true }> {
    if (!state.customers.some((c) => c.id === customerId)) return { error: "We couldn't find that client." };
    if ((record.notes?.length ?? 0) > 4000) return { error: "Notes are limited to 4,000 characters." };
    const clean: HairRecord = {
      allergies: record.allergies?.trim() || undefined,
      notes: record.notes?.trim() || undefined,
      colourFormula: record.colourFormula?.trim() || undefined,
      lastRelaxer: record.lastRelaxer || undefined,
      preferredStaffId: record.preferredStaffId || undefined,
      preferredBranchId: record.preferredBranchId || undefined,
    };
    commit({ ...state, customers: state.customers.map((c) => (c.id === customerId ? { ...c, hair: clean } : c)) });
    return { ok: true };
  },

  /** Edits one service's name, price, duration or visibility. */
  saveService(serviceId: string, patch: Partial<Pick<Service, "name" | "description" | "price" | "priceFrom" | "minutes" | "bookable" | "repeatWeeks" | "featured" | "active">>): Result<{ service: Service }> {
    const current = state.services.find((s) => s.id === serviceId);
    if (!current) return { error: "We couldn't find that service." };
    const next: Service = { ...current, ...patch, name: (patch.name ?? current.name).trim(), description: (patch.description ?? current.description).trim() };
    if (next.name.length < 2) return { error: "Give the service a name." };
    if (!Number.isFinite(next.price) || next.price < 0 || next.price > 100_000) return { error: "Prices must be between GH₵ 0 and GH₵ 100,000." };
    if (!Number.isInteger(next.minutes) || next.minutes < 5 || next.minutes > 600) return { error: "Length must be between 5 and 600 minutes." };
    if (!Number.isInteger(next.repeatWeeks) || next.repeatWeeks < 0 || next.repeatWeeks > 52) return { error: "Repeat must be between 0 and 52 weeks." };
    commit({ ...state, services: state.services.map((s) => (s.id === serviceId ? next : s)) });
    return { service: next };
  },

  resetServices() {
    commit({ ...state, services: defaultServices() });
  },

  saveStaff(staffId: string, patch: Partial<Pick<Staff, "name" | "role" | "groups" | "days" | "commission" | "active" | "branchId">>): Result<{ staff: Staff }> {
    const current = state.staff.find((s) => s.id === staffId);
    if (!current) return { error: "We couldn't find that team member." };
    const next: Staff = { ...current, ...patch, name: (patch.name ?? current.name).trim() };
    if (next.name.length < 2) return { error: "Enter their name." };
    if (!next.groups.length) return { error: "Choose at least one kind of work they do." };
    if (!Number.isFinite(next.commission) || next.commission < 0 || next.commission > 1) return { error: "Commission must be between 0% and 100%." };
    if (!state.branches.some((b) => b.id === next.branchId)) return { error: "We couldn't find that branch." };
    commit({ ...state, staff: state.staff.map((s) => (s.id === staffId ? next : s)) });
    return { staff: next };
  },

  addStaff(draft: Omit<Staff, "id">): Result<{ staff: Staff }> {
    const staff: Staff = { ...draft, id: newId("st"), name: draft.name.trim() };
    if (staff.name.length < 2) return { error: "Enter their name." };
    if (!staff.groups.length) return { error: "Choose at least one kind of work they do." };
    if (!state.branches.some((b) => b.id === staff.branchId)) return { error: "We couldn't find that branch." };
    commit({ ...state, staff: [...state.staff, staff] });
    return { staff };
  },

  saveBranch(branchId: string, patch: Partial<Pick<Branch, "name" | "area" | "address" | "phone" | "digitalAddress" | "plusCode" | "landmark" | "hours" | "chairs" | "active">>): Result<{ branch: Branch }> {
    const current = state.branches.find((b) => b.id === branchId);
    if (!current) return { error: "We couldn't find that branch." };
    const next: Branch = { ...current, ...patch, name: (patch.name ?? current.name).trim(), address: (patch.address ?? current.address).trim() };
    if (next.name.length < 2) return { error: "The branch needs a name." };
    if (!normalizeGhPhone(next.phone)) return { error: "Enter a Ghana phone number, like 030 396 5412." };
    if (next.address.length < 3) return { error: "Enter the branch address." };
    if (!Number.isInteger(next.chairs) || next.chairs < 1 || next.chairs > 60) return { error: "Chairs must be between 1 and 60." };
    for (const span of next.hours) {
      if (!span) continue;
      const [open, close] = span;
      if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) return { error: "Opening hours use 24-hour times, like 09:00." };
      if (close <= open) return { error: "Each day has to close after it opens." };
    }
    commit({ ...state, branches: state.branches.map((b) => (b.id === branchId ? next : b)) });
    return { branch: next };
  },

  resetBranches() {
    commit({ ...state, branches: defaultBranches() });
  },

  saveSettings(patch: { salon?: Partial<SalonSettings["salon"]>; policies?: Partial<SalonSettings["policies"]> }): Result<{ settings: SalonSettings }> {
    const next = cloneSettings(state.settings);
    if (patch.salon) Object.assign(next.salon, patch.salon);
    if (patch.policies) Object.assign(next.policies, patch.policies);

    next.salon.name = next.salon.name.trim();
    next.salon.phone = next.salon.phone.trim();
    if (next.salon.name.length < 2) return { error: "The salon needs a name." };
    if (!normalizeGhPhone(next.salon.phone)) return { error: "Enter a Ghana phone number, like 024 613 6708." };
    for (const link of [next.salon.whatsappBusiness, next.salon.instagram, next.salon.tiktok]) {
      if (link.trim() && !/^https?:\/\/\S+$/.test(link.trim())) return { error: "Links must start with https://" };
    }
    if (next.policies.depositRate < 0 || next.policies.depositRate > 1) return { error: "The deposit must be between 0% and 100%." };
    if (!Number.isInteger(next.policies.turnaroundMinutes) || next.policies.turnaroundMinutes < 0 || next.policies.turnaroundMinutes > 60) {
      return { error: "Clean-down time must be between 0 and 60 minutes." };
    }
    commit({ ...state, settings: next });
    return { settings: next };
  },

  resetSettings() {
    commit({ ...state, settings: defaultSettings() });
  },

  setReviewStatus(reviewId: string, status: ReviewStatus) {
    if (!state.reviews.some((r) => r.id === reviewId)) return;
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, status } : r)) });
  },

  replyToReview(reviewId: string, reply: string): Result<{ ok: true }> {
    const text = reply.trim();
    if (text.length < 2) return { error: "Write a reply first." };
    if (text.length > 600) return { error: "Keep replies under 600 characters." };
    if (!state.reviews.some((r) => r.id === reviewId)) return { error: "We couldn't find that review." };
    commit({ ...state, reviews: state.reviews.map((r) => (r.id === reviewId ? { ...r, reply: text } : r)) });
    return { ok: true };
  },
};

export type { Review, Staff, Visit };
export { totalMinutes };
