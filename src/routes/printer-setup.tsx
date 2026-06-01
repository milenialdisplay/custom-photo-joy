import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/printer-setup")({
  head: () => ({
    meta: [
      { title: "Booth Setup Wizard — dpotopoto" },
      { name: "description", content: "Admin wizard to provision a dpotopoto print booth: discover printer, run a test print, print the QR sticker." },
    ],
  }),
  component: SetupPage,
});

const LS_AGENT = "dpoto.setup.agent_url";
const LS_SIZE = "dpoto.setup.paper_size";
const DEFAULT_AGENT = "http://10.42.0.1:8080";

export type PaperSize = "2R" | "4R" | "A6" | "A5" | "Square";

// Real physical dimensions in mm — drives the sticker preview aspect ratio.
export const PAPER_SIZES: Record<PaperSize, { w: number; h: number; label: string; hint: string }> = {
  "2R":     { w: 64,  h: 89,  label: "2R",     hint: "64 × 89 mm · wallet" },
  "A6":     { w: 105, h: 148, label: "A6",     hint: "105 × 148 mm · postcard" },
  "4R":     { w: 102, h: 152, label: "4R",     hint: "102 × 152 mm · 4×6 in" },
  "A5":     { w: 148, h: 210, label: "A5",     hint: "148 × 210 mm · half-letter" },
  "Square": { w: 102, h: 102, label: "Square", hint: "102 × 102 mm · 4×4 in" },
};

interface Health { agent: string; printer: "ready" | "error" | "offline"; queue_depth: number; }
interface Location { location_id: string; location_label: string; ssid: string; printer_name: string; default_paper_size?: PaperSize; agent_version: string; }
interface Candidate { ip: string; name: string; source: string; }
interface DiscoverResp { candidates: Candidate[]; installed: string[]; }
interface JobResp { status: "queued" | "printing" | "done" | "failed"; position: number; eta_seconds: number; error?: string; }

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<Step, string> = {
  1: "Connect",
  2: "Discover",
  3: "Config",
  4: "Test",
  5: "Sticker",
};

const STEP_TITLES: Record<Step, string> = {
  1: "Connect to the booth agent",
  2: "Find the printer on the LAN",
  3: "Install driver & adopt",
  4: "Print a test page",
  5: "Print the booth QR sticker",
};

function SetupPage() {
  const [agent, setAgent] = useState(DEFAULT_AGENT);
  useEffect(() => { setAgent(localStorage.getItem(LS_AGENT) ?? DEFAULT_AGENT); }, []);

  const [step, setStep] = useState<Step>(1);
  const [health, setHealth] = useState<Health | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [discover, setDiscover] = useState<DiscoverResp | null>(null);
  const [chosen, setChosen] = useState<{ ip?: string; printer_name?: string } | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>("A6");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLog, setScanLog] = useState<string>("");
  const [testJob, setTestJob] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<JobResp | null>(null);

  // Hydrate paper size: localStorage first, then whatever agent reports.
  useEffect(() => {
    const ls = localStorage.getItem(LS_SIZE) as PaperSize | null;
    if (ls && ls in PAPER_SIZES) setPaperSize(ls);
  }, []);
  useEffect(() => {
    const remote = location?.default_paper_size;
    if (remote && remote in PAPER_SIZES && !localStorage.getItem(LS_SIZE)) {
      setPaperSize(remote);
    }
  }, [location?.default_paper_size]);

  const updatePaperSize = (s: PaperSize) => {
    setPaperSize(s);
    localStorage.setItem(LS_SIZE, s);
  };

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const [h, l] = await Promise.all([
          fetch(`${agent}/health`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${agent}/api/location`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (stop) return;
        setHealth(h); setLocation(l); setError(null);
      } catch (e) {
        if (stop) return;
        setHealth(null);
        setError(e instanceof Error ? e.message : "offline");
      }
    };
    void tick();
    const t = window.setInterval(tick, 3000);
    return () => { stop = true; window.clearInterval(t); };
  }, [agent]);

  useEffect(() => {
    if (!testJob) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`${agent}/jobs/${testJob}`, { cache: "no-store" });
        const j = (await r.json()) as JobResp;
        if (!stop) setTestStatus(j);
      } catch { /* ignore */ }
    };
    void tick();
    const iv = window.setInterval(tick, 1500);
    return () => { stop = true; window.clearInterval(iv); };
  }, [agent, testJob]);

  const saveAgent = (u: string) => {
    const url = u.replace(/\/$/, "");
    setAgent(url); localStorage.setItem(LS_AGENT, url);
  };

  const runDiscover = useCallback(async () => {
    setBusy(true); setError(null); setScanLog("Scanning mDNS + port 9100 ...");
    try {
      const r = await fetch(`${agent}/discover`).then((x) => x.json() as Promise<DiscoverResp>);
      setDiscover(r);
      setScanLog(`Found ${r.candidates.length} candidate(s); ${r.installed.length} already in CUPS.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "scan failed");
    } finally { setBusy(false); }
  }, [agent]);

  const configure = useCallback(async () => {
    if (!chosen) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`${agent}/printer/configure`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...chosen, default_paper_size: paperSize }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "configure failed");
    } finally { setBusy(false); }
  }, [agent, chosen, paperSize]);

  const runTest = useCallback(async () => {
    setBusy(true); setError(null); setTestStatus(null);
    try {
      const r = await fetch(`${agent}/printer/test`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setTestJob(data.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "test failed");
    } finally { setBusy(false); }
  }, [agent]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="px-6 py-16">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          {/* HEADER */}
          <header className="space-y-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
              <span>//</span>
              <span>Booth_Setup_Wizard</span>
            </div>
            <h1 className="font-mono text-5xl font-black uppercase leading-none tracking-tighter md:text-6xl">
              Provision<br />This Booth
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-foreground/50">
              One screen, five steps. Run this from a laptop joined to the booth&apos;s
              Wi-Fi (or wired into the Dell). When the test page prints, you&apos;re done.
            </p>
          </header>

          {/* STEP STRIP */}
          <nav className="grid grid-cols-5 gap-1 border border-primary/15 bg-muted/40 p-1">
            {([1, 2, 3, 4, 5] as Step[]).map((n) => {
              const state = n < step ? "done" : n === step ? "active" : "todo";
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => n <= step && setStep(n)}
                  className={`px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
                    state === "active"
                      ? "bg-primary text-primary-foreground"
                      : state === "done"
                      ? "text-primary/80 hover:bg-primary/10"
                      : "text-foreground/40 cursor-default"
                  }`}
                >
                  {n}. {STEP_LABELS[n]}
                </button>
              );
            })}
          </nav>

          {/* STEPS */}
          <div className="space-y-3">
            {([1, 2, 3, 4, 5] as Step[]).map((n) => {
              const active = n === step;
              const done = n < step;
              if (active) {
                return (
                  <ActiveCard key={n} n={n} title={STEP_TITLES[n]}>
                    {n === 1 && (
                      <Step1
                        agent={agent}
                        defaultAgent={DEFAULT_AGENT}
                        onSave={saveAgent}
                        health={health}
                        location={location}
                        error={error}
                        onContinue={() => setStep(2)}
                      />
                    )}
                    {n === 2 && (
                      <Step2
                        busy={busy}
                        discover={discover}
                        scanLog={scanLog}
                        chosen={chosen}
                        setChosen={setChosen}
                        runDiscover={runDiscover}
                        error={error}
                        onContinue={() => setStep(3)}
                      />
                    )}
                    {n === 3 && (
                      <Step3
                        chosen={chosen}
                        busy={busy}
                        error={error}
                        paperSize={paperSize}
                        onPaperSize={updatePaperSize}
                        onConfigure={configure}
                      />
                    )}
                    {n === 4 && (
                      <Step4
                        busy={busy}
                        testJob={testJob}
                        testStatus={testStatus}
                        error={error}
                        paperSize={paperSize}
                        onTest={runTest}
                        onContinue={() => setStep(5)}
                      />
                    )}
                    {n === 5 && <Step5 location={location} paperSize={paperSize} />}
                  </ActiveCard>
                );
              }
              return <StubCard key={n} n={n} title={STEP_TITLES[n]} done={done} onJump={() => done && setStep(n)} />;
            })}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/* ─────────── shells ─────────── */

function ActiveCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border border-primary/40 bg-muted/10 p-8">
      <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/50">
        Step {n}
      </div>
      <h2 className="mb-6 text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function StubCard({ n, title, done, onJump }: { n: number; title: string; done: boolean; onJump: () => void }) {
  return (
    <button
      type="button"
      onClick={onJump}
      disabled={!done}
      className={`flex w-full items-center justify-between border border-primary/10 bg-background/40 p-6 text-left transition-opacity ${
        done ? "opacity-70 hover:opacity-100 hover:border-primary/30 cursor-pointer" : "opacity-40 cursor-default"
      }`}
    >
      <div className="space-y-1">
        <div className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-foreground/40">
          Step {n} {done && "· done"}
        </div>
        <h3 className="text-sm font-bold text-foreground/70">{title}</h3>
      </div>
      <div className={`flex size-5 items-center justify-center border ${done ? "border-primary/40" : "border-primary/15"}`}>
        <div className={`size-1 ${done ? "bg-primary" : "bg-foreground/20"}`} />
      </div>
    </button>
  );
}

/* ─────────── primitives ─────────── */

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground/70">
      <span className={`size-1.5 rounded-full ${ok ? "bg-primary animate-pulse" : "bg-destructive animate-pulse"}`} />
      {label}
    </span>
  );
}

function NeonCTA({ children, onClick, disabled, fullWidth }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; fullWidth?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${fullWidth ? "w-full md:w-auto" : ""} px-10 py-4 font-mono text-xs font-black uppercase tracking-tighter transition-colors ${
        disabled
          ? "bg-primary/20 text-primary-foreground/40 cursor-not-allowed"
          : "bg-primary text-primary-foreground hover:bg-primary/80 cursor-pointer"
      }`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-foreground/60">
      {children}
    </label>
  );
}

function MonoInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-primary/15 bg-black/40 p-4 font-mono text-sm text-primary focus:border-primary focus:outline-none"
    />
  );
}

/* ─────────── step bodies ─────────── */

function Step1({
  agent, defaultAgent, onSave, health, location, error, onContinue,
}: {
  agent: string; defaultAgent: string; onSave: (u: string) => void;
  health: Health | null; location: Location | null; error: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <FieldLabel>Agent URL</FieldLabel>
        <MonoInput defaultValue={agent} onBlur={(e) => onSave(e.target.value)} placeholder={defaultAgent} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill ok={!!health} label={health ? "Agent online" : "Agent offline"} />
        {location && (
          <>
            <Pill ok label={`id: ${location.location_id}`} />
            <Pill ok label={`ssid: ${location.ssid || "—"}`} />
            <Pill ok label={`printer: ${location.printer_name || "none"}`} />
          </>
        )}
      </div>
      {error && (
        <p className="font-mono text-[11px] text-destructive/80">Cannot reach agent: {error}</p>
      )}
      <NeonCTA disabled={!health} onClick={onContinue} fullWidth>Continue</NeonCTA>
    </div>
  );
}

function Step2({
  busy, discover, scanLog, chosen, setChosen, runDiscover, error, onContinue,
}: {
  busy: boolean; discover: DiscoverResp | null; scanLog: string;
  chosen: { ip?: string; printer_name?: string } | null;
  setChosen: (c: { ip?: string; printer_name?: string }) => void;
  runDiscover: () => void; error: string | null; onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground/60">Scans mDNS (Bonjour) and port 9100 on the local subnet.</p>
      <div className="flex flex-wrap items-center gap-3">
        <NeonCTA onClick={runDiscover} disabled={busy}>
          {busy ? "Scanning…" : discover ? "Re-scan" : "Scan now"}
        </NeonCTA>
        {scanLog && <span className="font-mono text-[11px] text-foreground/50">{scanLog}</span>}
      </div>

      {discover && (
        <div className="space-y-2">
          {discover.installed.length > 0 && (
            <div className="border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                Already installed in CUPS
              </div>
              {discover.installed.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setChosen({ printer_name: n })}
                  className={`mr-2 mb-2 border px-3 py-2 font-mono text-xs transition-colors ${
                    chosen?.printer_name === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/20 hover:border-primary/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {discover.candidates.length === 0 ? (
            <p className="font-mono text-[11px] text-foreground/50">
              No network printers discovered. Plug via USB and use hp-setup on the Dell,
              or pick a CUPS-installed printer above.
            </p>
          ) : (
            discover.candidates.map((c) => (
              <button
                key={c.ip}
                type="button"
                onClick={() => setChosen({ ip: c.ip })}
                className={`flex w-full items-center justify-between border p-3 text-left transition-colors ${
                  chosen?.ip === c.ip
                    ? "border-primary bg-primary/10"
                    : "border-primary/20 hover:border-primary/50"
                }`}
              >
                <span>
                  <span className="font-mono text-sm">{c.ip}</span>
                  <span className="ml-3 text-xs text-foreground/60">{c.name}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
                  {c.source}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="font-mono text-[11px] text-destructive/80">{error}</p>}
      <NeonCTA disabled={!chosen} onClick={onContinue} fullWidth>Continue</NeonCTA>
    </div>
  );
}

function Step3({
  chosen, busy, error, paperSize, onPaperSize, onConfigure,
}: {
  chosen: { ip?: string; printer_name?: string } | null;
  busy: boolean; error: string | null;
  paperSize: PaperSize; onPaperSize: (s: PaperSize) => void;
  onConfigure: () => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-foreground/60">
        {chosen?.ip
          ? `Will run hp-setup -i -a -x ${chosen.ip} on the Dell, then save the printer name to config.`
          : chosen?.printer_name
          ? `Will adopt existing CUPS printer "${chosen.printer_name}" as this booth's printer.`
          : "Nothing chosen."}
      </p>

      <div className="space-y-3">
        <FieldLabel>Default print size</FieldLabel>
        <SizePicker value={paperSize} onChange={onPaperSize} />
        <div className="flex items-start gap-4 border border-primary/10 bg-background/40 p-4">
          <StickerPreview size={paperSize} maxPx={140} />
          <div className="space-y-1 font-mono text-[11px] text-foreground/60">
            <div className="text-primary">{PAPER_SIZES[paperSize].label}</div>
            <div>{PAPER_SIZES[paperSize].hint}</div>
            <div className="opacity-60">
              ratio: {(PAPER_SIZES[paperSize].w / PAPER_SIZES[paperSize].h).toFixed(3)}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="font-mono text-[11px] text-destructive/80">{error}</p>}
      <NeonCTA disabled={!chosen || busy} onClick={onConfigure} fullWidth>
        {busy ? "Configuring…" : "Configure printer"}
      </NeonCTA>
    </div>
  );
}

function Step4({
  busy, testJob, testStatus, error, paperSize, onTest, onContinue,
}: {
  busy: boolean; testJob: string | null; testStatus: JobResp | null;
  error: string | null; paperSize: PaperSize;
  onTest: () => void; onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground/60">
        Sends the bundled test chart at <span className="font-mono text-primary">{PAPER_SIZES[paperSize].label}</span> ({PAPER_SIZES[paperSize].hint}). Watch the tray.
      </p>
      <NeonCTA disabled={busy} onClick={onTest}>
        {testJob ? "Re-send test" : "Send test print"}
      </NeonCTA>
      {testStatus && (
        <div className="border border-primary/20 bg-background/60 p-4 font-mono text-xs">
          <div>job: {testJob}</div>
          <div>size: {paperSize}</div>
          <div>status: {testStatus.status}</div>
          {testStatus.position > 0 && <div>position: {testStatus.position}</div>}
          {testStatus.error && <div className="text-destructive">error: {testStatus.error}</div>}
        </div>
      )}
      {error && <p className="font-mono text-[11px] text-destructive/80">{error}</p>}
      <NeonCTA disabled={testStatus?.status !== "done"} onClick={onContinue} fullWidth>
        It printed → finish
      </NeonCTA>
    </div>
  );
}

function Step5({ location, paperSize }: { location: Location | null; paperSize: PaperSize }) {
  const dims = PAPER_SIZES[paperSize];
  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground/60">
        The provisioning script generated a sticker PDF on the Dell at <span className="font-mono text-primary">{dims.label}</span>:
      </p>
      <pre className="overflow-auto border border-primary/20 bg-black/40 p-3 font-mono text-[11px] text-primary">
{`~/agent/booth-stickers/booth-${location?.location_id ?? "<id>"}-${paperSize.toLowerCase()}.pdf`}
      </pre>

      <div className="flex flex-col items-center gap-4 border border-primary/20 bg-background/40 p-6 sm:flex-row sm:items-start">
        <StickerPreview size={paperSize} maxPx={260} withContent location={location} />
        <ol className="flex-1 space-y-2 text-sm text-foreground/70">
          <li>1. SCP it off the Dell, or open it on the Dell&apos;s desktop.</li>
          <li>2. Print {dims.label} ({dims.hint}), laminate, stick at phone-height.</li>
          <li>3. Test: phone camera → scan Wi-Fi QR → tap join.</li>
          <li>4. Scan the App QR → upload a photo → done.</li>
        </ol>
      </div>

      <div className="border border-primary/30 bg-primary/5 p-4 font-mono text-xs">
        <div className="mb-2 font-bold uppercase tracking-[0.2em] text-primary">✓ Booth live</div>
        <div>location: {location?.location_label}</div>
        <div>ssid: {location?.ssid}</div>
        <div>size: {dims.label} · {dims.hint}</div>
        <div>app url: http://10.42.0.1:8080/booth?loc={location?.location_id}</div>
      </div>
    </div>
  );
}

/* ─────────── size picker + scaled preview ─────────── */

function SizePicker({ value, onChange }: { value: PaperSize; onChange: (s: PaperSize) => void }) {
  const order: PaperSize[] = ["2R", "A6", "4R", "A5", "Square"];
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
      {order.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`flex flex-col items-start gap-1 border px-3 py-2.5 text-left transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-primary/15 text-foreground/70 hover:border-primary/40"
            }`}
          >
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              {PAPER_SIZES[s].label}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-foreground/50">
              {PAPER_SIZES[s].w}×{PAPER_SIZES[s].h}mm
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Renders a rectangle sized to the paper's real aspect ratio, capped at `maxPx` on the long edge. */
function StickerPreview({
  size, maxPx, withContent, location,
}: {
  size: PaperSize; maxPx: number; withContent?: boolean; location?: Location | null;
}) {
  const { w, h } = PAPER_SIZES[size];
  const long = Math.max(w, h);
  const px = (mm: number) => (mm / long) * maxPx;
  const widthPx = px(w);
  const heightPx = px(h);

  return (
    <div
      role="img"
      aria-label={`${PAPER_SIZES[size].label} sticker preview`}
      className="relative shrink-0 border-2 border-primary/60 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_8px_30px_-12px_rgba(94,242,161,0.35)]"
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
    >
      {/* corner crop marks */}
      <CropMark className="left-0 top-0" />
      <CropMark className="right-0 top-0 rotate-90" />
      <CropMark className="left-0 bottom-0 -rotate-90" />
      <CropMark className="right-0 bottom-0 rotate-180" />

      {withContent && (
        <div className="absolute inset-0 flex flex-col p-[6%]">
          <div className="font-mono text-[8px] font-bold uppercase tracking-[0.25em] text-primary">
            dpotopoto
          </div>
          <div className="mt-auto space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <QrPlaceholder label="Wi-Fi" />
              <QrPlaceholder label="App" />
            </div>
            <div className="truncate font-mono text-[7px] uppercase tracking-wider text-foreground/60">
              {location?.location_label ?? "Booth"}
            </div>
          </div>
        </div>
      )}

      {!withContent && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
          {PAPER_SIZES[size].label}
        </div>
      )}
    </div>
  );
}

function CropMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`absolute size-2 ${className}`}>
      <span className="absolute left-0 top-0 h-px w-2 bg-primary/70" />
      <span className="absolute left-0 top-0 h-2 w-px bg-primary/70" />
    </span>
  );
}

function QrPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="aspect-square w-full bg-foreground"
        style={{
          backgroundImage:
            "repeating-conic-gradient(currentColor 0 25%, transparent 0 50%)",
          backgroundSize: "20% 20%",
          color: "hsl(var(--background))",
        }}
      />
      <span className="font-mono text-[6px] uppercase tracking-wider text-foreground/60">{label}</span>
    </div>
  );
}
