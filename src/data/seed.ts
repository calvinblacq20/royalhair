import { rebookDue } from "../lib/booking";
import { dayKey, localIso, startOfDay } from "../lib/format";
import { receiptNumber, visitNumber } from "../lib/receipts";
import { defaultBranches, defaultSettings, type SalonSettings } from "./business";
import { defaultServices, serviceById } from "./catalog";
import type { Branch, Customer, Payment, Review, Service, Staff, Visit, VisitItem, VisitStatus } from "./types";

export interface AppData {
  version: number;
  branches: Branch[];
  services: Service[];
  staff: Staff[];
  customers: Customer[];
  visits: Visit[];
  reviews: Review[];
  settings: SalonSettings;
  session: { customerId: string | null };
  /** What this phone remembers without an account. */
  device: { contact: import("./types").ContactDetails | null; visitIds: string[]; branchId: string | null; savedServiceIds: string[] };
  counters: { visit: number; receipt: number };
}

/** The sample account a demo can log in with (Naa Adjeley: visits, points and a hair record). */
export const DEMO_ACCOUNT_PHONE = "024 501 2233";

/** Bump whenever the saved shape changes, so an old demo in someone's browser starts fresh. */
export const SEED_VERSION = 5;

function defaultStaff(): Staff[] {
  return [
    // West Hills Mall
    { id: "st-adwoa", name: "Adwoa Mensah", branchId: "b-westhills", role: "stylist", groups: ["hair", "kids"], days: [1, 2, 3, 4, 5, 6], commission: 0.35, active: true },
    { id: "st-efua", name: "Efua Boateng", branchId: "b-westhills", role: "stylist", groups: ["hair"], days: [0, 2, 3, 4, 5, 6], commission: 0.35, active: true },
    { id: "st-kwabena", name: "Kwabena Owusu", branchId: "b-westhills", role: "barber", groups: ["barbering", "kids"], days: [1, 2, 3, 4, 5, 6], commission: 0.4, active: true },
    { id: "st-abena", name: "Abena Sarpong", branchId: "b-westhills", role: "nail-tech", groups: ["nails"], days: [0, 1, 3, 4, 5, 6], commission: 0.3, active: true },
    { id: "st-mariam", name: "Mariam Issah", branchId: "b-westhills", role: "therapist", groups: ["spa"], days: [1, 2, 4, 5, 6], commission: 0.3, active: true },
    { id: "st-gifty", name: "Gifty Ampofo", branchId: "b-westhills", role: "manager", groups: ["hair", "nails"], days: [1, 2, 3, 4, 5], commission: 0.2, active: true },

    // Airport
    { id: "st-akosua", name: "Akosua Danso", branchId: "b-airport", role: "stylist", groups: ["hair", "kids"], days: [1, 2, 3, 4, 5, 6], commission: 0.35, active: true },
    { id: "st-yaw", name: "Yaw Amponsah", branchId: "b-airport", role: "barber", groups: ["barbering", "kids"], days: [1, 2, 3, 4, 5, 6], commission: 0.4, active: true },
    { id: "st-linda", name: "Linda Quartey", branchId: "b-airport", role: "nail-tech", groups: ["nails"], days: [1, 2, 3, 4, 5, 6], commission: 0.3, active: true },
    { id: "st-joyce", name: "Joyce Tetteh", branchId: "b-airport", role: "therapist", groups: ["spa"], days: [2, 3, 4, 5, 6], commission: 0.3, active: true },

    // Kumasi
    { id: "st-ama", name: "Ama Osei", branchId: "b-kumasi", role: "stylist", groups: ["hair", "kids"], days: [0, 1, 2, 3, 4, 5, 6], commission: 0.35, active: true },
    { id: "st-kofi", name: "Kofi Adjei", branchId: "b-kumasi", role: "barber", groups: ["barbering", "kids"], days: [1, 2, 3, 4, 5, 6], commission: 0.4, active: true },
    { id: "st-priscilla", name: "Priscilla Nyarko", branchId: "b-kumasi", role: "nail-tech", groups: ["nails", "spa"], days: [1, 2, 3, 4, 5, 6], commission: 0.3, active: true },
  ];
}

function defaultCustomers(now: Date): Customer[] {
  const since = (months: number) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  };
  return [
    {
      id: "c-naa", name: "Naa Adjeley", phone: "024 501 2233", email: "naa.adjeley@gmail.com", area: "Weija",
      memberSince: since(14), hasAccount: true, points: 240, source: "instagram",
      hair: { allergies: "Reacts to ammonia-based colour. Use the ammonia-free line.", notes: "Fine edges, no tight braiding at the hairline.", colourFormula: "6N + 20 vol, 35 min", lastRelaxer: dayKey(new Date(now.getTime() - 63 * 86_400_000)), preferredStaffId: "st-adwoa", preferredBranchId: "b-westhills" },
    },
    {
      id: "c-selorm", name: "Selorm Agbo", phone: "055 220 8899", email: "selorm.agbo@gmail.com", area: "Airport Residential",
      memberSince: since(9), hasAccount: false, points: 60, source: "referral",
      hair: { notes: "Skin fade, number 1 on the sides. Sensitive to clipper burn on the nape." },
    },
    {
      id: "c-adjoa", name: "Adjoa Frimpong", phone: "020 778 4455", email: "adjoa.frimpong@gmail.com", area: "Dansoman",
      memberSince: since(6), hasAccount: true, points: 150, source: "tiktok",
      hair: { notes: "Books knotless every six weeks without fail. Prefers a quiet chair.", preferredStaffId: "st-efua" },
    },
    {
      id: "c-yaa", name: "Yaa Boakye", phone: "059 331 7788", email: "yaa.boakye@gmail.com", area: "Asokwa",
      memberSince: since(3), hasAccount: false, points: 30, source: "walkin",
    },
    {
      id: "c-esi", name: "Esi Mensimah", phone: "026 909 1122", email: "esi.mensimah@gmail.com", area: "East Legon",
      memberSince: since(21), hasAccount: true, points: 410, source: "referral",
      hair: { allergies: "Nut oils. Check product labels before any treatment.", notes: "Monthly pedicure, always the 60-minute massage after." },
    },
    {
      id: "c-kwame", name: "Kwame Antwi", phone: "024 660 3344", email: "kwame.antwi@gmail.com", area: "Weija",
      memberSince: since(2), hasAccount: false, points: 20, source: "walkin",
    },
    {
      id: "c-ruth", name: "Ruth Owusu-Ansah", phone: "057 412 6677", email: "ruth.oa@gmail.com", area: "Achimota",
      memberSince: since(11), hasAccount: true, points: 190, source: "instagram",
      hair: { notes: "Locs client, retwist every six weeks. Bring the lightweight oil.", preferredBranchId: "b-airport" },
    },
    {
      id: "c-abigail", name: "Abigail Nkrumah", phone: "050 883 2211", email: "abigail.nkrumah@gmail.com", area: "Kasoa",
      memberSince: since(1), hasAccount: false, points: 0, source: "tiktok",
    },
  ];
}

interface VisitSpec {
  id: string;
  customerId: string;
  branchId: string;
  staffId: string;
  serviceIds: string[];
  /** Days from today. Negative is the past. */
  dayOffset: number;
  time: string;
  status: VisitStatus;
  source: Visit["source"];
  /** How much has been paid, as a share of the total. */
  paidShare?: number;
  notes?: string;
}

const HISTORY: VisitSpec[] = [
  { id: "v-1", customerId: "c-naa", branchId: "b-westhills", staffId: "st-adwoa", serviceIds: ["s-perm", "s-treatment"], dayOffset: -63, time: "10:00", status: "done", source: "online", paidShare: 1 },
  { id: "v-2", customerId: "c-adjoa", branchId: "b-westhills", staffId: "st-efua", serviceIds: ["s-knotless"], dayOffset: -44, time: "09:00", status: "done", source: "online", paidShare: 1 },
  { id: "v-3", customerId: "c-esi", branchId: "b-airport", staffId: "st-linda", serviceIds: ["s-pedi", "s-mani"], dayOffset: -35, time: "14:00", status: "done", source: "walkin", paidShare: 1 },
  { id: "v-4", customerId: "c-selorm", branchId: "b-airport", staffId: "st-yaw", serviceIds: ["s-cut", "s-beard"], dayOffset: -21, time: "17:30", status: "done", source: "walkin", paidShare: 1 },
  { id: "v-5", customerId: "c-ruth", branchId: "b-airport", staffId: "st-akosua", serviceIds: ["s-locs"], dayOffset: -42, time: "11:00", status: "done", source: "whatsapp", paidShare: 1 },
  { id: "v-6", customerId: "c-yaa", branchId: "b-kumasi", staffId: "st-ama", serviceIds: ["s-washset"], dayOffset: -18, time: "12:00", status: "done", source: "walkin", paidShare: 1 },
  { id: "v-7", customerId: "c-esi", branchId: "b-airport", staffId: "st-joyce", serviceIds: ["s-massage"], dayOffset: -14, time: "16:00", status: "done", source: "online", paidShare: 1 },
  { id: "v-8", customerId: "c-kwame", branchId: "b-westhills", staffId: "st-kwabena", serviceIds: ["s-cut"], dayOffset: -12, time: "18:00", status: "done", source: "walkin", paidShare: 1 },
  { id: "v-9", customerId: "c-abigail", branchId: "b-westhills", staffId: "st-abena", serviceIds: ["s-acrylic", "s-nailart"], dayOffset: -9, time: "13:00", status: "done", source: "online", paidShare: 1 },
  { id: "v-10", customerId: "c-adjoa", branchId: "b-westhills", staffId: "st-efua", serviceIds: ["s-washset"], dayOffset: -7, time: "10:30", status: "no-show", source: "online", paidShare: 0 },
  { id: "v-11", customerId: "c-naa", branchId: "b-westhills", staffId: "st-abena", serviceIds: ["s-gel"], dayOffset: -5, time: "15:00", status: "done", source: "online", paidShare: 1 },
  { id: "v-12", customerId: "c-ruth", branchId: "b-airport", staffId: "st-joyce", serviceIds: ["s-facial"], dayOffset: -3, time: "11:00", status: "done", source: "online", paidShare: 1 },

  // Today
  { id: "v-13", customerId: "c-esi", branchId: "b-westhills", staffId: "st-adwoa", serviceIds: ["s-weave"], dayOffset: 0, time: "09:00", status: "in-chair", source: "online" },
  { id: "v-14", customerId: "c-kwame", branchId: "b-westhills", staffId: "st-kwabena", serviceIds: ["s-cut", "s-shapeup"], dayOffset: 0, time: "10:00", status: "arrived", source: "walkin", paidShare: 0 },
  { id: "v-15", customerId: "c-abigail", branchId: "b-westhills", staffId: "st-abena", serviceIds: ["s-pedi"], dayOffset: 0, time: "13:00", status: "confirmed", source: "online" },
  { id: "v-16", customerId: "c-naa", branchId: "b-westhills", staffId: "st-efua", serviceIds: ["s-cornrows"], dayOffset: 0, time: "14:30", status: "confirmed", source: "whatsapp", paidShare: 0 },
  { id: "v-17", customerId: "c-selorm", branchId: "b-airport", staffId: "st-yaw", serviceIds: ["s-cut"], dayOffset: 0, time: "17:00", status: "confirmed", source: "online" },
  { id: "v-18", customerId: "c-yaa", branchId: "b-kumasi", staffId: "st-priscilla", serviceIds: ["s-mani"], dayOffset: 0, time: "15:00", status: "requested", source: "online", paidShare: 0 },

  // Coming up
  { id: "v-19", customerId: "c-adjoa", branchId: "b-westhills", staffId: "st-efua", serviceIds: ["s-knotless"], dayOffset: 2, time: "09:00", status: "confirmed", source: "online", notes: "Bringing her own hair." },
  { id: "v-20", customerId: "c-ruth", branchId: "b-airport", staffId: "st-akosua", serviceIds: ["s-locs"], dayOffset: 3, time: "11:00", status: "confirmed", source: "online" },
  { id: "v-21", customerId: "c-esi", branchId: "b-airport", staffId: "st-joyce", serviceIds: ["s-massage", "s-scrub"], dayOffset: 5, time: "15:00", status: "confirmed", source: "online" },
  { id: "v-22", customerId: "c-kwame", branchId: "b-westhills", staffId: "st-kwabena", serviceIds: ["s-cut"], dayOffset: 6, time: "18:30", status: "requested", source: "online", paidShare: 0 },
];

function buildVisit(spec: VisitSpec, index: number, now: Date, counters: { receipt: number }): Visit {
  const day = startOfDay(new Date(now.getTime() + spec.dayOffset * 86_400_000));
  const start = `${dayKey(day)}T${spec.time}`;
  const services = spec.serviceIds.map(serviceById).filter((s): s is Service => Boolean(s));
  const items: VisitItem[] = services.map((service, i) => ({ id: `${spec.id}-i${i}`, serviceId: service.id, price: service.price, minutes: service.minutes }));
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const minutes = items.reduce((sum, item) => sum + item.minutes, 0);

  const createdAt = new Date(day.getTime() - 3 * 86_400_000).toISOString();
  const history: { status: VisitStatus; at: string }[] = [{ status: "requested", at: createdAt }];
  const order: VisitStatus[] = ["confirmed", "arrived", "in-chair", "done"];
  const reached = order.indexOf(spec.status);
  for (let i = 0; i <= reached; i++) history.push({ status: order[i]!, at: createdAt });
  if (spec.status === "cancelled" || spec.status === "no-show") history.push({ status: spec.status, at: createdAt });

  const paid = Math.round(total * (spec.paidShare ?? 0));
  const payments: Payment[] = paid
    ? [
        {
          id: `${spec.id}-p1`,
          amount: paid,
          method: spec.source === "walkin" ? "cash" : "momo",
          reference: spec.source === "walkin" ? "Cash" : "MoMo at the desk",
          at: new Date(day.getTime() + 9 * 3_600_000).toISOString(),
          receiptNo: receiptNumber(day.getFullYear(), ++counters.receipt),
          kind: paid >= total ? "final" : "part",
          // Everything is paid at the salon, whichever way the visit was booked.
          receivedBy: "Front desk",
        },
      ]
    : [];

  return {
    id: spec.id,
    number: visitNumber(1000 + index),
    customerId: spec.customerId,
    branchId: spec.branchId,
    staffId: spec.staffId,
    items,
    start,
    minutes,
    createdAt,
    status: spec.status,
    history,
    source: spec.source,
    total,
    payments,
    notes: spec.notes,
    rebookDue: spec.status === "done" ? rebookDue(services, day) : undefined,
  };
}

function defaultReviews(now: Date): Review[] {
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  return [
    { id: "r-1", name: "Esi M.", rating: 5, text: "The pedicure is the best I have had in Accra. Booked and paid on my phone in two minutes.", at: ago(12), branchId: "b-airport", serviceId: "s-pedi", staffId: "st-linda", status: "published" },
    { id: "r-2", name: "Adjoa F.", rating: 5, text: "Efua does my knotless every six weeks and it never hurts. Worth the drive to Weija.", at: ago(30), branchId: "b-westhills", serviceId: "s-knotless", staffId: "st-efua", status: "published" },
    { id: "r-3", name: "Selorm A.", rating: 4, text: "Clean fade, in and out in forty minutes on my lunch break.", at: ago(20), branchId: "b-airport", serviceId: "s-cut", staffId: "st-yaw", status: "published" },
    { id: "r-4", name: "Yaa B.", rating: 5, text: "Walked in on a Saturday in Kumasi expecting to wait an hour. They seated me in ten minutes.", at: ago(17), branchId: "b-kumasi", staffId: "st-ama", status: "published" },
    { id: "r-5", name: "Abigail N.", rating: 4, text: "Nail art was lovely. Wish the price list had been online before I came.", at: ago(8), branchId: "b-westhills", serviceId: "s-nailart", staffId: "st-abena", status: "pending" },
  ];
}

export function createSeed(now: Date): AppData {
  const counters = { receipt: 0 };
  const visits = HISTORY.map((spec, index) => buildVisit(spec, index, now, counters));
  return {
    version: SEED_VERSION,
    branches: defaultBranches(),
    services: defaultServices(),
    staff: defaultStaff(),
    customers: defaultCustomers(now),
    visits,
    reviews: defaultReviews(now),
    settings: defaultSettings(),
    session: { customerId: null },
    device: { contact: null, visitIds: [], branchId: null, savedServiceIds: [] },
    counters: { visit: 1000 + visits.length, receipt: counters.receipt },
  };
}

/** Handy for the demo: the next free-looking time today, used by the "book now" shortcut. */
export function suggestedStart(now: Date): string {
  const next = new Date(now);
  next.setHours(next.getHours() + 2, 0, 0, 0);
  return localIso(next);
}
