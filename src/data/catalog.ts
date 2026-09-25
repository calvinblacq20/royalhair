import type { Service, ServiceGroup, StaffRole } from "./types";

export const ROLE_LABEL: Record<StaffRole, string> = {
  stylist: "Stylist",
  barber: "Barber",
  "nail-tech": "Nail technician",
  therapist: "Spa therapist",
  manager: "Senior stylist",
};

export const GROUPS: { id: ServiceGroup; label: string; blurb: string }[] = [
  { id: "hair", label: "Hair", blurb: "Braids, weaves, perms, colour and treatments" },
  { id: "barbering", label: "Barbershop", blurb: "Cuts, shape-ups, dye and beard work" },
  { id: "nails", label: "Nails", blurb: "Manicure, pedicure and nail art" },
  { id: "spa", label: "Spa", blurb: "Massage and body treatments" },
  { id: "kids", label: "Kids", blurb: "Under-12s, hair and cuts" },
];

export const GROUP_LABEL: Record<ServiceGroup, string> = {
  hair: "Hair",
  barbering: "Barbershop",
  nails: "Nails",
  spa: "Spa",
  kids: "Kids",
};

/**
 * The price list Royal Hair has never published anywhere.
 *
 * Every price and duration below is a PLACEHOLDER until the owner confirms the real list.
 * They are checked against the market: Fresha lists Accra braiding at GH₵100–1,000, and a
 * Kumasi barbershop-salon on Fresha (Sept 2026) charges GH₵60 for an adult cut, GH₵40 for a
 * 15-minute shape-up and GH₵50 for kids — see docs/PRD.md.
 */
export function defaultServices(): Service[] {
  return [
    // ---------------- Hair ----------------
    {
      id: "s-knotless",
      priceFrom: true,
      name: "Knotless braids",
      group: "hair",
      description: "Medium knotless braids, shoulder length. Longer or smaller sizes are quoted at the chair.",
      price: 450,
      minutes: 240,
      bookable: true,
      repeatWeeks: 6,
      featured: true,
      tone: "magenta",
    },
    {
      id: "s-cornrows",
      priceFrom: true,
      name: "Cornrows",
      group: "hair",
      description: "Straight-back or patterned cornrows, with or without extensions.",
      price: 180,
      minutes: 120,
      bookable: true,
      repeatWeeks: 4,
      tone: "plum",
    },
    {
      id: "s-weave",
      priceFrom: true,
      name: "Weave install",
      group: "hair",
      description: "Sew-in or closure install. Bring your own bundles or buy in salon.",
      price: 320,
      minutes: 180,
      bookable: true,
      repeatWeeks: 8,
      featured: true,
      tone: "gold",
      photo: "/photos/ombre-curls.webp",
    },
    {
      id: "s-wig",
      name: "Wig install & styling",
      group: "hair",
      description: "Lace or bob wig fitted, blended and styled.",
      price: 250,
      minutes: 120,
      bookable: true,
      repeatWeeks: 4,
      tone: "blush",
      photo: "/photos/ombre-curls.webp",
    },
    {
      id: "s-perm",
      name: "Relaxer / perm",
      group: "hair",
      description: "Relaxer with a protein treatment and finish. We log the date so your regrowth window is on record.",
      price: 220,
      minutes: 120,
      bookable: true,
      repeatWeeks: 10,
      featured: true,
      tone: "magenta",
      photo: "/photos/silk-press.webp",
    },
    {
      id: "s-colour",
      priceFrom: true,
      name: "Colour",
      group: "hair",
      description: "Full colour or highlights. A patch test is needed 48 hours before, once, for new clients.",
      price: 400,
      minutes: 180,
      bookable: true,
      repeatWeeks: 8,
      tone: "plum",
      photo: "/photos/blonde-cut.webp",
    },
    {
      id: "s-treatment",
      name: "Deep conditioning treatment",
      group: "hair",
      description: "Steam treatment for dryness and breakage. Often booked with a wash and set.",
      price: 120,
      minutes: 60,
      bookable: true,
      repeatWeeks: 4,
      tone: "sage",
    },
    {
      id: "s-washset",
      name: "Wash & set",
      group: "hair",
      description: "Shampoo, condition, blow-dry and a finished style.",
      price: 90,
      minutes: 60,
      bookable: true,
      repeatWeeks: 2,
      tone: "champagne",
    },
    {
      id: "s-locs",
      priceFrom: true,
      name: "Locs retwist",
      group: "hair",
      description: "Retwist, wash and style for starter or mature locs.",
      price: 200,
      minutes: 120,
      bookable: true,
      repeatWeeks: 6,
      tone: "mist",
      photo: "/photos/locs.webp",
    },

    // ---------------- Barbering ----------------
    {
      id: "s-cut",
      name: "Men's haircut",
      group: "barbering",
      description: "Clipper cut and shape-up, finished with a hot towel.",
      price: 60,
      minutes: 30,
      bookable: true,
      repeatWeeks: 3,
      featured: true,
      tone: "ink",
      photo: "/photos/fade-detail.webp",
    },
    {
      id: "s-shapeup",
      name: "Shape-up",
      group: "barbering",
      description: "Line-up and edge, no full cut.",
      price: 40,
      minutes: 15,
      bookable: true,
      repeatWeeks: 2,
      tone: "mist",
    },
    {
      id: "s-beard",
      name: "Beard trim & shave",
      group: "barbering",
      description: "Shaped, lined and conditioned.",
      price: 45,
      minutes: 30,
      bookable: true,
      repeatWeeks: 3,
      tone: "ink",
    },
    {
      id: "s-dye",
      name: "Men's dye",
      group: "barbering",
      description: "Hair or beard colour, applied and rinsed.",
      price: 80,
      minutes: 45,
      bookable: true,
      repeatWeeks: 4,
      tone: "plum",
    },

    // ---------------- Nails ----------------
    {
      id: "s-mani",
      name: "Manicure",
      group: "nails",
      description: "Shaped, cuticles tidied, polish of your choice.",
      price: 80,
      minutes: 45,
      bookable: true,
      repeatWeeks: 3,
      featured: true,
      tone: "blush",
      photo: "/photos/nails-pink.webp",
    },
    {
      id: "s-pedi",
      name: "Pedicure",
      group: "nails",
      description: "Soak, scrub, shape and polish. The one people come back for.",
      price: 120,
      minutes: 60,
      bookable: true,
      repeatWeeks: 4,
      featured: true,
      tone: "sage",
      photo: "/photos/pedicure.webp",
    },
    {
      id: "s-gel",
      name: "Gel overlay",
      group: "nails",
      description: "Gel on natural nails, cured and finished.",
      price: 150,
      minutes: 60,
      bookable: true,
      repeatWeeks: 3,
      tone: "magenta",
      photo: "/photos/nails-floral.webp",
    },
    {
      id: "s-acrylic",
      name: "Acrylic set",
      group: "nails",
      description: "Full acrylic set with your choice of shape and length.",
      price: 250,
      minutes: 90,
      bookable: true,
      repeatWeeks: 3,
      tone: "gold",
      photo: "/photos/nails-red.webp",
    },
    {
      id: "s-nailart",
      name: "Nail art (per set)",
      group: "nails",
      description: "Freehand art, chrome or stones, added to any set.",
      price: 60,
      minutes: 30,
      bookable: true,
      repeatWeeks: 0,
      tone: "plum",
    },

    // ---------------- Spa ----------------
    {
      id: "s-massage",
      name: "Full body massage",
      group: "spa",
      description: "One hour, Swedish or deep tissue, with one of our therapists.",
      price: 350,
      minutes: 60,
      bookable: true,
      repeatWeeks: 4,
      featured: true,
      tone: "sage",
    },
    {
      id: "s-backmassage",
      name: "Back, neck & shoulders",
      group: "spa",
      description: "Thirty focused minutes for desk and driving tension.",
      price: 180,
      minutes: 30,
      bookable: true,
      repeatWeeks: 3,
      tone: "mist",
    },
    {
      id: "s-facial",
      name: "Facial",
      group: "spa",
      description: "Cleanse, exfoliate, mask and moisturise for your skin type.",
      price: 280,
      minutes: 60,
      bookable: true,
      repeatWeeks: 4,
      tone: "blush",
    },
    {
      id: "s-scrub",
      name: "Body scrub",
      group: "spa",
      description: "Full body exfoliation and finish.",
      price: 300,
      minutes: 45,
      bookable: true,
      repeatWeeks: 6,
      tone: "champagne",
    },

    // ---------------- Kids ----------------
    {
      id: "s-kidscut",
      name: "Kids' haircut",
      group: "kids",
      description: "Under 12s. Cut, shape and a clean finish.",
      price: 40,
      minutes: 30,
      bookable: true,
      repeatWeeks: 4,
      tone: "sage",
      photo: "/photos/barber-kid-cut.webp",
    },
    {
      id: "s-kidsbraids",
      priceFrom: true,
      name: "Kids' braids",
      group: "kids",
      description: "Under 12s. Cornrows or box braids, done gently.",
      price: 150,
      minutes: 120,
      bookable: true,
      repeatWeeks: 6,
      tone: "blush",
      photo: "/photos/kids-braids.webp",
    },
    {
      id: "s-kidswash",
      name: "Kids' wash & style",
      group: "kids",
      description: "Under 12s. Wash, detangle, condition and style.",
      price: 60,
      minutes: 45,
      bookable: true,
      repeatWeeks: 3,
      tone: "champagne",
    },
  ];
}

/**
 * One photo per part of the menu, all stills from the salon's own TikTok posts
 * (docs/photo-sources.md). Spa has no treatment photo yet, so it shows the salon's decor wall.
 */
export const GROUP_PHOTO: Record<ServiceGroup, { src: string; alt: string }> = {
  hair: { src: "/photos/silk-press.webp", alt: "A stylist combing out a sleek silk-press bob" },
  barbering: { src: "/photos/barbershop-pole.webp", alt: "The barber pole on the salon's red wall" },
  nails: { src: "/photos/nails-red.webp", alt: "Red stiletto nails with bow details" },
  spa: { src: "/photos/decor-wall.webp", alt: "A calm purple wall with plants inside the salon" },
  kids: { src: "/photos/barber-kid-cut.webp", alt: "A barber giving a young client a haircut" },
};

/** Live copy every screen reads; the store refreshes it when saved prices load or change. */
export let SERVICES: Service[] = defaultServices();

export function applyServices(services: Service[]) {
  SERVICES = services;
}

export function serviceById(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function servicesInGroup(group: ServiceGroup): Service[] {
  return SERVICES.filter((s) => s.group === group && s.active !== false);
}

/** Cheapest active price in a group, for the "from GH₵ x" lines on the home page. */
export function fromPrice(group: ServiceGroup): number {
  const prices = servicesInGroup(group).map((s) => s.price);
  return prices.length ? Math.min(...prices) : 0;
}
