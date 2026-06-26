import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { BackToHome } from "@/components/site/BackToHome";
import kioskUnit from "@/assets/kiosk-unit.jpg";

export const Route = createFileRoute("/event")({
  head: () => ({
    meta: [
      { title: "Event — Memorable Moment · dpotopoto.com" },
      { name: "description", content: "Run a memorable event: create your own frame, let guests snap from any device, share digitally or print." },
      { property: "og:title", content: "Event — Memorable Moment · dpotopoto.com" },
      { property: "og:description", content: "One frame, any device. Share a QR — every guest becomes the photographer." },
    ],
  }),
  component: EventPage,
});

const bullets = [
  {
    n: "01",
    title: "Bring your own frame",
    body: "Create or upload your custom frame for the event — branded, themed, or fully bespoke.",
  },
  {
    n: "02",
    title: "Any device, any guest",
    body: "Smartphone, tablet, or laptop — anyone can snap a photo or upload their favorite shot.",
  },
  {
    n: "03",
    title: "One booth, or many",
    body: "Provide a single device as a photobooth, or share a QR code so every guest uses your frame from their own phone.",
  },
  {
    n: "04",
    title: "Share or print",
    body: "Guests pick their outcome — instant digital share, or send straight to the printer queue.",
  },
];

function EventPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-6 pt-4">
        <BackToHome />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-12 pb-24">
        <div className="absolute inset-0 grid-noise opacity-30" aria-hidden />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // 04 / Event
            </div>
            <h1 className="mb-8 text-5xl font-bold uppercase tracking-tighter md:text-7xl">
              Memorable<br />Moment.
            </h1>
            <p className="mb-10 max-w-md text-base text-foreground/60">
              Turn any gathering into a shared photo experience. Your frame, your guests' devices, your choice to share or print.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/frame"><NeonButton size="lg" glow>Start an Event</NeonButton></Link>
              <Link to="/printer"><NeonButton size="lg" variant="ghost">Open Printer Booth</NeonButton></Link>
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
                alt="Event booth with neon-mint frame"
                width={1024}
                height={1024}
                className="size-full object-cover"
              />
              <div className="scanlines pointer-events-none absolute inset-0 opacity-15" />
            </div>
          </div>
        </div>
      </section>

      {/* How it runs */}
      <section className="border-y border-primary/10 bg-muted/30 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // How_It_Runs
            </div>
            <h2 className="mt-4 text-4xl font-bold uppercase tracking-tighter md:text-5xl">
              Four moves. One memorable night.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {bullets.map((s) => (
              <div key={s.n} className="border border-primary/10 bg-background/60 p-6">
                <div className="mb-4 font-mono text-3xl font-bold text-primary">{s.n}</div>
                <h3 className="mb-3 text-lg font-bold uppercase tracking-tight">{s.title}</h3>
                <p className="text-sm text-foreground/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
