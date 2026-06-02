import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BackToHome } from "@/components/site/BackToHome";
import { ConnectIndicator, type ConnectState } from "@/components/print/ConnectIndicator";
import { FileRow } from "@/components/print/FileRow";
import { PrintQueueStrip } from "@/components/print/PrintQueueStrip";
import { useBoothConfig } from "@/hooks/useBoothConfig";
import { formatIDR, priceFor, type PaperSize } from "@/lib/pricing";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Print here — dpotopoto" },
      { name: "description", content: "Upload photos and print at this dpotopoto booth." },
      { name: "viewport", content: "width=device-width,initial-scale=1,viewport-fit=cover" },
    ],
  }),
  component: PrintPage,
});

interface SelectedFile {
  id: string;
  file: File;
  size: PaperSize;
}

function PrintPage() {
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [loc, setLoc] = useState<string>("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [paid] = useState(false); // wired in payments phase
  const [connectState, setConnectState] = useState<ConnectState>("checking");
  const inputRef = useRef<HTMLInputElement>(null);

  // Read ?agent= and ?loc= once on mount.
  useEffect(() => {
    const url = new URL(window.location.href);
    const a =
      url.searchParams.get("agent") ??
      (typeof localStorage !== "undefined" ? localStorage.getItem("dpoto.printer.agent_url") : null);
    const l = url.searchParams.get("loc") ?? "";
    setAgentUrl(a ? a.replace(/\/$/, "") : null);
    setLoc(l);
  }, []);

  const cfg = useBoothConfig(agentUrl);
  const locationLabel = cfg.location_label || loc || "this booth";

  const total = useMemo(
    () => files.reduce((sum, f) => sum + priceFor(f.size, cfg.prices_idr), 0),
    [files, cfg.prices_idr],
  );

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const room = cfg.max_files_per_order - files.length;
    const accepted = picked.slice(0, room);
    if (picked.length > room) {
      toast.warning(`Max ${cfg.max_files_per_order} files per order — extras ignored.`);
    }
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        size: "A5" as PaperSize,
      })),
    ]);
    // reset so the same file can be picked again later
    if (inputRef.current) inputRef.current.value = "";
  };

  const setSize = (id: string, size: PaperSize) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, size } : f)));
  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const canPay = files.length > 0 && connectState === "ready";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-primary/15 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="font-mono text-sm font-bold tracking-tight">
            dpotopoto<span className="text-primary">.com</span>
          </div>
          <BackToHome />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Booth + connect */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
              // Printing at
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight">{locationLabel}</div>
          </div>
          <ConnectIndicator
            agentUrl={agentUrl}
            printerName={cfg.printer_name}
            onStateChange={setConnectState}
          />
        </div>

        {!cfg.live && (
          <div className="mb-6 border border-orange-500/30 bg-orange-500/5 px-4 py-3 font-mono text-[11px] text-orange-600">
            Showing default prices — connect to the booth Wi-Fi to see live pricing.
          </div>
        )}

        {/* Select files */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={files.length >= cfg.max_files_per_order}
            className="inline-flex items-center gap-2 border-2 border-primary bg-primary/5 px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
          >
            <span>📁</span> Select files (max {cfg.max_files_per_order})
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onPickFiles}
          />
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/50">
            {files.length} / {cfg.max_files_per_order} selected
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-8 border border-primary/15 bg-background/40 p-4">
            <div className="mb-2 grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-primary/20 pb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50">
              <span>File</span>
              <span>Size</span>
              <span className="w-24 text-right">Price</span>
              <span className="w-4" />
            </div>
            {files.map((f) => (
              <FileRow
                key={f.id}
                name={f.file.name}
                size={f.size}
                price={priceFor(f.size, cfg.prices_idr)}
                onSizeChange={(s) => setSize(f.id, s)}
                onRemove={() => removeFile(f.id)}
              />
            ))}
            <div className="mt-4 flex items-center justify-end gap-4 border-t border-primary/20 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50">
                Total
              </span>
              <span className="text-2xl font-bold tabular-nums">{formatIDR(total)}</span>
            </div>
          </div>
        )}

        {/* Pay now */}
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            disabled={!canPay}
            onClick={() =>
              toast.info("Payment coming soon — design phase. Midtrans + Lemon Squeezy wires in next.")
            }
            className="inline-flex w-full max-w-xs items-center justify-center gap-2 border-2 border-primary bg-primary px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.15em] text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            💳 Pay now · {formatIDR(total)}
          </button>
        </div>

        {/* Upload & print (grey until paid) */}
        <div className="mb-10 flex justify-center">
          <button
            type="button"
            disabled={!paid}
            title={paid ? "Send all files to the printer" : "Available after payment"}
            className={`inline-flex w-full max-w-xs items-center justify-center gap-2 border-2 px-6 py-4 font-mono text-sm font-bold uppercase tracking-[0.15em] transition-colors ${
              paid
                ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
                : "cursor-not-allowed border-foreground/20 bg-muted text-foreground/40"
            }`}
          >
            ⬆ Upload &amp; print
          </button>
        </div>

        {/* Queue */}
        <PrintQueueStrip agentUrl={agentUrl} enabled={connectState === "ready"} />
      </main>
    </div>
  );
}
