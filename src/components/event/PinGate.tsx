import { useEffect, useState } from "react";
import { cachePin, getCachedPin, getEventBySlug, type EventRow } from "@/lib/events";
import { NeonButton } from "@/components/site/NeonButton";

interface Props {
  slug: string;
  onUnlocked: (event: EventRow) => void;
}

export function PinGate({ slug, onUnlocked }: Props) {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    getEventBySlug(slug)
      .then((ev) => {
        if (cancel) return;
        if (!ev || !ev.paid_at) {
          setError("Event not found.");
          setLoading(false);
          return;
        }
        setEvent(ev);
        const cached = getCachedPin(slug);
        if (cached && cached === ev.access_pin) {
          onUnlocked(ev);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [slug, onUnlocked]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    if (pin === event.access_pin) {
      cachePin(slug, pin);
      onUnlocked(event);
    } else {
      setError("Wrong PIN.");
    }
  }

  if (loading) {
    return <div className="font-mono text-xs text-foreground/50">Loading…</div>;
  }
  if (error && !event) {
    return <div className="font-mono text-xs text-destructive">{error}</div>;
  }
  if (!event) return null;

  return (
    <form onSubmit={submit} className="mx-auto max-w-xs border border-primary/30 bg-background/40 p-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// {event.name}</div>
      <h2 className="mt-2 text-lg font-bold uppercase tracking-tighter">Enter album PIN</h2>
      <input
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
          setError(null);
        }}
        inputMode="numeric"
        className="mt-4 w-full border border-primary/30 bg-background px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] text-primary"
        maxLength={4}
      />
      {error && <div className="mt-2 font-mono text-[10px] text-destructive">{error}</div>}
      <div className="mt-4">
        <NeonButton size="md" glow disabled={pin.length !== 4}>
          Unlock
        </NeonButton>
      </div>
    </form>
  );
}
