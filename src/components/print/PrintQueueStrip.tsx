import { useEffect, useState } from "react";

interface QueueItem {
  job_id: string;
  status: "queued" | "printing" | "done" | "failed";
}

interface Props {
  agentUrl: string | null;
  enabled: boolean;
}

/**
 * Polls GET {agentUrl}/queue every 3s and renders a small strip of boxes.
 * First box pulses green if currently printing; the rest are muted grey.
 */
export function PrintQueueStrip({ agentUrl, enabled }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (!enabled || !agentUrl) {
      setItems([]);
      return;
    }
    let aborted = false;
    const tick = async () => {
      try {
        const r = await fetch(`${agentUrl}/queue`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        const data = (await r.json()) as QueueItem[];
        if (!aborted) {
          setItems(data.filter((j) => j.status === "queued" || j.status === "printing").slice(0, 5));
        }
      } catch {
        if (!aborted) setItems([]);
      }
    };
    void tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      aborted = true;
      window.clearInterval(id);
    };
  }, [agentUrl, enabled]);

  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
        // Queue
      </div>
      {items.length === 0 ? (
        <div className="inline-flex h-16 w-20 items-center justify-center border border-primary/15 bg-background/40 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">
          Idle
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((j, i) => {
            const isPrinting = i === 0 && j.status === "printing";
            return (
              <div
                key={j.job_id}
                className={`flex h-16 w-20 flex-col items-center justify-center border font-mono text-[9px] uppercase tracking-[0.15em] ${
                  isPrinting
                    ? "animate-pulse border-primary bg-primary/10 text-primary"
                    : "border-foreground/15 bg-background/40 text-foreground/40"
                }`}
              >
                {isPrinting ? (
                  <>
                    <span className="mb-1 size-2 rounded-full bg-primary" />
                    printing
                  </>
                ) : (
                  <>
                    <span className="text-foreground/30">#{i + 1}</span>
                    next
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
