import { useEffect, useState } from "react";

export type ConnectState = "checking" | "offline" | "ready";

interface Props {
  agentUrl: string | null;
  printerName?: string;
  onStateChange?: (state: ConnectState) => void;
}

/**
 * Pings GET {agentUrl}/health every 10s.
 * Renders orange "Connect printer" when unreachable, green "Printer ready"
 * when the agent responds 200.
 */
export function ConnectIndicator({ agentUrl, printerName, onStateChange }: Props) {
  const [state, setState] = useState<ConnectState>("checking");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!agentUrl) {
      setState("offline");
      onStateChange?.("offline");
      return;
    }
    let aborted = false;
    const ping = async () => {
      try {
        const r = await fetch(`${agentUrl}/health`, { cache: "no-store" });
        if (aborted) return;
        const next: ConnectState = r.ok ? "ready" : "offline";
        setState(next);
        onStateChange?.(next);
      } catch {
        if (aborted) return;
        setState("offline");
        onStateChange?.("offline");
      }
    };
    void ping();
    const id = window.setInterval(ping, 10_000);
    return () => {
      aborted = true;
      window.clearInterval(id);
    };
  }, [agentUrl, onStateChange]);

  const isReady = state === "ready";
  const label = isReady
    ? `Printer ready${printerName ? ` · ${printerName}` : ""}`
    : state === "checking"
      ? "Checking printer…"
      : "Connect printer";

  return (
    <>
      <button
        type="button"
        onClick={() => !isReady && setShowHelp(true)}
        className={`inline-flex items-center gap-2 border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
          isReady
            ? "border-primary bg-primary/10 text-primary"
            : "border-orange-500 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
        }`}
      >
        <span
          className={`inline-block size-2 rounded-full ${
            isReady ? "bg-primary" : "animate-pulse bg-orange-500"
          }`}
        />
        {label}
      </button>

      {showHelp && !isReady && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="max-w-sm border border-primary/30 bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              // Connect to booth
            </div>
            <h3 className="mb-3 text-lg font-bold tracking-tight">Join the booth Wi-Fi</h3>
            <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-foreground/70">
              <li>Scan the QR sticker on the booth, or open Settings → Wi-Fi.</li>
              <li>Pick the network named <span className="font-mono">dpotopoto-…</span>.</li>
              <li>Come back to this page and tap retry.</li>
            </ol>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full border border-primary px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
