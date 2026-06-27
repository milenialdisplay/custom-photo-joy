// Pure pricing helpers for the event wizard.
export type Tier = "t100" | "t100plus";
export type Package = "A" | "B";

export const TIER_LABELS: Record<Tier, string> = {
  t100: "Up to 100 guests",
  t100plus: "100+ guests",
};

export const PACKAGE_LABELS: Record<Package, string> = {
  A: "Digital sharing only",
  B: "Digital sharing + Prints",
};

export const PRINTS_INCLUDED: Record<Tier, Record<Package, number>> = {
  t100: { A: 0, B: 100 },
  t100plus: { A: 0, B: 0 }, // 100+ uses add-on packs only
};

export const ADDON_PACK = { prints: 20, price: 100_000 } as const;

/** Base package price (no add-ons). */
export function basePrice(tier: Tier, pkg: Package): number {
  if (pkg === "A") return tier === "t100" ? 50_000 : 100_000;
  // package B
  return tier === "t100" ? 500_000 : 0; // t100plus starts at 0 + add-ons
}

export function addonsPrice(addonPacks: number): number {
  return Math.max(0, addonPacks) * ADDON_PACK.price;
}

export function totalPrice(tier: Tier, pkg: Package, addonPacks: number): number {
  return basePrice(tier, pkg) + (pkg === "B" ? addonsPrice(addonPacks) : 0);
}

export function totalPrints(tier: Tier, pkg: Package, addonPacks: number): number {
  return PRINTS_INCLUDED[tier][pkg] + (pkg === "B" ? Math.max(0, addonPacks) * ADDON_PACK.prints : 0);
}

export function formatIDR(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export const MAX_PHOTOS_PER_GUEST = 35;
