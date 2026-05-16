import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import kioskUnit from "@/assets/kiosk-unit.jpg";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "Kiosk Mode — d'poto" },
      { name: "description", content: "Turn any tablet or big monitor into a physical photo booth. Phone-as-remote, standby attract loop, wireless print server." },
      { property: "og:title", content: "Kiosk Mode — d'poto" },
      { property: "og:description", content: "Physical photo booth in software. Set up in minutes — no app install for guests." },
    ],
  }),
  component: KioskPage,
});

const steps = [
  {
    n: "01",
    title: "Mount any screen",
    body: "iPad, Android tablet, 27\" to 100\" monitor — portrait or landscape. The booth opens in a browser.",
  },
  {
    n: "02",
    title: "Standby attracts",
    body: "Looping intro carousel + your ad clips + a giant QR code. Idle screens become marketing.",
  },
  {
    n: "03",
    title: "Guest scans, phone becomes remote",
    body: "No app install. The phone controls the booth, the monitor is the stage. Sync over realtime channel.",
  },
  {
    n: "04",
    title: "Shoot · frame · print",
    body: "Countdown on monitor, capture on the connected camera, review on phone, pay, download or print.",
  },
];

const specs = [
  ["Orientation", "Portrait & Landscape"],
  ["Camera", "Webcam / DSLR / Action cam / Tablet camera"],
  ["Sync", "Realtime channel (~50ms)"],
  ["Print sizes", "2R · 4R · A5 (135×200mm) · A6 · Square"],
  ["Network", "Wi-Fi · 4G · 5G"],
  ["Payments", "Midtrans (IDR) · Lemon Squeezy (USD)"],
];

function KioskPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-24">
        <div className="absolute inset-0 grid-noise opacity-30" aria-hidden />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // Kiosk_Mode
            </div>
            <h1 className="mb-8 text-5xl font-bold uppercase tracking-tighter md:text-7xl">
              A photo booth<br />in a browser tab.
            </h1>
            <p className="mb-10 max-w-md text-base text-foreground/60">
              Build a side income with a physical booth at any event. Or run a permanent installation in your café, mall, or studio.
            </p>
            <div className="flex flex-wrap gap-4">
              <NeonButton size="lg" glow>Launch a Kiosk</NeonButton>
              <NeonButton size="lg" variant="ghost">Operator Guide (PDF)</NeonButton>
            </div>
          </div>

          <div className="metal-panel relative border border-black/60 p-3">
            <span className="rivet absolute top-2 left-2 size-2 rounded-full" />
            <span className="rivet absolute top-2 right-2 size-2 rounded-full" />
            <span className="rivet absolute bottom-2 left-2 size-2 rounded-full" />
            <span className="rivet absolute bottom-2 right-2 size-2 rounded-full" />
            <div className="relative aspect-square overflow-hidden bg-black">
              <img
                src={kioskUnit}
                alt="Industrial photo booth kiosk"
                width={1024}
                height={1024}
                className="size-full object-cover"
              />
              <div className="scanlines pointer-events-none absolute inset-0 opacity-15" />
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-primary/10 bg-muted/30 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // How_It_Runs
            </div>
            <h2 className="mt-4 text-4xl font-bold uppercase tracking-tighter md:text-5xl">
              Four moves. Live in minutes.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="border border-primary/10 bg-background/60 p-6">
                <div className="mb-4 font-mono text-3xl font-bold text-primary">{s.n}</div>
                <h3 className="mb-3 text-lg font-bold uppercase tracking-tight">{s.title}</h3>
                <p className="text-sm text-foreground/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // Specs_Sheet
          </div>
          <div className="border border-primary/20 metal-panel">
            <dl className="divide-y divide-primary/10">
              {specs.map(([k, v]) => (
                <div key={k} className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-3">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary/70">{k}</dt>
                  <dd className="font-mono text-sm text-foreground/90 sm:col-span-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
