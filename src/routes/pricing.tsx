import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PricingGrid } from "./index";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — d'poto" },
      { name: "description", content: "Simple pay-as-you-snap pricing for d'poto photo booth, frame booth, kiosk, and printer." },
      { property: "og:title", content: "Pricing — d'poto" },
      { property: "og:description", content: "Free trial, Pro (IDR 49K / $4.99), Business (IDR 149K / $12.99). Pay-per-print on kiosks." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="px-6 pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // Pricing
          </div>
          <h1 className="text-5xl font-bold uppercase tracking-tighter md:text-6xl">
            Pay only when<br />you snap.
          </h1>
          <p className="mt-6 max-w-xl text-base text-foreground/60">
            Free trial for personal capture. Per-event packs for hosts. Pay-per-print at kiosks.
            No hidden fees, no surprise renewals.
          </p>
        </div>
      </div>
      <PricingGrid />
      <SiteFooter />
    </div>
  );
}
