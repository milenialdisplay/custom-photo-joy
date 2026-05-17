import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";

export const Route = createFileRoute("/printer")({
  head: () => ({
    meta: [
      { title: "Printer Booth — dpotopoto.com" },
      {
        name: "description",
        content:
          "LAN-only print queue for the dpotopoto kiosk. Multi-user FIFO, fair use limits, color-managed pipeline. No cloud round-trip for prints.",
      },
      { property: "og:title", content: "Printer Booth — dpotopoto.com" },
      {
        property: "og:description",
        content:
          "Send prints from any phone on the local network. Watch your spot in line and pick up your photo by your color tag.",
      },
    ],
  }),
  component: PrinterPage,
});

// ───────────────────────────── types ─────────────────────────────

type JobStatus = "queued" | "printing" | "done" | "failed";

interface QueueItem {
  job_id: string;
  guest_name: string;
  guest_color: string;
  status: JobStatus;
  paper_size: string;
  submitted_at: string;
}

interface HealthResponse {
  agent: string;
  printer: "ready" | "error" | "offline";
  queue_depth: number;
}

interface SubmitResponse {
  job_id: string;
  position: number;
  eta_seconds: number;
}

interface JobResponse {
  status: JobStatus;
  position: number;
  eta_seconds: number;
  guest_color: string;
  error?: string;
}

interface Identity {
  guest_id: string;
  guest_name: string;
  guest_color: string;
}

// ───────────────────────────── constants ─────────────────────────────

const COLOR_TAGS: { id: string; hex: string; label: string }[] = [
  { id: "pink", hex: "#ff6bd6", label: "Hot Pink" },
  { id: "cyan", hex: "#5ce1ff", label: "Cyan" },
  { id: "yellow", hex: "#ffe24d", label: "Yellow" },
  { id: "lime", hex: "#73ffb8", label: "Lime" },
];

const PAPER_SIZES = ["2R", "4R", "A5", "A6", "Square"] as const;
const PAPER_PRESETS = [
  { id: "glossy_200", label: "Glossy 200 gsm" },
  { id: "matte_120", label: "Matte 120 gsm" },
  { id: "default", label: "Default" },
];

const LS_IDENTITY = "dpoto.printer.identity";
const LS_AGENT_URL = "dpoto.printer.agent_url";
const DEFAULT_AGENT_URL = "http://192.168.1.50:8080";

// ───────────────────────────── helpers ─────────────────────────────

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_IDENTITY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(id: Identity) {
  window.localStorage.setItem(LS_IDENTITY, JSON.stringify(id));
}

function loadAgentUrl(): string {
  if (typeof window === "undefined") return DEFAULT_AGENT_URL;
  return window.localStorage.getItem(LS_AGENT_URL) ?? DEFAULT_AGENT_URL;
}

// ───────────────────────────── page ─────────────────────────────

function PrinterPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <Hero />
      <MainPanel />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-16">
      <div className="absolute inset-0 grid-noise opacity-30" aria-hidden />
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
          // Printer_Booth
        </div>
        <h1 className="mb-6 text-5xl font-bold uppercase tracking-tighter md:text-7xl">
          Wired. Local.<br />No cloud.
        </h1>
        <p className="max-w-xl text-base text-foreground/60">
          Send prints from any phone on the venue Wi-Fi. The Dell agent prints them one
          at a time. You see your spot in line — and your color tag tells you which photo
          in the tray is yours.
        </p>
      </div>
    </section>
  );
}

function MainPanel() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [agentUrl, setAgentUrl] = useState<string>(DEFAULT_AGENT_URL);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeJob, setActiveJob] = useState<{ job_id: string; submitted_at: number } | null>(
    null,
  );
  const [activeJobInfo, setActiveJobInfo] = useState<JobResponse | null>(null);
  const [tagPrint, setTagPrint] = useState(true);

  // hydrate
  useEffect(() => {
    setIdentity(loadIdentity());
    setAgentUrl(loadAgentUrl());
  }, []);

  // poll /health + /queue
  useEffect(() => {
    let aborted = false;
    const tick = async () => {
      try {
        const [h, q] = await Promise.all([
          fetch(`${agentUrl}/health`, { cache: "no-store" }).then((r) => r.json() as Promise<HealthResponse>),
          fetch(`${agentUrl}/queue`, { cache: "no-store" }).then((r) => r.json() as Promise<QueueItem[]>),
        ]);
        if (aborted) return;
        setHealth(h);
        setQueue(q);
        setHealthError(null);
      } catch (err) {
        if (aborted) return;
        setHealth(null);
        setHealthError(err instanceof Error ? err.message : "offline");
      }
    };
    void tick();
    const t = window.setInterval(tick, 3000);
    return () => {
      aborted = true;
      window.clearInterval(t);
    };
  }, [agentUrl]);

  // poll my active job
  useEffect(() => {
    if (!activeJob) return;
    let aborted = false;
    const tick = async () => {
      try {
        const r = await fetch(`${agentUrl}/jobs/${activeJob.job_id}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const data = (await r.json()) as JobResponse;
        if (aborted) return;
        setActiveJobInfo(data);
      } catch {
        /* tolerate transient blip */
      }
    };
    void tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      aborted = true;
      window.clearInterval(t);
    };
  }, [activeJob, agentUrl]);

  const handleAgentUrlChange = useCallback((url: string) => {
    setAgentUrl(url);
    window.localStorage.setItem(LS_AGENT_URL, url);
  }, []);

  const handleIdentitySave = useCallback((name: string, color: string) => {
    const id: Identity = {
      guest_id: identity?.guest_id ?? uuid(),
      guest_name: name,
      guest_color: color,
    };
    saveIdentity(id);
    setIdentity(id);
  }, [identity]);

  return (
    <section className="border-y border-primary/10 bg-muted/30 px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!identity ? (
            <IdentityCard onSave={handleIdentitySave} />
          ) : (
            <IdentityBadge identity={identity} onEdit={() => setIdentity(null)} />
          )}

          <ConnectionPanel
            agentUrl={agentUrl}
            onChange={handleAgentUrlChange}
            health={health}
            healthError={healthError}
          />

          {identity && (
            <SendPrintForm
              identity={identity}
              agentUrl={agentUrl}
              health={health}
              tagPrint={tagPrint}
              onTagPrintChange={setTagPrint}
              onSubmitted={(res) =>
                setActiveJob({ job_id: res.job_id, submitted_at: Date.now() })
              }
            />
          )}

          {activeJob && (
            <MyJobTracker
              identity={identity}
              info={activeJobInfo}
              onDismiss={() => {
                setActiveJob(null);
                setActiveJobInfo(null);
              }}
            />
          )}
        </div>

        <div className="space-y-6">
          <PublicQueue queue={queue} myJobId={activeJob?.job_id ?? null} />
          <OperatorLink agentUrl={agentUrl} />
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── identity ─────────────────────────────

function IdentityCard({ onSave }: { onSave: (name: string, color: string) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_TAGS[0].hex);
  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Identify_Yourself
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight">Pick a name + color tag</h2>
      <p className="mb-6 text-sm text-foreground/60">
        Stored on this phone only. Used so you can spot your print in the tray.
      </p>
      <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60">
        Display name
      </label>
      <input
        className="mb-5 w-full border border-primary/20 bg-background px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none"
        placeholder="e.g. Sarah"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={24}
      />
      <label className="mb-3 block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60">
        Color tag
      </label>
      <div className="mb-6 flex gap-3">
        {COLOR_TAGS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.hex)}
            aria-label={c.label}
            className={`size-12 border-2 transition-all ${
              color === c.hex ? "border-foreground scale-110" : "border-transparent opacity-70"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
      <NeonButton
        size="md"
        glow
        disabled={!name.trim()}
        onClick={() => name.trim() && onSave(name.trim(), color)}
      >
        Save Identity
      </NeonButton>
    </div>
  );
}

function IdentityBadge({ identity, onEdit }: { identity: Identity; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between border border-primary/20 bg-background/60 p-4">
      <div className="flex items-center gap-4">
        <span
          className="size-8 border border-foreground/30"
          style={{ backgroundColor: identity.guest_color }}
          aria-hidden
        />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
            // You
          </div>
          <div className="text-lg font-bold tracking-tight">{identity.guest_name}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50 hover:text-primary"
      >
        Edit
      </button>
    </div>
  );
}

// ───────────────────────────── connection ─────────────────────────────

function ConnectionPanel({
  agentUrl,
  onChange,
  health,
  healthError,
}: {
  agentUrl: string;
  onChange: (url: string) => void;
  health: HealthResponse | null;
  healthError: string | null;
}) {
  const [draft, setDraft] = useState(agentUrl);
  useEffect(() => setDraft(agentUrl), [agentUrl]);

  const agentOk = !!health;
  const printerState = health?.printer ?? "offline";

  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Agent_Link
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <StatusPill ok={agentOk} label={agentOk ? "Agent online" : "Agent offline"} />
        <StatusPill
          ok={printerState === "ready"}
          warn={printerState === "error"}
          label={
            printerState === "ready"
              ? "Printer ready"
              : printerState === "error"
                ? "Printer error"
                : "Printer offline"
          }
        />
        <StatusPill
          ok
          label={`${health?.queue_depth ?? 0} in queue`}
          neutral
        />
      </div>

      <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60">
        Agent base URL (LAN)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[12rem] border border-primary/20 bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={DEFAULT_AGENT_URL}
        />
        <button
          type="button"
          onClick={() => onChange(draft.replace(/\/$/, ""))}
          className="border border-primary/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-primary/10 hover:border-primary/60"
        >
          Save
        </button>
      </div>

      {healthError && !agentOk && (
        <p className="mt-3 font-mono text-[11px] text-destructive/80">
          Can&apos;t reach agent: {healthError}. Make sure the Dell is on the same Wi-Fi
          and the URL above matches its IP.
        </p>
      )}
    </div>
  );
}

function StatusPill({
  ok,
  warn,
  neutral,
  label,
}: {
  ok: boolean;
  warn?: boolean;
  neutral?: boolean;
  label: string;
}) {
  const color = neutral
    ? "border-primary/20 text-foreground/70"
    : warn
      ? "border-destructive/60 text-destructive"
      : ok
        ? "border-primary/60 text-primary"
        : "border-foreground/20 text-foreground/40";
  return (
    <span
      className={`inline-flex items-center gap-2 border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${color}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          warn ? "bg-destructive animate-blink" : ok ? "bg-primary" : "bg-foreground/40"
        }`}
      />
      {label}
    </span>
  );
}

// ───────────────────────────── send form ─────────────────────────────

function SendPrintForm({
  identity,
  agentUrl,
  health,
  tagPrint,
  onTagPrintChange,
  onSubmitted,
}: {
  identity: Identity;
  agentUrl: string;
  health: HealthResponse | null;
  tagPrint: boolean;
  onTagPrintChange: (v: boolean) => void;
  onSubmitted: (res: SubmitResponse) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [paperSize, setPaperSize] = useState<(typeof PAPER_SIZES)[number]>("4R");
  const [paperPreset, setPaperPreset] = useState(PAPER_PRESETS[0].id);
  const [copies, setCopies] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !!file && !submitting && !!health && health.printer !== "offline";

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      let payloadFile: Blob = file;
      if (tagPrint) {
        payloadFile = await stampGuestTag(file, identity);
      }
      const fd = new FormData();
      fd.append("file", payloadFile, file.name);
      fd.append("paper_size", paperSize);
      fd.append("paper_preset", paperPreset);
      fd.append("copies", String(copies));
      fd.append("guest_id", identity.guest_id);
      fd.append("guest_name", identity.guest_name);
      fd.append("guest_color", identity.guest_color);
      const res = await fetch(`${agentUrl}/print`, { method: "POST", body: fd });
      if (res.status === 429) {
        const body = (await res.json()) as { error: string; retry_after?: number };
        throw new Error(`${body.error}${body.retry_after ? ` — retry in ${body.retry_after}s` : ""}`);
      }
      if (res.status === 503) {
        throw new Error("printer offline");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SubmitResponse;
      onSubmitted(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit failed");
    } finally {
      setSubmitting(false);
    }
  }, [agentUrl, copies, file, identity, onSubmitted, paperPreset, paperSize, tagPrint]);

  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Send_Print
      </div>

      <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60">
        Photo file (JPEG / PNG)
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-5 block w-full text-sm file:mr-4 file:border file:border-primary/30 file:bg-transparent file:px-4 file:py-2 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.2em] file:text-primary hover:file:bg-primary/10"
      />

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Paper size">
          <select
            className="w-full border border-primary/20 bg-background px-3 py-2 font-mono text-xs"
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value as (typeof PAPER_SIZES)[number])}
          >
            {PAPER_SIZES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preset">
          <select
            className="w-full border border-primary/20 bg-background px-3 py-2 font-mono text-xs"
            value={paperPreset}
            onChange={(e) => setPaperPreset(e.target.value)}
          >
            {PAPER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Copies">
          <input
            type="number"
            min={1}
            max={3}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(3, Number(e.target.value) || 1)))}
            className="w-full border border-primary/20 bg-background px-3 py-2 font-mono text-xs"
          />
        </Field>
      </div>

      <label className="mb-5 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={tagPrint}
          onChange={(e) => onTagPrintChange(e.target.checked)}
          className="size-4 accent-primary"
        />
        <span className="text-foreground/80">
          Tag my print with my name + color (helps at pickup)
        </span>
      </label>

      {error && (
        <p className="mb-4 border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
          {error}
        </p>
      )}

      <NeonButton size="lg" glow disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? "Sending…" : "Send to Printer"}
      </NeonButton>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60">
        {label}
      </label>
      {children}
    </div>
  );
}

// ───────────────────────────── my job tracker ─────────────────────────────

function MyJobTracker({
  identity,
  info,
  onDismiss,
}: {
  identity: Identity | null;
  info: JobResponse | null;
  onDismiss: () => void;
}) {
  if (!info) {
    return (
      <div className="border border-primary/40 bg-background/60 p-6">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-foreground/60">
          Submitting…
        </div>
      </div>
    );
  }
  const isDone = info.status === "done";
  const isFailed = info.status === "failed";
  return (
    <div
      className={`relative border-2 p-6 ${
        isDone
          ? "border-primary bg-primary/10"
          : isFailed
            ? "border-destructive bg-destructive/10"
            : "border-primary/40 bg-background/60"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="size-6 border border-foreground/30"
            style={{ backgroundColor: identity?.guest_color ?? info.guest_color }}
            aria-hidden
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // My_Job — {info.status}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50 hover:text-primary"
        >
          Dismiss
        </button>
      </div>

      {info.status === "queued" && (
        <>
          <div className="text-5xl font-bold tracking-tighter">#{info.position} in line</div>
          <div className="mt-2 font-mono text-sm text-foreground/60">
            ~{info.eta_seconds}s — printer is working through {info.position - 1} ahead of you.
          </div>
        </>
      )}
      {info.status === "printing" && (
        <>
          <div className="text-4xl font-bold tracking-tighter text-primary animate-pulse">
            Printing now…
          </div>
          <div className="mt-2 font-mono text-sm text-foreground/60">
            Head to the printer — your print is on its way.
          </div>
        </>
      )}
      {isDone && (
        <>
          <div className="text-4xl font-bold tracking-tighter text-primary">
            ✓ Ready at the printer
          </div>
          <div className="mt-2 font-mono text-sm text-foreground/80">
            Look for the photo tagged with your color.
          </div>
        </>
      )}
      {isFailed && (
        <>
          <div className="text-3xl font-bold tracking-tighter text-destructive">Print failed</div>
          <div className="mt-2 font-mono text-sm text-foreground/60">
            {info.error ?? "The agent couldn't print this job. Try again."}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────── public queue ─────────────────────────────

function PublicQueue({ queue, myJobId }: { queue: QueueItem[]; myJobId: string | null }) {
  const visible = useMemo(
    () => queue.filter((q) => q.status === "queued" || q.status === "printing").slice(0, 12),
    [queue],
  );
  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Queue ({visible.length})
      </div>
      {visible.length === 0 ? (
        <p className="font-mono text-xs text-foreground/40">No jobs waiting.</p>
      ) : (
        <ol className="space-y-2">
          {visible.map((q, i) => {
            const mine = q.job_id === myJobId;
            return (
              <li
                key={q.job_id}
                className={`flex items-center gap-3 border px-3 py-2 ${
                  mine ? "border-primary bg-primary/10" : "border-primary/10"
                }`}
              >
                <span className="w-6 font-mono text-[10px] text-foreground/40">#{i + 1}</span>
                <span
                  className="size-4 border border-foreground/30"
                  style={{ backgroundColor: q.guest_color }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-sm">{q.guest_name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                  {q.status === "printing" ? "printing" : q.paper_size}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function OperatorLink({ agentUrl }: { agentUrl: string }) {
  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Operator
      </div>
      <p className="mb-4 text-sm text-foreground/60">
        Full queue control, reorder, pause/resume, and color calibration live on the agent itself.
      </p>
      <a
        href={`${agentUrl}/console`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex border border-primary/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] hover:bg-primary/10 hover:border-primary/60"
      >
        Open Operator Console ↗
      </a>
    </div>
  );
}

// ───────────────────────────── tag stamp helper ─────────────────────────────

async function stampGuestTag(file: File, identity: Identity): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const stripH = Math.max(28, Math.round(img.height * 0.04));
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height + stripH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, img.height, img.width, stripH);
    // color square
    const pad = stripH * 0.2;
    ctx.fillStyle = identity.guest_color;
    ctx.fillRect(pad, img.height + pad, stripH - pad * 2, stripH - pad * 2);
    // name
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(stripH * 0.5)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(
      identity.guest_name.toUpperCase(),
      stripH,
      img.height + stripH / 2,
      img.width - stripH * 2,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
