export type ID = string;

/** The five things Royal Hair sells. Drives the menu filters and what each staff member can take. */
export type ServiceGroup = "hair" | "barbering" | "nails" | "spa" | "kids";

export type Tone = "magenta" | "plum" | "gold" | "blush" | "sage" | "mist" | "ink" | "champagne";

export interface Branch {
  id: ID;
  name: string;
  /** Short area name used in lists, e.g. "Weija". */
  area: string;
  address: string;
  phone: string;
  /** GhanaPost GPS address, e.g. GA-123-4567. Only set once the branch confirms it. */
  digitalAddress?: string;
  /** Google Plus Code from the public listing, e.g. GMW4+25G. */
  plusCode?: string;
  /** How people actually find it in Ghana: by landmark, not street number. */
  landmark?: string;
  /** Opening hours by weekday index (0 = Sunday). null means closed that day. */
  hours: (readonly [string, string] | null)[];
  chairs: number;
  active: boolean;
}

export interface Service {
  id: ID;
  name: string;
  group: ServiceGroup;
  description: string;
  price: number;
  /** True when length or size changes the price (braids, locs): shown as "from GH₵ x". */
  priceFrom?: boolean;
  /** How long the chair is taken, in minutes. */
  minutes: number;
  /** False keeps it on the price list but off the online booking form. */
  bookable: boolean;
  /** Weeks until this should be repeated. 0 means it has no natural repeat. */
  repeatWeeks: number;
  featured?: boolean;
  /** False hides the service from clients. Past visits keep showing it. */
  active?: boolean;
  tone: Tone;
  /** Optional real photo in /public/photos. */
  photo?: string;
}

export type StaffRole = "stylist" | "barber" | "nail-tech" | "therapist" | "manager";

export interface Staff {
  id: ID;
  name: string;
  branchId: ID;
  role: StaffRole;
  /** Which parts of the menu this person takes. */
  groups: ServiceGroup[];
  /** Weekday indexes they work (0 = Sunday). */
  days: number[];
  /** Share of each service price they earn, 0–1. */
  commission: number;
  active: boolean;
}

export type VisitStatus = "requested" | "confirmed" | "arrived" | "in-chair" | "done" | "cancelled" | "no-show";

/** Where the booking came from. Walk-ins are the majority, so they are first-class. */
export type VisitSource = "online" | "walkin" | "whatsapp" | "phone";

export type PaymentMethod = "momo" | "card" | "cash" | "bank";

export interface StatusEvent {
  status: VisitStatus;
  at: string;
}

export interface Payment {
  id: ID;
  amount: number;
  method: PaymentMethod;
  reference: string;
  at: string;
  receiptNo: string;
  kind: "deposit" | "part" | "final";
  receivedBy: string;
  /** Who or what paid, e.g. "MTN MoMo · 024 613 6708". */
  payer?: string;
}

export interface VisitItem {
  id: ID;
  serviceId: ID;
  /** Copied at booking time so a later price change doesn't rewrite history. */
  price: number;
  minutes: number;
}

export interface Visit {
  id: ID;
  number: string;
  customerId: ID;
  branchId: ID;
  /** The staff member holding the slot. Never empty once confirmed. */
  staffId: ID;
  items: VisitItem[];
  /** Local ISO date-time, YYYY-MM-DDTHH:mm. */
  start: string;
  minutes: number;
  createdAt: string;
  status: VisitStatus;
  history: StatusEvent[];
  source: VisitSource;
  total: number;
  payments: Payment[];
  notes?: string;
  /** Day key the client is due back, from the longest repeatWeeks on the visit. */
  rebookDue?: string;
  /** When the salon last sent this client a WhatsApp message about this visit. */
  lastUpdateAt?: string;
}

/**
 * What the stylist needs to remember about a client and the reason they come back.
 * Never shown to the client.
 */
export interface HairRecord {
  /** Anything that must be checked before a chemical service. */
  allergies?: string;
  /** Scalp, texture, breakage, what worked and what didn't. */
  notes?: string;
  /** e.g. "6N + 20 vol, 35 min". */
  colourFormula?: string;
  /** Day key of the last relaxer, so the regrowth window is obvious. */
  lastRelaxer?: string;
  preferredStaffId?: ID;
  preferredBranchId?: ID;
}

/** How a client first found the salon. */
export type LeadSource = "instagram" | "tiktok" | "walkin" | "referral" | "app";

/**
 * Everyone who has booked, with or without an account. Records are matched by
 * WhatsApp number, so repeat guest bookings land on one customer.
 */
export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email: string;
  /** Town or area, for knowing which branch suits them. */
  area: string;
  memberSince: string;
  /** True once they confirmed their WhatsApp number with a code. Accounts are optional. */
  hasAccount: boolean;
  points: number;
  source?: LeadSource;
  hair?: HairRecord;
}

/** What the customer types at checkout. */
export interface ContactDetails {
  name: string;
  phone: string;
  email: string;
  area: string;
}

export type ReviewStatus = "pending" | "published" | "hidden";

export interface Review {
  id: ID;
  name: string;
  rating: number;
  text: string;
  at: string;
  branchId: ID;
  serviceId?: ID;
  /** Barbershop clients follow a barber, so reviews name who did the work. */
  staffId?: ID;
  customerId?: ID;
  /** Only published reviews appear on the salon page. */
  status: ReviewStatus;
  reply?: string;
}
