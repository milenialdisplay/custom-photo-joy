import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BackToHome } from "@/components/site/BackToHome";
import { EventWizard } from "@/components/event/EventWizard";
import { supabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/event")({
  head: () => ({
    meta: [
      { title: "Event — Memorable Moment · dpotopoto.com" },
      { name: "description", content: "Set up your event: pick a tier, package, and album PIN. Get a branded gallery and optional booth prints." },
      { property: "og:title", content: "Event — Memorable Moment · dpotopoto.com" },
      { property: "og:description", content: "One frame, any device. Branded gallery + optional booth prints." },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <BackToHome />
        <div className="mt-4 mb-8 border-b border-primary/15 pb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // 04 / EVENT — Memorable Moment
          </div>
          <h1 className="mt-3 text-3xl font-bold uppercase tracking-tighter md:text-4xl">
            Set up your event.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground/60">
            Name, date, tier, and package. Pay (or mark as paid for testing), then customize your frame and share the QR with guests.
          </p>
        </div>

        {!supabaseConfigured ? (
          <div className="border border-orange-500/40 bg-orange-500/5 p-4 font-mono text-xs text-orange-300">
            Supabase not configured. Set BYO_SUPABASE_* secrets and rebuild. See docs/BYO_SUPABASE_SETUP.md.
          </div>
        ) : (
          <EventWizard />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
