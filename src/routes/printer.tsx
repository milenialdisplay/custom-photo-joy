import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { ConnectIndicator, type ConnectState } from "@/components/print/ConnectIndicator";
import { FileRow } from "@/components/print/FileRow";
import { PrintQueueStrip } from "@/components/print/PrintQueueStrip";
import { EventPanel, uploadFilesToEvent } from "@/components/print/EventPanel";
import type { EventRow } from "@/lib/events";
import { useBoothConfig } from "@/hooks/useBoothConfig";
import { formatIDR, priceFor, type PaperSize } from "@/lib/pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/printer")({
  head: () => ({
    meta: [
      { title: "Printer Booth — dpotopoto.com" },
      {
        name: "description",
        content:
          "Print your photos at the booth. Pick A4 or A5, pay per sheet, no subscription.",
      },
      { property: "og:title", content: "Printer Booth — dpotopoto.com" },
      {
        property: "og:description",
        content: "Send prints from any phone on the booth Wi-Fi. Pay per sheet.",
      },
    ],
  }),
  component: PrinterPage,
});

interface SelectedFile {
  id: string;
  file: File;
  size: PaperSize;
}

function PrinterPage() {
  // Agent URL — booth agent runs on port 8080 (see agent/deploy/dpoto-agent.service).
  // Override priority: ?agent=http://... query → localStorage → same-host :8080.
  // Lets a phone on lovable preview point at a Dell IP without rebuilding.
  const agentUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("agent");
    if (fromQuery) {
      try {
        localStorage.setItem("dpotopoto.agentUrl", fromQuery);
      } catch {
        /* ignore */
      }
      return fromQuery.replace(/\/$/, "");
    }
    try {
      const stored = localStorage.getItem("dpotopoto.agentUrl");
      if (stored) return stored.replace(/\/$/, "");
    } catch {
      /* ignore */
    }
    return `http://${window.location.hostname}:8080`;
  }, []);

  // Stable per-browser guest id so the agent's per-guest quota works.
  const guestId = useMemo(() => {
    if (typeof window === "undefined") return "ssr";
    try {
      let g = localStorage.getItem("dpotopoto.guestId");
      if (!g) {
        g = "guest-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("dpotopoto.guestId", g);
      }
      return g;
    } catch {
      return "guest-" + Math.random().toString(36).slice(2, 10);
    }
  }, []);

  const cfg = useBoothConfig(agentUrl);
  const [connectState, setConnectState] = useState<ConnectState>("checking");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isReady = connectState === "ready";
  const total = files.reduce((sum, f) => sum + priceFor(f.size, cfg.prices_idr), 0);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const remaining = cfg.max_files_per_order - files.length;
    const accepted = picked.slice(0, Math.max(0, remaining));
    if (picked.length > accepted.length) {
      toast.warning(`Max ${cfg.max_files_per_order} files per order`);
    }
    const next: SelectedFile[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      size: "A5",
    }));
    setFiles((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateSize(id: string, size: PaperSize) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, size } : f)));
  }

  function remove(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function uploadAndPrint() {
    if (!isReady || !agentUrl || !files.length) return;
    setSubmitting(true);
    try {
      for (const f of files) {
        const form = new FormData();
        form.append("file", f.file);
        form.append("paper_size", f.size);
        form.append("paper_preset", "default");
        form.append("copies", "1");
        form.append("guest_id", guestId);
        form.append("guest_name", "Web Guest");
        form.append("guest_color", "#1b8c5f");
        const r = await fetch(`${agentUrl}/print`, { method: "POST", body: form });
        if (!r.ok) {
          const msg = await r.text().catch(() => "");
          throw new Error(`Print failed for ${f.file.name}: ${msg || r.status}`);
        }
      }
      toast.success(`${files.length} file(s) sent to printer`);
      setFiles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    } finally {
      setSubmitting(false);
    }
  }

  const locationLabel = cfg.location_label || "Booth (offline)";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Header row */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-primary/15 pb-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // 03_PRINTER_BOOTH
            </div>
            <div className="mt-2 font-mono text-sm text-foreground/70">
              Printing at:{" "}
              <span className="text-foreground">{locationLabel}</span>
            </div>
          </div>
          <ConnectIndicator
            agentUrl={agentUrl}
            printerName={cfg.printer_name}
            onStateChange={setConnectState}
          />
        </div>

        {/* File picker */}
        <div className="mb-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={onPick}
            className="hidden"
            id="file-picker"
          />
          <label
            htmlFor="file-picker"
            className="block cursor-pointer border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center font-mono text-xs uppercase tracking-[0.2em] text-primary transition-colors hover:border-primary hover:bg-primary/10"
          >
            + Select files to print
            <div className="mt-2 text-[10px] text-foreground/40">
              Up to {cfg.max_files_per_order} files · JPG, PNG, PDF
            </div>
          </label>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-6 border border-primary/15 bg-background/40 p-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
              // {files.length} file{files.length === 1 ? "" : "s"}
            </div>
            {files.map((f) => (
              <FileRow
                key={f.id}
                name={f.file.name}
                size={f.size}
                price={priceFor(f.size, cfg.prices_idr)}
                onSizeChange={(s) => updateSize(f.id, s)}
                onRemove={() => remove(f.id)}
              />
            ))}
            <div className="mt-4 flex items-center justify-between border-t border-primary/15 pt-4">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-foreground/60">
                Total
              </span>
              <span className="font-mono text-xl font-bold tabular-nums text-primary">
                {formatIDR(total)}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        {files.length > 0 && (
          <div className="mb-10 flex flex-wrap gap-3">
            <NeonButton size="md" variant="ghost" disabled>
              Pay now (soon)
            </NeonButton>
            <NeonButton
              size="md"
              glow
              disabled={!isReady || submitting}
              onClick={uploadAndPrint}
            >
              {submitting ? "Sending…" : "Upload & print"}
            </NeonButton>
          </div>
        )}

        {/* Queue */}
        <div className="border-t border-primary/15 pt-6">
          <PrintQueueStrip agentUrl={agentUrl} enabled={isReady} />
        </div>

        {/* Pricing hint */}
        <div className="mt-10 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/40">
          Pricing · A4 {formatIDR(cfg.prices_idr.A4)} · A5 {formatIDR(cfg.prices_idr.A5)}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
