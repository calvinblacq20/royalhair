import type { Branch } from "./types";

/**
 * The salon's own details. Everything here is editable from Settings; these are the
 * starting values, taken from their Instagram and TikTok bios (docs/PRD.md).
 */
export interface SalonSettings {
  salon: {
    name: string;
    tagline: string;
    /** The central WhatsApp number in the bio. Branch numbers live on each branch. */
    phone: string;
    landline: string;
    email: string;
    whatsappBusiness: string;
    instagram: string;
    tiktok: string;
    /** MoMo number money is collected on. */
    momo: string;
    momoName: string;
  };
  policies: {
    /** Share of the price taken as a deposit when booking online, 0–1. */
    depositRate: number;
    /** Hours before the start after which a booking can no longer be cancelled online. */
    cancelWindowHours: number;
    /** Minutes of slack left between visits for cleaning down the chair. */
    turnaroundMinutes: number;
    receiptFooter: string;
  };
}

/** Mall branches follow mall hours; the Airport branch opens earlier and closes later. */
const MALL_HOURS = [
  ["10:00", "20:00"], // Sunday
  ["09:00", "20:00"],
  ["09:00", "20:00"],
  ["09:00", "20:00"],
  ["09:00", "20:00"],
  ["09:00", "21:00"],
  ["08:00", "21:00"], // Saturday
] as const;

const AIRPORT_HOURS = [
  null, // Sunday, closed
  ["08:00", "19:00"],
  ["08:00", "19:00"],
  ["08:00", "19:00"],
  ["08:00", "19:00"],
  ["08:00", "20:00"],
  ["08:00", "20:00"],
] as const;

/**
 * The three branches. Addresses, numbers and Plus Codes come from their bios and public listings.
 * Hours and chair counts are working assumptions until the owner confirms them: no branch
 * publishes opening hours anywhere today (see docs/PRD.md).
 */
export function defaultBranches(): Branch[] {
  return [
    {
      id: "b-westhills",
      name: "West Hills Mall",
      area: "Weija",
      address: "West Hills Mall, Mile 11, Weija, Accra",
      phone: "030 396 5412",
      plusCode: "GMW4+25G",
      landmark: "Inside West Hills Mall on the Kasoa road at Mile 11",
      hours: [...MALL_HOURS],
      chairs: 8,
      active: true,
    },
    {
      id: "b-airport",
      name: "Airport",
      area: "Airport Residential",
      address: "14 Casely Hayford Road, Airport Residential, Accra",
      phone: "050 025 2019",
      hours: [...AIRPORT_HOURS],
      chairs: 6,
      active: true,
    },
    {
      id: "b-kumasi",
      name: "Kumasi",
      area: "Kumasi",
      // Listed publicly as "Kumasi Mall" with this Plus Code. The branch has no published number of its
      // own, so bookings route to the central WhatsApp line until the owner confirms one.
      address: "Kumasi City Mall, Kumasi",
      phone: "024 613 6708",
      plusCode: "M9CV+QC7",
      hours: [...MALL_HOURS],
      chairs: 6,
      active: true,
    },
  ];
}

export function defaultSettings(): SalonSettings {
  return {
    salon: {
      name: "Royal Hair",
      tagline: "Hair, nails and spa",
      phone: "024 613 6708",
      landline: "030 290 9560",
      email: "hello@royalhair.gh",
      whatsappBusiness: "https://wa.me/233246136708",
      instagram: "https://www.instagram.com/royalhair_gh/",
      tiktok: "https://www.tiktok.com/@royalhairgh",
      momo: "024 613 6708",
      momoName: "Royal Hair Salon & Spa",
    },
    policies: {
      depositRate: 0.3,
      cancelWindowHours: 24,
      turnaroundMinutes: 10,
      receiptFooter: "Thank you for choosing Royal Hair Salon & Spa.",
    },
  };
}

export function cloneSettings(settings: SalonSettings): SalonSettings {
  return {
    salon: { ...settings.salon },
    policies: { ...settings.policies },
  };
}

/**
 * Live copies every screen reads. `applySettings` and `applyBranches` are called by the store
 * whenever saved data loads or changes, so screens can import these directly.
 */
export const SALON = defaultSettings().salon;
export const POLICIES = defaultSettings().policies;
export let BRANCHES: Branch[] = defaultBranches();

export function applySettings(settings: SalonSettings) {
  Object.assign(SALON, settings.salon);
  Object.assign(POLICIES, settings.policies);
}

export function applyBranches(branches: Branch[]) {
  BRANCHES = branches;
}

export function branchById(id: string): Branch | undefined {
  return BRANCHES.find((b) => b.id === id);
}

/** The branch a client is most likely to want first: the biggest one. */
export function defaultBranch(): Branch {
  return BRANCHES.find((b) => b.active) ?? BRANCHES[0]!;
}
