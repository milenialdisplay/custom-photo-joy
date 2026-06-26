import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NeonButton } from "@/components/site/NeonButton";
import { useServerFn } from "@tanstack/react-start";
import { createEvent } from "@/lib/events.functions";
import { listEvents, uploadEventPhoto, type EventRow } from "@/lib/events";
import { supabaseConfigured } from "@/integrations/supabase/client";

interface Props {
  selected: EventRow | null;
  onSelect: (e: EventRow | null) => void;
}

export function EventPanel({ selected, onSelect }: Props) {
  const createEventFn = useServerFn(createEvent);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    listEvents()
      .then((rows) => {
        setEvents(rows);
        setLoaded(true);
      })
      .catch((e) => toast.error(`Load events failed: ${e.message}`));
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const ev = await createEventFn({ data: { name: name.trim() } });
      const row: EventRow = {
        id: ev.id,
        slug: ev.slug,
        name: ev.name,
        bucket_name: ev.bucketName,
        created_at: new Date().toISOString(),
      };
      setEvents((prev) => [row, ...prev]);
      onSelect(row);
      setName("");
      toast.success(`Event "${ev.name}" ready · bucket ${ev.bucketName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="mb-6 border border-orange-500/40 bg-orange-500/5 p-4 font-mono text-xs text-orange-300">
        Supabase not configured. Add BYO_SUPABASE_URL + BYO_SUPABASE_PUBLISHABLE_KEY
        secrets and redeploy. See docs/BYO_SUPABASE_SETUP.md.
      </div>
    );
  }

  return (
    <div className="mb-6 border border-primary/15 bg-background/40 p-4">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
        // EVENT
      </div>

      {events.length > 0 && (
        <div className="mb-3">
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            Active event
          </label>
          <select
            value={selected?.id ?? ""}
            onChange={(e) => {
              const ev = events.find((x) => x.id === e.target.value) ?? null;
              onSelect(ev);
            }}
            className="w-full border border-primary/20 bg-background px-3 py-2 font-mono text-sm text-foreground"
          >
            <option value="">— none —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.bucket_name})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={loaded && events.length === 0 ? "Create your first event…" : "New event name"}
          className="flex-1 border border-primary/20 bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/30"
          maxLength={80}
        />
        <NeonButton size="md" onClick={handleCreate} disabled={busy || !name.trim()}>
          {busy ? "…" : "+ Create"}
        </NeonButton>
      </div>

      {selected && (
        <div className="mt-3 font-mono text-[10px] text-foreground/50">
          Photos upload to bucket{" "}
          <span className="text-primary">{selected.bucket_name}</span>
        </div>
      )}
    </div>
  );
}

export async function uploadFilesToEvent(
  event: EventRow,
  files: File[],
): Promise<number> {
  let ok = 0;
  for (const f of files) {
    try {
      await uploadEventPhoto(event, f);
      ok++;
    } catch (e) {
      toast.error(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`);
    }
  }
  return ok;
}
