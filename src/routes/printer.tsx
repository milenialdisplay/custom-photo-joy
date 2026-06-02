import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { BackToHome } from "@/components/site/BackToHome";

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

// Only A4 and A5 are supported. Printer margins are fixed by the agent.
const PAPER_SIZES = ["A4", "A5"] as const;
// Minimum pixel dimensions for "standard" print quality (≈200 dpi).
// Below these, we warn the user that the print may look blurry.
const MIN_RES: Record<(typeof PAPER_SIZES)[number], { short: number; long: number; label: string }> = {
  A4: { short: 1654, long: 2339, label: "A4 (≥1654 × 2339 px)" },
  A5: { short: 1165, long: 1654, label: "A5 (≥1165 × 1654 px)" },
};
// Pay-per-print pricing (IDR). Shown on the identity card and used by the pay button.
const PRINT_PRICE_IDR: Record<(typeof PAPER_SIZES)[number], number> = {
  A4: 15000,
  A5: 10000,
};
const DEFAULT_GUEST_COLOR = "#73ffb8";
const formatIDR = (n: number) => "IDR " + n.toLocaleString("id-ID");

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
      <div className="mx-auto flex max-w-7xl justify-end px-6 pt-4">
        <BackToHome />
      </div>
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

  // hydrate — auto-create an anonymous booth identity if none exists yet.
  // Guests wait at the booth and pay there, so no signup step is needed.
  useEffect(() => {
    let id = loadIdentity();
    if (!id) {
      id = { guest_id: uuid(), guest_name: "Booth Guest", guest_color: DEFAULT_GUEST_COLOR };
      saveIdentity(id);
    }
    setIdentity(id);
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



  return (
    <section className="border-y border-primary/10 bg-muted/30 px-6 py-16">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
          <PrinterStatusBanner
            health={health}
            healthError={healthError}
            jobStatus={activeJobInfo?.status ?? null}
          />
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
  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Identify_Yourself
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight">Pick a name &amp; pay</h2>
      <p className="mb-6 text-sm text-foreground/60">
        Stored on this phone only. Pay per print at the booth — no subscription, no signup.
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

      {/* Pricing — pay per print */}
      <div className="mb-6 border border-primary/20 bg-background/40 p-4">
        <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em]">
          <span className="text-primary">// Pricing</span>
          <span className="text-foreground/40">per print</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {PAPER_SIZES.map((size) => (
            <div
              key={size}
              className="flex flex-col gap-1 border border-primary/15 bg-background/60 px-3 py-3"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/50">
                {size}
              </span>
              <span className="text-xl font-bold tracking-tight">
                {formatIDR(PRINT_PRICE_IDR[size])}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">
          Charged on send · cash or QRIS at the booth
        </p>
      </div>

      <NeonButton
        size="md"
        glow
        disabled={!name.trim()}
        onClick={() => name.trim() && onSave(name.trim(), DEFAULT_GUEST_COLOR)}
      >
        Pay &amp; Continue
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

// Prominent printer-connection lifecycle banner:
//   connecting → connected (ready/printing) → "print complete, disconnecting"
//   → idle/connected again. Also surfaces offline / error states clearly.
function PrinterStatusBanner({
  health,
  healthError,
  jobStatus,
}: {
  health: HealthResponse | null;
  healthError: string | null;
  jobStatus: JobStatus | null;
}) {
  // detect the moment a job finishes to flash a "disconnecting" pulse
  const prevJobStatus = useRef<JobStatus | null>(null);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    if (
      prevJobStatus.current === "printing" &&
      (jobStatus === "done" || jobStatus === "failed")
    ) {
      setJustFinished(true);
      const t = window.setTimeout(() => setJustFinished(false), 6000);
      prevJobStatus.current = jobStatus;
      return () => window.clearTimeout(t);
    }
    prevJobStatus.current = jobStatus;
  }, [jobStatus]);

  // first paint, before health has returned and before any error: connecting
  const connecting = !health && !healthError;
  const offline = !!healthError && !health;
  const printerState = health?.printer ?? "offline";
  const printing = jobStatus === "printing";

  let tone: "connecting" | "connected" | "printing" | "finished" | "error" | "offline";
  let title: string;
  let detail: string;

  if (justFinished) {
    tone = "finished";
    title = jobStatus === "failed" ? "Print failed — disconnected" : "Print complete — disconnected";
    detail = "Printer link released. Ready for the next job.";
  } else if (connecting) {
    tone = "connecting";
    title = "Connecting to printer…";
    detail = "Reaching the booth agent over the LAN.";
  } else if (offline) {
    tone = "offline";
    title = "Printer disconnected";
    detail = healthError ? `Agent unreachable: ${healthError}` : "Agent offline.";
  } else if (printerState === "error") {
    tone = "error";
    title = "Printer error";
    detail = "Check paper, ink, and tray, then retry.";
  } else if (printing) {
    tone = "printing";
    title = "Printer connected — printing";
    detail = "Your job is on the rollers. Stand by at the tray.";
  } else {
    tone = "connected";
    title = "Printer connected";
    detail = printerState === "ready" ? "Ready to receive jobs." : "Standing by.";
  }

  const palette: Record<typeof tone, { border: string; dot: string; pulse: boolean; chip: string }> = {
    connecting: {
      border: "border-primary/40 bg-primary/5",
      dot: "bg-primary",
      pulse: true,
      chip: "text-primary",
    },
    connected: {
      border: "border-primary/60 bg-primary/10",
      dot: "bg-primary",
      pulse: false,
      chip: "text-primary",
    },
    printing: {
      border: "border-primary/70 bg-primary/15",
      dot: "bg-primary",
      pulse: true,
      chip: "text-primary",
    },
    finished: {
      border: "border-primary/40 bg-primary/5",
      dot: "bg-primary/60",
      pulse: true,
      chip: "text-primary",
    },
    error: {
      border: "border-destructive/60 bg-destructive/10",
      dot: "bg-destructive",
      pulse: true,
      chip: "text-destructive",
    },
    offline: {
      border: "border-destructive/50 bg-destructive/5",
      dot: "bg-destructive/80",
      pulse: false,
      chip: "text-destructive",
    },
  };
  const p = palette[tone];

  return (
    <div className={`border ${p.border} p-5`}>
      <div className={`mb-3 font-mono text-[10px] uppercase tracking-[0.3em] ${p.chip}`}>
        // Printer_Link
      </div>
      <div className="flex items-start gap-3">
        <span className="relative mt-1 flex h-3 w-3 shrink-0">
          {p.pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${p.dot}`}
            />
          )}
          <span className={`relative inline-flex h-3 w-3 rounded-full ${p.dot}`} />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-sm uppercase tracking-[0.15em] text-foreground">
            {title}
          </div>
          <div className="mt-1 font-mono text-[11px] text-foreground/60">{detail}</div>
        </div>
      </div>
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
  const [paperSize, setPaperSize] = useState<(typeof PAPER_SIZES)[number]>("A4");
  const [copies, setCopies] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resWarning, setResWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkResolution = useCallback(
    (f: File | null, size: (typeof PAPER_SIZES)[number]) => {
      setResWarning(null);
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const short = Math.min(img.width, img.height);
        const long = Math.max(img.width, img.height);
        const need = MIN_RES[size];
        if (short < need.short || long < need.long) {
          setResWarning(
            `Resolution is lower than standard ${need.label}. Your photo is ${img.width}×${img.height} — print may look blurry.`,
          );
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    },
    [],
  );

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
      fd.append("paper_preset", "default");
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
  }, [agentUrl, copies, file, identity, onSubmitted, paperSize, tagPrint]);

  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Upload_&amp;_Print
      </div>
      <h2 className="mb-1 text-2xl font-bold tracking-tight">Upload a file to print</h2>
      <p className="mb-5 text-sm text-foreground/60">
        Drop an image or document, pick A4 or A5, and send it to the booth printer.
        Pay at the booth on pickup.
      </p>

      <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60">
        File (image or document)
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          checkResolution(f, paperSize);
        }}
        className="mb-3 block w-full text-sm file:mr-4 file:border file:border-primary/30 file:bg-transparent file:px-4 file:py-2 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.2em] file:text-primary hover:file:bg-primary/10"
      />



      {resWarning && (
        <div
          role="alert"
          className="mb-5 border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 font-mono text-[11px] text-yellow-300"
        >
          ⚠ {resWarning}
        </div>
      )}

      <PrintPreview file={file} paperSize={paperSize} />

      <div className="mb-5 grid grid-cols-2 gap-4">
        <Field label="Paper size">
          <select
            className="w-full border border-primary/20 bg-background px-3 py-2 font-mono text-xs"
            value={paperSize}
            onChange={(e) => {
              const v = e.target.value as (typeof PAPER_SIZES)[number];
              setPaperSize(v);
              checkResolution(file, v);
            }}
          >
            {PAPER_SIZES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Copies (1–10)">
          <input
            type="number"
            min={1}
            max={10}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
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

// ───────────────────────────── print preview ─────────────────────────────

// Physical paper dimensions in mm. The agent applies a fixed 12mm safe margin
// inside the printable area, so we mirror that here for an accurate preview.
const PAPER_MM: Record<(typeof PAPER_SIZES)[number], { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
};
const SAFE_MARGIN_MM = 12;
const CROP_MARK_MM = 5;
const CROP_OFFSET_MM = 3;

function PrintPreview({
  file,
  paperSize,
}: {
  file: File | null;
  paperSize: (typeof PAPER_SIZES)[number];
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setImgUrl(null);
      setImgDims(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const probe = new Image();
    probe.onload = () => setImgDims({ w: probe.width, h: probe.height });
    probe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const paper = PAPER_MM[paperSize];
  // Fit image inside safe area, preserving aspect ratio (contain).
  const safeW = paper.w - SAFE_MARGIN_MM * 2;
  const safeH = paper.h - SAFE_MARGIN_MM * 2;
  let fit = { w: safeW, h: safeH, x: SAFE_MARGIN_MM, y: SAFE_MARGIN_MM };
  if (imgDims) {
    const ar = imgDims.w / imgDims.h;
    const safeAr = safeW / safeH;
    if (ar > safeAr) {
      const h = safeW / ar;
      fit = { w: safeW, h, x: SAFE_MARGIN_MM, y: SAFE_MARGIN_MM + (safeH - h) / 2 };
    } else {
      const w = safeH * ar;
      fit = { w, h: safeH, x: SAFE_MARGIN_MM + (safeW - w) / 2, y: SAFE_MARGIN_MM };
    }
  }

  // Crop marks: short ticks just outside each corner of the safe area.
  const m = SAFE_MARGIN_MM;
  const off = CROP_OFFSET_MM;
  const len = CROP_MARK_MM;
  const corners = [
    { x: m, y: m },
    { x: paper.w - m, y: m },
    { x: m, y: paper.h - m },
    { x: paper.w - m, y: paper.h - m },
  ];

  return (
    <div className="mb-5 border border-primary/20 bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]">
        <span className="text-primary">// Print_Preview</span>
        <span className="text-foreground/50">
          {paperSize} · {paper.w}×{paper.h}mm · 12mm safe margin
        </span>
      </div>
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${paper.w} ${paper.h}`}
          className="h-auto w-full max-w-[260px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_10px_30px_-10px_rgba(0,0,0,0.4)]"
          style={{ aspectRatio: `${paper.w} / ${paper.h}` }}
          aria-label={`Print preview at ${paperSize}`}
        >
          {/* Paper background */}
          <rect x={0} y={0} width={paper.w} height={paper.h} fill="#ffffff" />

          {/* Image / placeholder inside safe area */}
          {imgUrl ? (
            <image
              href={imgUrl}
              x={fit.x}
              y={fit.y}
              width={fit.w}
              height={fit.h}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <rect
              x={SAFE_MARGIN_MM}
              y={SAFE_MARGIN_MM}
              width={safeW}
              height={safeH}
              fill="#f3f3f3"
              stroke="#cccccc"
              strokeWidth={0.2}
              strokeDasharray="2 2"
            />
          )}

          {/* Safe-area outline (dashed) */}
          <rect
            x={SAFE_MARGIN_MM}
            y={SAFE_MARGIN_MM}
            width={safeW}
            height={safeH}
            fill="none"
            stroke="#2dd4a8"
            strokeWidth={0.25}
            strokeDasharray="1.5 1.5"
            opacity={0.7}
          />

          {/* Crop marks at the four corners of the safe area */}
          <g stroke="#0a0a0a" strokeWidth={0.3}>
            {corners.map((c, i) => {
              const dx = c.x < paper.w / 2 ? -1 : 1;
              const dy = c.y < paper.h / 2 ? -1 : 1;
              return (
                <g key={i}>
                  <line
                    x1={c.x + dx * off}
                    y1={c.y}
                    x2={c.x + dx * (off + len)}
                    y2={c.y}
                  />
                  <line
                    x1={c.x}
                    y1={c.y + dy * off}
                    x2={c.x}
                    y2={c.y + dy * (off + len)}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="mt-3 flex justify-center gap-4 font-mono text-[9px] uppercase tracking-[0.2em] text-foreground/50">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-3 border-t border-dashed border-primary" />
          Safe area
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 border-l border-t border-foreground" />
          Crop marks
        </span>
      </div>
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
  const printing = visible.find((q) => q.status === "printing") ?? null;
  const myIndex = myJobId ? visible.findIndex((q) => q.job_id === myJobId) : -1;
  const myJob = myIndex >= 0 ? visible[myIndex] : null;
  const ahead = myIndex > 0 ? myIndex : 0;
  const etaSeconds = ahead * 15; // matches avg_print_seconds_default

  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-4 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em]">
        <span className="text-primary">// Queue</span>
        <span className="text-foreground/40">{visible.length} active</span>
      </div>

      {/* YOUR POSITION — primary indicator */}
      {myJob ? (
        <div
          className={`mb-4 border-2 p-4 ${
            myJob.status === "printing"
              ? "border-primary bg-primary/15"
              : "border-primary/60 bg-primary/5"
          }`}
        >
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
            // You
          </div>
          {myJob.status === "printing" ? (
            <>
              <div className="text-3xl font-bold tracking-tighter text-primary animate-pulse">
                Printing now
              </div>
              <div className="mt-1 font-mono text-[11px] text-foreground/70">
                Head to the tray — look for your color tag.
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/60">
                  Position
                </span>
                <span className="text-4xl font-bold tracking-tighter">#{myIndex + 1}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/60">
                  of {visible.length}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-foreground/70">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                {ahead === 0
                  ? "You're up next."
                  : `~${etaSeconds}s — ${ahead} ${ahead === 1 ? "print" : "prints"} ahead of you.`}
              </div>
            </>
          )}
        </div>
      ) : printing ? (
        <div className="mb-4 border border-primary/30 bg-background/40 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/50">
            Now printing
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="size-3 border border-foreground/30"
              style={{ backgroundColor: printing.guest_color }}
              aria-hidden
            />
            <span className="truncate text-sm">{printing.guest_name}</span>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="font-mono text-xs text-foreground/40">No jobs waiting — send the first print.</p>
      ) : (
        <ol className="space-y-2">
          {visible.map((q, i) => {
            const mine = q.job_id === myJobId;
            const isPrinting = q.status === "printing";
            return (
              <li
                key={q.job_id}
                className={`flex items-center gap-3 border px-3 py-2 ${
                  mine
                    ? "border-primary bg-primary/10"
                    : isPrinting
                      ? "border-primary/40 bg-primary/5"
                      : "border-primary/10"
                }`}
              >
                <span
                  className={`w-6 font-mono text-[10px] ${
                    mine ? "font-bold text-primary" : "text-foreground/40"
                  }`}
                >
                  #{i + 1}
                </span>
                <span
                  className="size-4 border border-foreground/30"
                  style={{ backgroundColor: q.guest_color }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-sm">
                  {q.guest_name}
                  {mine && (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
                      you
                    </span>
                  )}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                    isPrinting ? "text-primary animate-pulse" : "text-foreground/50"
                  }`}
                >
                  {isPrinting ? "● printing" : q.paper_size}
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
  const [draft, setDraft] = useState(agentUrl);
  useEffect(() => setDraft(agentUrl), [agentUrl]);
  const connect = () => {
    const url = draft.replace(/\/$/, "");
    window.localStorage.setItem(LS_AGENT_URL, url);
    window.location.reload();
  };
  return (
    <div className="border border-primary/20 bg-background/60 p-6">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        // Connect
      </div>
      <p className="mb-4 text-sm text-foreground/60">
        Point the booth at your printer agent on the LAN.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="flex-1 min-w-[10rem] border border-primary/20 bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={DEFAULT_AGENT_URL}
        />
        <button
          type="button"
          onClick={connect}
          className="border border-primary/60 bg-primary/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-primary hover:bg-primary/20"
        >
          Connect
        </button>
      </div>
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
