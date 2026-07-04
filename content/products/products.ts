/**
 * Single source of truth for affiliate products.
 *
 * `affiliateUrl` uses "#TODO-<id>" placeholders. Swap these for the real
 * tracking links in THIS ONE FILE when the affiliate programs are approved —
 * every <a> on the site routes through /go/[id], so no post needs editing.
 */

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  /** Real affiliate/tracking URL. Placeholder "#TODO-<id>" until approved. */
  affiliateUrl: string;
  /** Affiliate network, or "in-house" for direct programs. */
  network: string;
  /** Commission as displayed (e.g. "15%", "20-25%"). */
  commission: string;
  /** Cookie window in days, or null if unknown/session-based. */
  cookieDays: number | null;
  /** Approximate retail price in USD. */
  priceApprox: number;
  /** Whether this product carries an affiliate relationship (drives disclosure). */
  disclosure: boolean;
  /** Whether the product genuinely aligns with the brand (only recommend aligned=true). */
  aligned: boolean;
}

export const products: Product[] = [
  {
    id: "loop-experience",
    name: "Loop Experience",
    brand: "Loop",
    category: "earplugs",
    affiliateUrl: "#TODO-loop-experience",
    network: "Impact",
    commission: "15%",
    cookieDays: 30,
    priceApprox: 34.95,
    disclosure: true,
    aligned: true,
  },
  {
    id: "eargasm-hifi",
    name: "Eargasm High Fidelity Earplugs",
    brand: "Eargasm",
    category: "earplugs",
    affiliateUrl: "#TODO-eargasm-hifi",
    network: "in-house",
    commission: "15%",
    cookieDays: null,
    priceApprox: 39,
    disclosure: true,
    aligned: true,
  },
  {
    id: "alpine-partyplug",
    name: "Alpine PartyPlug",
    brand: "Alpine",
    category: "earplugs",
    affiliateUrl: "#TODO-alpine-partyplug",
    network: "Awin",
    commission: "12.5%",
    cookieDays: null,
    priceApprox: 25,
    disclosure: true,
    aligned: true,
  },
  {
    id: "cure-hydration",
    name: "Cure Hydration Electrolyte Mix",
    brand: "Cure Hydration",
    category: "hydration",
    affiliateUrl: "#TODO-cure-hydration",
    network: "Impact",
    commission: "20-25%",
    cookieDays: null,
    priceApprox: 40,
    disclosure: true,
    aligned: true,
  },
  {
    id: "today-glitter",
    name: "Today Glitter Bio-Glitter",
    brand: "Today Glitter",
    category: "beauty",
    affiliateUrl: "#TODO-today-glitter",
    network: "ShareASale",
    commission: "15%",
    cookieDays: null,
    priceApprox: 12,
    disclosure: true,
    aligned: true,
  },
  {
    id: "rave-doctor",
    name: "Rave Doctor Recovery",
    brand: "Rave Doctor",
    category: "recovery",
    affiliateUrl: "#TODO-rave-doctor",
    network: "in-house",
    commission: "20%",
    cookieDays: null,
    priceApprox: 30,
    disclosure: true,
    aligned: true,
  },
  {
    id: "testkitplus",
    name: "TestKitPlus Reagent Test Kit",
    brand: "TestKitPlus",
    category: "harm-reduction",
    affiliateUrl: "#TODO-testkitplus",
    network: "in-house",
    commission: "25%",
    cookieDays: null,
    priceApprox: 40,
    disclosure: true,
    aligned: true,
  },
];
