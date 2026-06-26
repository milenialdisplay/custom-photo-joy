import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { BackToHome } from "@/components/site/BackToHome";
import { EventPanel, uploadFilesToEvent } from "@/components/print/EventPanel";
import type { EventRow } from "@/lib/events";

export const Route = createFileRoute("/event")({
  head: () => ({
    meta: [
      { title: "Event — Memorable Moment · dpotopoto.com" },
      { name: "description", content: "Run a memorable event: pick or create an event, then upload guest photos straight to your own gallery." },
      { property: "og:title", content: "Event — Memorable Moment · dpotopoto.com" },
      { property: "og:description", content: "One frame, any device. Upload guest photos to your own event gallery." },
    ],
  }),
  component: EventPage,
});

const MAX_FILES = 10;

function EventPage() {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const remaining = MAX_FILES - files.length;
    const accepted = picked.slice(0, Math.max(0, remaining));
    if (picked.length > accepted.length) {
      toast.warning(`Max ${MAX_FILES} files per upload`);
    }
    setFiles((prev) => [...prev, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleUpload() {
    if (!event || !files.length) return;
    setUploading(true);
    try {
      const ok = await uploadFilesToEvent(event, files);
      if (ok > 0) toast.success(`${ok} photo(s) uploaded to ${event.name}`);
      if (ok === files.length) setFiles([]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <BackToHome />

        {/* Header */}
        <div className="mt-4 mb-8 border-b border-primary/15 pb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // 04 / EVENT — Memorable Moment
          </div>
          <h1 className="mt-3 text-3xl font-bold uppercase tracking-tighter md:text-4xl">
            Your event, your gallery.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-foreground/60">
            Create an event, share the QR with guests, and upload photos straight into your own gallery bucket.
          </p>
        </div>

        {/* Event picker / creator */}
        <EventPanel selected={event} onSelect={setEvent} />

        {/* File picker */}
        <div className="mb-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={onPick}
            className="hidden"
            id="event-file-picker"
          />
          <label
            htmlFor="event-file-picker"
            className="block cursor-pointer border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center font-mono text-xs uppercase tracking-[0.2em] text-primary transition-colors hover:border-primary hover:bg-primary/10"
          >
            + Select photos to upload
            <div className="mt-2 text-[10px] text-foreground/40">
              Up to {MAX_FILES} files · JPG, PNG, PDF
            </div>
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-6 border border-primary/15 bg-background/40 p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
              // {files.length} file{files.length === 1 ? "" : "s"}
            </div>
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-3 border border-primary/10 bg-background px-3 py-2 font-mono text-xs"
                >
                  <span className="truncate text-foreground/80">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="text-foreground/40 transition-colors hover:text-primary"
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action */}
        <div className="mb-10">
          <NeonButton
            size="md"
            glow
            disabled={!event || !files.length || uploading}
            onClick={handleUpload}
          >
            {uploading
              ? "Uploading…"
              : event
                ? `Upload to ${event.name}`
                : "Pick an event above to upload"}
          </NeonButton>
          {!event && files.length === 0 && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">
              Create or pick an event above to start uploading.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
