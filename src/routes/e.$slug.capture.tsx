import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BackToHome } from "@/components/site/BackToHome";
import { NeonButton } from "@/components/site/NeonButton";
import { PinGate } from "@/components/event/PinGate";
import {
  getEventBySlug,
  uploadEventPhoto,
  consumePrintCredit,
  submitToBooth,
  hasGuestPrinted,
  markGuestPrinted,
  getGuestUploadCount,
  incGuestUploadCount,
  type EventRow,
} from "@/lib/events";
import { compositeToBlob, dimsForRatio, DEFAULT_SLOT, type FrameSlot } from "@/lib/event-render";
import { MAX_PHOTOS_PER_GUEST } from "@/lib/event-pricing";

export const Route = createFileRoute("/e/$slug/capture")({
  head: ({ params }) => ({
    meta: [
      { title: `Capture · ${params.slug} · dpotopoto.com` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CapturePage,
});

function CapturePage() {
  const { slug } = Route.useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [boothMode, setBoothMode] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [printed, setPrinted] = useState(false);

  const handleUnlocked = useCallback((ev: EventRow) => setEvent(ev), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBoothMode(params.get("booth") === "1");
    setUploads(getGuestUploadCount(slug));
    setPrinted(hasGuestPrinted(slug));
  }, [slug]);

  // re-fetch event on confirm flow so credits/frame are fresh
  useEffect(() => {
    if (!event) return;
    getEventBySlug(slug).then((ev) => ev && setEvent(ev));
  }, [slug, event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <BackToHome />
          <div className="mt-10">
            <PinGate slug={slug} onUnlocked={handleUnlocked} />
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <BackToHome />
        <Header event={event} uploads={uploads} printed={printed} boothMode={boothMode} />
        <CaptureFlow
          event={event}
          boothMode={boothMode}
          printed={printed}
          uploads={uploads}
          onUploaded={() => setUploads(incGuestUploadCount(slug))}
          onPrinted={() => {
            markGuestPrinted(slug);
            setPrinted(true);
          }}
        />
        <div className="mt-6">
          <Link to="/e/$slug" params={{ slug }}>
            <NeonButton size="md" variant="ghost">View album →</NeonButton>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Header({
  event, uploads, printed, boothMode,
}: { event: EventRow; uploads: number; printed: boolean; boothMode: boolean }) {
  return (
    <div className="mt-4 mb-6 border-b border-primary/15 pb-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // {event.name} {boothMode && "· BOOTH"}
      </div>
      <h1 className="mt-2 text-2xl font-bold uppercase tracking-tighter md:text-3xl">Capture your moment</h1>
      <p className="mt-2 font-mono text-[11px] text-foreground/60">
        {uploads} / {MAX_PHOTOS_PER_GUEST} photos saved to album · Print used:{" "}
        <span className={printed ? "text-primary" : "text-foreground/70"}>{printed ? "yes" : "no"}</span>
      </p>
      <p className="mt-1 font-mono text-[10px] italic text-foreground/40">
        You can save up to {MAX_PHOTOS_PER_GUEST} photos to the album and print 1.
      </p>
    </div>
  );
}

function CaptureFlow({
  event, boothMode, printed, uploads, onUploaded, onPrinted,
}: {
  event: EventRow;
  boothMode: boolean;
  printed: boolean;
  uploads: number;
  onUploaded: () => void;
  onPrinted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compositedUrl, setCompositedUrl] = useState<string | null>(null);
  const [compositedBlob, setCompositedBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const slot: FrameSlot = (event.frame_slot as FrameSlot) ?? DEFAULT_SLOT;
  const dims = dimsForRatio(slot.ratio);

  async function buildComposite(file: File) {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    try {
      const blob = await compositeToBlob({
        frameUrl: event.frame_url ?? null,
        slot,
        photoUrl: url,
        width: dims.w,
        height: dims.h,
      });
      setCompositedBlob(blob);
      setCompositedUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Composite failed");
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    buildComposite(file);
  }

  function retake() {
    setPreviewUrl(null);
    setCompositedUrl(null);
    setCompositedBlob(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function confirmSave(thenPrint: boolean) {
    if (!compositedBlob) return;
    if (uploads >= MAX_PHOTOS_PER_GUEST) {
      toast.error(`Max ${MAX_PHOTOS_PER_GUEST} photos saved already`);
      return;
    }
    setBusy(true);
    try {
      await uploadEventPhoto(event, compositedBlob, `event-${Date.now()}.jpg`);
      onUploaded();
      toast.success("Saved to album");

      if (thenPrint) {
        if (!confirm("Do you want to print this photo? You can only print 1 photo per event.")) {
          retake();
          return;
        }
        const ok = await consumePrintCredit(event.id);
        if (!ok) {
          toast.error("No print credits left for this event");
          retake();
          return;
        }
        const agentUrl = localStorage.getItem("agentUrl") || "http://localhost:8080";
        try {
          await submitToBooth(agentUrl, compositedBlob, 1);
          onPrinted();
          toast.success("Queued to printer ✔");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Booth offline");
        }
      }
      retake();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (compositedUrl) {
    const canPrint = boothMode && !printed && event.package === "B" && (event.print_credits_remaining ?? 0) > 0;
    return (
      <div className="border border-primary/20 bg-background/40 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// CONFIRM</div>
        <img src={compositedUrl} alt="preview" className="mt-3 w-full border border-primary/20" />
        <div className="mt-4 flex flex-wrap gap-2">
          <NeonButton size="md" glow disabled={busy} onClick={() => confirmSave(false)}>
            ✔ Save to album
          </NeonButton>
          {canPrint && (
            <NeonButton size="md" disabled={busy} onClick={() => confirmSave(true)}>
              🖨 Save & print 1
            </NeonButton>
          )}
          <NeonButton size="md" variant="ghost" disabled={busy} onClick={retake}>
            Retake
          </NeonButton>
        </div>
        {!canPrint && boothMode && event.package === "B" && printed && (
          <p className="mt-3 font-mono text-[10px] text-foreground/50">
            You've already used your 1 print for this event.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {event.frame_url && (
        <div className="relative overflow-hidden border border-primary/20" style={{ aspectRatio: "1" }}>
          <img src={event.frame_url} alt="frame" className="absolute inset-0 size-full object-fill opacity-70" />
          <div
            className="absolute border-2 border-dashed border-primary"
            style={{
              left: `${slot.rect.x * 100}%`,
              top: `${slot.rect.y * 100}%`,
              width: `${slot.rect.w * 100}%`,
              height: `${slot.rect.h * 100}%`,
            }}
          >
            <span className="absolute left-1 top-1 bg-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary-foreground">
              YOUR PHOTO HERE
            </span>
          </div>
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" id="cap-camera" />
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" id="cap-file" />
      <div className="grid gap-2 md:grid-cols-2">
        <label htmlFor="cap-camera" className="block">
          <NeonButton size="md" glow className="w-full" onClick={() => cameraRef.current?.click()}>
            ● Take photo
          </NeonButton>
        </label>
        <label htmlFor="cap-file" className="block">
          <NeonButton size="md" variant="ghost" className="w-full" onClick={() => fileRef.current?.click()}>
            ↑ Upload from device
          </NeonButton>
        </label>
      </div>
      {previewUrl && !compositedUrl && (
        <div className="font-mono text-[10px] text-foreground/50">Compositing…</div>
      )}
    </div>
  );
}
