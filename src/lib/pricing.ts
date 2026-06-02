/**
 * Pricing defaults for the dpotopoto print booth.
 *
 * Real per-booth prices come from the agent at GET /api/config (see
 * useBoothConfig). These defaults are only used when the booth agent is
 * unreachable, so the /print page can still render.
 *
 * Prices are ADJUSTABLE — operators edit them in agent/config.json on the
 * Dell. Flat per-sheet pricing, no bulk discount.
 */

export type PaperSize = "A4" | "A5";

export const PAPER_SIZES: readonly PaperSize[] = ["A4", "A5"] as const;

export const DEFAULT_PRICES_IDR: Record<PaperSize, number> = {
  A4: 15000,
  A5: 5000,
};

export const MAX_FILES_PER_ORDER = 10;
export const MAX_COPIES_PER_JOB = 10;

export function formatIDR(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

export function priceFor(size: PaperSize, prices: Record<PaperSize, number>): number {
  return prices[size] ?? DEFAULT_PRICES_IDR[size];
}
