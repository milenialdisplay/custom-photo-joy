import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BackToHome } from "@/components/site/BackToHome";
import { NeonButton } from "@/components/site/NeonButton";
import { PinGate } from "@/components/event/PinGate";
import { listEventPhotos, publicUrlForPath, type EventRow, type EventPhotoRow } from "@/lib/events";

export const Route = createFileRoute("/e/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Album · ${params.slug} · dpotopoto.com` },
      { name: "description", content: "Branded event photo album." },
    ],
  }),
  component: AlbumPage,
});

function AlbumPage() {
  const { slug } = Route.useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [photos, setPhotos] = useState<EventPhotoRow[]>([]);

  const handleUnlocked = useCallback((ev: EventRow) => {
    setEvent(ev);
  }, []);

  useEffect(() => {
    if (!event) return;
    let cancel = false;
    async function load() {
      const rows = await listEventPhotos(event!.id);
      if (!cancel) setPhotos(rows);
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [event]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <BackToHome />
        {!event ? (
          <div className="mt-10">
            <PinGate slug={slug} onUnlocked={handleUnlocked} />
          </div>
        ) : (
          <>
            <div className="mt-4 mb-6 border-b border-primary/15 pb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">// ALBUM</div>
              <h1 className="mt-2 text-3xl font-bold uppercase tracking-tighter">{event.name}</h1>
              <p className="mt-2 font-mono text-xs text-foreground/60">
                {photos.length} photo{photos.length === 1 ? "" : "s"}
              </p>
              <div className="mt-3">
                <Link to="/e/$slug/capture" params={{ slug }}>
                  <NeonButton size="md" glow>+ Add your photo</NeonButton>
                </Link>
              </div>
            </div>
            {photos.length === 0 ? (
              <div className="border border-dashed border-primary/30 bg-primary/5 p-8 text-center font-mono text-xs text-foreground/50">
                No photos yet. Be the first to upload!
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {photos.map((p) => (
                  <a key={p.id} href={publicUrlForPath(p.storage_path)} target="_blank" rel="noreferrer">
                    <img src={publicUrlForPath(p.storage_path)} alt="" className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
