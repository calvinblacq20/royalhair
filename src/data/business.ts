import type { Branch } from "./types";

/**
 * The salon's own details. Everything here is editable from Settings; these are the
 * starting values, taken from their Instagram and TikTok bios (docs/PRD.md).
 */
export interface SalonSettings {
  salon: {
    name: string;
    tagline: string;
    /** The line under the name on the home page, e.g. "Barbershop · Salon · Spa". */
    category: string;
    about: string;
    /** Where the branches are, in a few words. */
    area: string;
    /** Sample figures for the demo, shown with a "Demo" tag. */
    rating: number;
    reviewCount: number;
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
      tagline: "Barbershop, salon and spa",
      category: "Barbershop · Salon · Spa",
      about:
        "Royal Hair Salon & Spa is a barbershop, hair salon, nail bar and spa under one roof, with branches at West Hills Mall, Airport Residential and Kumasi. Men come for cuts, fades and beard work; women for braids, weaves, relaxers, colour and silk presses; everyone for nails, pedicures and massage. Kids are welcome at every branch.",
      area: "West Hills Mall · Airport · Kumasi",
      rating: 4.8,
      reviewCount: 96,
      phone: "024 613 6708",
      landline: "030 290 9560",
      // Not published anywhere yet: set it in Settings once the salon gives one.
      email: "",
      whatsappBusiness: "https://wa.me/233246136708",
      instagram: "https://www.instagram.com/royalhair_gh/",
      tiktok: "https://www.tiktok.com/@royalhairgh",
      momo: "024 613 6708",
      momoName: "Royal Hair Salon & Spa",
    },
    policies: {
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

/** Stills from the salon's own TikTok posts (docs/photo-sources.md), for the home page carousel. */
export const SALON_PHOTOS = [
  { src: "/photos/barber-kid-cut.webp", alt: "A barber giving a young client a haircut", position: "center 30%" },
  { src: "/photos/ombre-curls.webp", alt: "Long ombré curls on a client in the chair", position: "center 35%" },
  { src: "/photos/barbershop-pole.webp", alt: "The barber pole on the salon's red wall", position: "center 40%" },
  { src: "/photos/nail-bar.webp", alt: "Nail technicians at work at the nail bar", position: "center 45%" },
  { src: "/photos/salon-floor.webp", alt: "A client on the Royal Hair salon floor, red walls and mirrors behind", position: "center 30%" },
] as const;

/** The lookbook strip on the home page: one photo per kind of work, each opening that part of the menu. */
export const LOOKBOOK = [
  { id: "fade", label: "Fades", group: "barbering", src: "/photos/fade-detail.webp" },
  { id: "silk", label: "Silk press", group: "hair", src: "/photos/silk-press.webp" },
  { id: "nails", label: "Nails", group: "nails", src: "/photos/nails-red.webp" },
  { id: "colour", label: "Colour", group: "hair", src: "/photos/blonde-cut.webp" },
  { id: "pedicure", label: "Pedicure", group: "nails", src: "/photos/pedicure.webp" },
  { id: "locs", label: "Locs", group: "hair", src: "/photos/locs.webp" },
  { id: "kids", label: "Kids", group: "kids", src: "/photos/kids-braids.webp" },
  { id: "art", label: "Nail art", group: "nails", src: "/photos/nails-floral.webp" },
] as const;

export const SALON_FEATURES = [
  { icon: "scissors", label: "Barbers and stylists under one roof" },
  { icon: "users", label: "Kids welcome at every branch" },
  { icon: "map", label: "Three branches: West Hills Mall, Airport and Kumasi" },
  { icon: "wallet", label: "MoMo, card and cash" },
  { icon: "calendar", label: "Book online, on WhatsApp, or walk in" },
  { icon: "sparkles", label: "Every price published before you book" },
] as const;
