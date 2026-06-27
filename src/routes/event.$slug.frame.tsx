import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BackToHome } from "@/components/site/BackToHome";
import { NeonButton } from "@/components/site/NeonButton";
import { SingleSlotEditor } from "@/components/event/SingleSlotEditor";
import { EventQR } from "@/components/event/EventQR";
import { getEventBySlug, uploadFrameImage, type EventRow } from "@/lib/events";
import { saveEventFrame } from "@/lib/events.functions";
import { DEFAULT_SLOT, type FrameSlot } from "@/lib/event-render";

export const Route = createFileRoute("/event/$slug/frame")({
  head: ({ params }) => ({
    meta: [
      { title: `Customize frame · ${params.slug} · dpotopoto.com` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FramePage,
});

function FramePage() {
  const { slug } = Route.useParams();
  const save = useServerFn(saveEventFrame);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [slot, setSlot] = useState<FrameSlot>(DEFAULT_SLOT);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    getEventBySlug(slug).then((ev) => {
      if (!ev) {
        toast.error("Event not found");
        return;
      }
      setEvent(ev);
      if (ev.frame_url) setFrameUrl(ev.frame_url);
      if (ev.frame_slot) setSlot(ev.frame_slot as FrameSlot);
    });
  }, [slug]);

  async function onPickFrame(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    setBusy(true);
    try {
      const url = await uploadFrameImage(event.bucket_name, file);
      setFrameUrl(url);
      toast.success("Frame uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!event || !frameUrl) return;
    setBusy(true);
    try {
      await save({ data: { eventId: event.id, frameUrl, slot } });
      toast.success("Frame saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const boothUrl = `${origin}/e/${slug}/capture?booth=1`;
  const shareUrl = `${origin}/e/${slug}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <BackToHome />
        <div className="mt-4 mb-8 border-b border-primary/15 pb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // EVENT · {event?.name ?? slug} · FRAME
          </div>
          <h1 className="mt-3 text-3xl font-bold uppercase tracking-tighter md:text-4xl">
            Customize your frame.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground/60">
            Upload a flat frame image (no transparent hole needed). Position the photo slot — guests' photos will be composited inside it.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickFrame}
              className="hidden"
              id="frame-pick"
            />
            <label
              htmlFor="frame-pick"
              className="mb-4 block cursor-pointer border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
            >
              {frameUrl ? "Replace frame image" : "+ Upload frame image (PNG/JPG)"}
            </label>
            <SingleSlotEditor frameUrl={frameUrl} slot={slot} onSlotChange={setSlot} />
            <div className="mt-4">
              <NeonButton size="md" glow disabled={!frameUrl || busy} onClick={handleSave}>
                {busy ? "Saving…" : "Save frame to event"}
              </NeonButton>
            </div>
          </div>

          <div className="space-y-4">
            <EventQR label="// BOOTH QR — capture + print" url={boothUrl} filename={`${slug}-booth-qr.png`} />
            <EventQR label="// SHARE QR — album" url={shareUrl} filename={`${slug}-share-qr.png`} />
            <div className="flex flex-wrap gap-2">
              <Link to="/event/$slug/dashboard" params={{ slug }}>
                <NeonButton size="md" variant="ghost">Host dashboard →</NeonButton>
              </Link>
              <Link to="/e/$slug" params={{ slug }}>
                <NeonButton size="md" variant="ghost">View album →</NeonButton>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
