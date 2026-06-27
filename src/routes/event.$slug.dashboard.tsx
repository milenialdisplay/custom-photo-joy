import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BackToHome } from "@/components/site/BackToHome";
import { NeonButton } from "@/components/site/NeonButton";
import { EventQR } from "@/components/event/EventQR";
import { getEventBySlug, listEventPhotos, publicUrlForPath, type EventRow, type EventPhotoRow } from "@/lib/events";
import { addPrintCredits } from "@/lib/events.functions";
import { ADDON_PACK, formatIDR } from "@/lib/event-pricing";

export const Route = createFileRoute("/event/$slug/dashboard")({
  head: ({ params }) => ({
    meta: [
      { title: `Dashboard · ${params.slug} · dpotopoto.com` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { slug } = Route.useParams();
  const addCredits = useServerFn(addPrintCredits);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<EventPhotoRow[]>([]);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const ev = await getEventBySlug(slug);
    if (!ev) return;
    setEvent(ev);
    setPhotos(await listEventPhotos(ev.id));
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function buyMore() {
    if (!event) return;
    setBusy(true);
    try {
      const res = await addCredits({ data: { eventId: event.id, packs: 1 } });
      toast.success(`Added ${res.added} prints`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-6 py-12 font-mono text-xs text-foreground/50">
          Loading…
        </main>
        <SiteFooter />
      </div>
    );
  }

  const used = (event.print_credits ?? 0) - (event.print_credits_remaining ?? 0);
  const total = event.print_credits ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <BackToHome />
        <div className="mt-4 mb-8 border-b border-primary/15 pb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // EVENT · DASHBOARD · {event.name}
          </div>
          <h1 className="mt-3 text-3xl font-bold uppercase tracking-tighter md:text-4xl">
            {event.name}
          </h1>
          <p className="mt-2 font-mono text-xs text-foreground/60">
            PIN <span className="text-primary tracking-widest">{event.access_pin}</span> · Bucket{" "}
            <span className="text-primary">{event.bucket_name}</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Photos uploaded" value={photos.length} />
          <Stat label="Prints used" value={`${used} / ${total}`} />
          <Stat label="Package" value={`${event.package ?? "—"} · ${event.guest_tier ?? "—"}`} />
        </div>

        {event.package === "B" && (
          <div className="mt-6 border border-primary/20 bg-background/40 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
              // Buy more prints
            </div>
            <p className="mt-1 font-mono text-xs text-foreground/60">
              {ADDON_PACK.prints} prints · {formatIDR(ADDON_PACK.price)} per pack
            </p>
            <div className="mt-3">
              <NeonButton size="md" disabled={busy} onClick={buyMore}>
                {busy ? "…" : `+ 20 prints (dev add)`}
              </NeonButton>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <EventQR label="// BOOTH QR" url={`${origin}/e/${slug}/capture?booth=1`} filename={`${slug}-booth-qr.png`} />
          <EventQR label="// SHARE QR" url={`${origin}/e/${slug}`} filename={`${slug}-share-qr.png`} />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link to="/event/$slug/frame" params={{ slug }}>
            <NeonButton size="md" variant="ghost">Customize frame →</NeonButton>
          </Link>
          <Link to="/e/$slug" params={{ slug }}>
            <NeonButton size="md" variant="ghost">View album →</NeonButton>
          </Link>
        </div>

        {photos.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
              // Latest photos
            </div>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {photos.slice(0, 12).map((p) => (
                <img
                  key={p.id}
                  src={publicUrlForPath(p.storage_path)}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              ))}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-primary/20 bg-background/40 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">{label}</div>
      <div className="mt-2 text-3xl font-bold text-primary">{value}</div>
    </div>
  );
}
