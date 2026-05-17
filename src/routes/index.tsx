import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import heroStrip from "@/assets/hero-strip.jpg";
import servicePhoto from "@/assets/service-photo.jpg";
import serviceFrame from "@/assets/service-frame.jpg";
import servicePrint from "@/assets/service-print.jpg";
import kioskUnit from "@/assets/kiosk-unit.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-32">
        <div className="absolute inset-0 grid-noise opacity-40" aria-hidden />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div className="relative animate-flicker">
            <div className="mb-5 font-mono text-xs uppercase tracking-[0.3em] text-primary">
              // System Initialized
            </div>
            <h1 className="mb-8 text-5xl leading-[1.02] font-bold tracking-tighter text-balance md:text-7xl lg:text-[5.5rem]">
              YOUR PHONE IS A <span className="text-primary">NEON</span> BOOTH.
            </h1>
            <p className="mb-10 max-w-md font-mono text-base text-foreground/60">
              Turn any screen into a professional capture station. Instant prints, branded frames, pure arcade energy — for parties, weddings, and brand events.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/camera-test">
                <NeonButton size="lg" glow>Start Free Trial</NeonButton>
              </Link>
              <Link to="/camera-test">
                <NeonButton size="lg" variant="ghost">Try a Demo Booth</NeonButton>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.25em] text-primary/40">
              <span>7-day trial</span>
              <span className="size-1 rounded-full bg-primary/40" />
              <span>20 free exports</span>
              <span className="size-1 rounded-full bg-primary/40" />
              <span>No install</span>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -inset-6 bg-primary/15 opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100" aria-hidden />
            <div className="relative border border-primary/30 bg-card p-3 ring-1 ring-primary/40">
              <div className="absolute top-5 right-5 z-10 flex items-center gap-2 bg-destructive px-2 py-0.5 font-mono text-[10px] font-bold text-destructive-foreground">
                <span className="size-1.5 animate-blink rounded-full bg-destructive-foreground" />
                LIVE FEED
              </div>
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-black">
                <img
                  src={heroStrip}
                  alt="A vertical neon photo booth strip of friends laughing"
                  width={768}
                  height={1152}
                  className="size-full object-cover"
                />
                <div className="scanlines pointer-events-none absolute inset-0 opacity-30" aria-hidden />
              </div>
              <div className="mt-3 flex justify-between px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/50">
                <span>Frame 004/004</span>
                <span>ISO 800</span>
                <span className="text-primary">3 · 2 · 1</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="border-y border-primary/10 bg-muted/30 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 flex items-end justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                // Modules
              </div>
              <h2 className="mt-4 text-4xl font-bold uppercase tracking-tighter md:text-5xl">
                Three ways to snap.
              </h2>
            </div>
            <div className="hidden h-px flex-1 bg-primary/20 md:ml-12 md:block" />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                tag: "01 / Capture",
                title: "Photo Booth",
                desc: "Single shots or classic 4-frame strips. Front, back, webcam, DSLR — any camera works.",
                img: servicePhoto,
                alt: "Printed photo strips on a dark surface",
                href: "/camera-test" as const,
              },
              {
                tag: "02 / Edit",
                title: "Frame Booth",
                desc: "Drop in your logo, slide the hue, drag the caption. Frames adapt in real time.",
                img: serviceFrame,
                alt: "Frame editor UI with neon sliders",
                href: "/studio" as const,
              },
              {
                tag: "03 / Print",
                title: "Printer Booth",
                desc: "Print 2R, 4R, A5, A6 or square at any kiosk. Pay per print. No subscription.",
                img: servicePrint,
                alt: "Thermal printer dispensing a fresh print",
                href: "/printer" as const,
              },
            ].map((s) => {
              const card = (
                <article
                  className="group relative h-full overflow-hidden border border-primary/10 bg-background/60 p-6 transition-colors hover:border-primary/50"
                >
                  <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    {s.tag}
                  </div>
                  <h3 className="mb-3 text-2xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mb-6 text-sm text-foreground/60">{s.desc}</p>
                  <div className="relative aspect-square w-full overflow-hidden border border-primary/10 bg-muted">
                    <img
                      src={s.img}
                      alt={s.alt}
                      loading="lazy"
                      width={768}
                      height={768}
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                </article>
              );
              return (
                <Link key={s.title} to={s.href} className="block">
                  {card}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kiosk pitch — industrial / metal */}
      <section className="relative overflow-hidden px-6 py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div className="relative">
            <div className="metal-panel relative border border-black/60 p-3">
              {/* Rivets */}
              <span className="rivet absolute top-2 left-2 size-2 rounded-full" />
              <span className="rivet absolute top-2 right-2 size-2 rounded-full" />
              <span className="rivet absolute bottom-2 left-2 size-2 rounded-full" />
              <span className="rivet absolute bottom-2 right-2 size-2 rounded-full" />
              <div className="relative aspect-square overflow-hidden bg-black">
                <img
                  src={kioskUnit}
                  alt="Industrial photo booth kiosk with neon mint bezel at an event"
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="size-full object-cover"
                />
                <div className="scanlines pointer-events-none absolute inset-0 opacity-15" aria-hidden />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-primary/50">
              <span>UNIT_KX-01</span>
              <span className="flex items-center gap-2">
                <span className="size-1.5 animate-blink rounded-full bg-primary" />
                Online
              </span>
            </div>
          </div>

          <div>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // Hardware Module
            </div>
            <h2 className="mb-8 text-4xl leading-none font-bold uppercase tracking-tighter md:text-5xl">
              Go physical.<br />
              Big screen. Small footprint.
            </h2>
            <p className="mb-10 max-w-md text-base text-foreground/60">
              Plug any tablet or large monitor into our printer module and turn your venue into a revenue generator. Guests scan a QR with their phone — the screen becomes the stage.
            </p>
            <ul className="mb-12 space-y-3 font-mono text-xs uppercase tracking-[0.2em]">
              {[
                "Portrait & landscape orientation",
                "Standby attract loop (ads + intro carousel)",
                "Phone-as-remote pairing",
                "Wireless print server (2R / 4R / A5 / A6 / square)",
                "Multi-device sync via realtime channel",
              ].map((line) => (
                <li key={line} className="flex items-center gap-4">
                  <span className="size-2 bg-primary" />
                  <span className="text-foreground/80">{line}</span>
                </li>
              ))}
            </ul>
            <Link to="/kiosk">
              <NeonButton size="lg" variant="metal">Explore Kiosk Kit</NeonButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <PricingGrid />

      <SiteFooter />
    </div>
  );
}

export function PricingGrid() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // Select_Plan
          </div>
          <h2 className="mt-4 text-4xl font-bold uppercase tracking-tighter md:text-5xl">
            Pay only when you snap.
          </h2>
          <div className="mt-6 h-px w-24 bg-primary" />
        </div>

        <div className="grid gap-px border border-primary/20 bg-primary/20 md:grid-cols-3">
          {/* Trial */}
          <PlanCard
            tag="Trial_Node"
            name="Free Trial"
            priceMain="$0"
            priceUnit="/ 7 days"
            priceSub="or 20 exports"
            features={[
              { text: "20 total downloads", positive: false },
              { text: "Watermark bar at bottom", positive: false },
              { text: "Photo & Frame booth only", positive: true },
              { text: "All output presets", positive: true },
            ]}
            cta="Initialize"
          />

          {/* Pro */}
          <PlanCard
            highlight
            tag="Main_Process"
            name="Pro"
            priceMain="IDR 49K"
            priceUnit="/ month"
            priceSub="≈ USD 4.99 — 50% off for first 1,000 users"
            features={[
              { text: "50 downloads / mo", positive: true },
              { text: "No watermark", positive: true },
              { text: "1 logo per export (manual upload)", positive: true },
              { text: "Full frame library", positive: true },
            ]}
            cta="Upgrade"
          />

          {/* Business */}
          <PlanCard
            tag="Enterprise_Shell"
            name="Business"
            priceMain="IDR 149K"
            priceUnit="/ event"
            priceSub="≈ USD 12.99 — +IDR 1K / $0.10 per extra"
            features={[
              { text: "200 downloads + overage", positive: true },
              { text: "Up to 3 reusable logos", positive: true },
              { text: "White-label & custom domain", positive: true },
              { text: "Kiosk + vending integration", positive: true },
            ]}
            cta="Contact Sales"
          />
        </div>

        <p className="mt-8 max-w-2xl font-mono text-[11px] text-foreground/40">
          Printer Booth and Kiosk Mode are pay-per-use and not included in the free trial.
        </p>
      </div>
    </section>
  );
}

interface PlanProps {
  tag: string;
  name: string;
  priceMain: string;
  priceUnit: string;
  priceSub?: string;
  features: { text: string; positive: boolean }[];
  cta: string;
  highlight?: boolean;
}

function PlanCard({ tag, name, priceMain, priceUnit, priceSub, features, cta, highlight }: PlanProps) {
  return (
    <div className="relative flex flex-col bg-background p-10">
      {highlight && (
        <>
          <div className="pointer-events-none absolute inset-0 border-2 border-primary" />
          <div className="absolute -top-3 left-10 bg-primary px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground">
            Most Popular
          </div>
        </>
      )}
      <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        {tag}
      </div>
      <h3 className="mb-3 text-3xl font-bold tracking-tight">{name}</h3>
      <div className="mb-8">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold text-primary">{priceMain}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">
            {priceUnit}
          </span>
        </div>
        {priceSub && (
          <div className="mt-1 font-mono text-[10px] text-foreground/40">{priceSub}</div>
        )}
      </div>
      <ul className="mb-10 flex-1 space-y-3 font-mono text-[11px]">
        {features.map((f) => (
          <li key={f.text} className={f.positive ? "text-primary" : "text-foreground/50"}>
            {f.positive ? "+ " : "- "}
            <span className={f.positive ? "text-foreground/90" : ""}>{f.text}</span>
          </li>
        ))}
      </ul>
      <NeonButton
        size="md"
        variant={highlight ? "primary" : "ghost"}
        className="w-full"
      >
        {cta}
      </NeonButton>
    </div>
  );
}
