import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";

export const Route = createFileRoute("/printer/setup")({
  head: () => ({
    meta: [
      { title: "Booth Setup Wizard — dpotopoto" },
      { name: "description", content: "Admin wizard to provision a dpotopoto print booth: discover printer, run a test print, print the QR sticker." },
    ],
  }),
  component: SetupPage,
});

const LS_AGENT = "dpoto.setup.agent_url";
const DEFAULT_AGENT = "http://10.42.0.1:8080";

// ─── types ───
interface Health { agent: string; printer: "ready" | "error" | "offline"; queue_depth: number; }
interface Location { location_id: string; location_label: string; ssid: string; printer_name: string; agent_version: string; }
interface Candidate { ip: string; name: string; source: string; }
interface DiscoverResp { candidates: Candidate[]; installed: string[]; }
interface JobResp { status: "queued" | "printing" | "done" | "failed"; position: number; eta_seconds: number; error?: string; }

type Step = 1 | 2 | 3 | 4 | 5;

function SetupPage() {
  const [agent, setAgent] = useState(DEFAULT_AGENT);
  useEffect(() => { setAgent(localStorage.getItem(LS_AGENT) ?? DEFAULT_AGENT); }, []);

  const [step, setStep] = useState<Step>(1);
  const [health, setHealth] = useState<Health | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [discover, setDiscover] = useState<DiscoverResp | null>(null);
  const [chosen, setChosen] = useState<{ ip?: string; printer_name?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLog, setScanLog] = useState<string>("");
  const [testJob, setTestJob] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<JobResp | null>(null);

  // Step 1: poll /health + /api/location
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

  // Poll test job
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
        body: JSON.stringify(chosen),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "configure failed");
    } finally { setBusy(false); }
  }, [agent, chosen]);

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
      <section className="relative overflow-hidden px-6 pt-16 pb-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            // Booth_Setup_Wizard
          </div>
          <h1 className="mb-3 text-4xl font-bold uppercase tracking-tighter md:text-6xl">
            Provision this booth
          </h1>
          <p className="max-w-xl text-sm text-foreground/60">
            One screen, five steps. Run this from a laptop joined to the booth&apos;s
            Wi-Fi (or wired into the Dell). When the test page prints, you&apos;re done.
          </p>
        </div>
      </section>

      <section className="border-y border-primary/10 bg-muted/30 px-6 py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <Stepper current={step} />

          {/* STEP 1 — Connect */}
          <StepCard n={1} active={step === 1} done={step > 1} title="Connect to the booth agent">
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/60">
              Agent URL
            </label>
            <div className="mb-4 flex gap-2">
              <input
                className="flex-1 border border-primary/20 bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
                defaultValue={agent}
                onBlur={(e) => saveAgent(e.target.value)}
                placeholder={DEFAULT_AGENT}
              />
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Pill ok={!!health} label={health ? "Agent online" : "Agent offline"} />
              {location && (
                <>
                  <Pill ok label={`ID: ${location.location_id}`} neutral />
                  <Pill ok label={`SSID: ${location.ssid || "—"}`} neutral />
                  <Pill
                    ok={!!location.printer_name && location.printer_name !== "HP_M451"}
                    label={location.printer_name ? `Printer cfg: ${location.printer_name}` : "No printer"}
                    neutral
                  />
                </>
              )}
            </div>
            {error && step === 1 && (
              <p className="font-mono text-[11px] text-destructive/80">Cannot reach agent: {error}</p>
            )}
            <div className="mt-4">
              <NeonButton size="md" disabled={!health} onClick={() => setStep(2)}>
                Continue
              </NeonButton>
            </div>
          </StepCard>

          {/* STEP 2 — Discover */}
          <StepCard n={2} active={step === 2} done={step > 2} title="Find the printer on the LAN">
            <p className="mb-4 text-sm text-foreground/60">
              Scans mDNS (Bonjour) and port 9100 on the local subnet.
            </p>
            <div className="mb-4 flex gap-3">
              <NeonButton size="md" onClick={runDiscover} disabled={busy}>
                {busy ? "Scanning…" : discover ? "Re-scan" : "Scan now"}
              </NeonButton>
              {scanLog && <span className="self-center font-mono text-[11px] text-foreground/50">{scanLog}</span>}
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
                        className={`mr-2 mb-2 border px-3 py-2 font-mono text-xs ${
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
                      className={`flex w-full items-center justify-between border p-3 text-left ${
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

            <div className="mt-5">
              <NeonButton size="md" disabled={!chosen} onClick={() => setStep(3)}>
                Continue
              </NeonButton>
            </div>
          </StepCard>

          {/* STEP 3 — Configure */}
          <StepCard n={3} active={step === 3} done={step > 3} title="Install driver & adopt">
            <p className="mb-4 text-sm text-foreground/60">
              {chosen?.ip
                ? `Will run hp-setup -i -a -x ${chosen.ip} on the Dell, then save the printer name to config.`
                : chosen?.printer_name
                ? `Will adopt existing CUPS printer "${chosen.printer_name}" as this booth's printer.`
                : "Nothing chosen."}
            </p>
            {error && step === 3 && (
              <p className="mb-3 font-mono text-[11px] text-destructive/80">{error}</p>
            )}
            <NeonButton size="md" disabled={!chosen || busy} onClick={configure}>
              {busy ? "Configuring…" : "Configure printer"}
            </NeonButton>
          </StepCard>

          {/* STEP 4 — Test print */}
          <StepCard n={4} active={step === 4} done={step > 4} title="Print a test page">
            <p className="mb-4 text-sm text-foreground/60">
              Sends the bundled test chart. Watch the tray.
            </p>
            <div className="mb-4">
              <NeonButton size="md" disabled={busy} onClick={runTest}>
                {testJob ? "Re-send test" : "Send test print"}
              </NeonButton>
            </div>
            {testStatus && (
              <div className="border border-primary/20 bg-background/60 p-4 font-mono text-xs">
                <div>job: {testJob}</div>
                <div>status: {testStatus.status}</div>
                {testStatus.position > 0 && <div>position: {testStatus.position}</div>}
                {testStatus.error && (
                  <div className="text-destructive">error: {testStatus.error}</div>
                )}
              </div>
            )}
            {error && step === 4 && (
              <p className="mt-3 font-mono text-[11px] text-destructive/80">{error}</p>
            )}
            <div className="mt-4">
              <NeonButton
                size="md"
                disabled={testStatus?.status !== "done"}
                onClick={() => setStep(5)}
              >
                It printed → finish
              </NeonButton>
            </div>
          </StepCard>

          {/* STEP 5 — Sticker */}
          <StepCard n={5} active={step === 5} done={false} title="Print the booth QR sticker">
            <p className="mb-3 text-sm text-foreground/60">
              The provisioning script generated a sticker PDF on the Dell:
            </p>
            <pre className="mb-4 overflow-auto border border-primary/20 bg-background p-3 font-mono text-[11px]">
{`~/agent/booth-stickers/booth-${location?.location_id ?? "<id>"}.pdf`}
            </pre>
            <ol className="mb-4 space-y-2 text-sm text-foreground/70">
              <li>1. SCP it off the Dell, or open it locally on the Dell&apos;s desktop.</li>
              <li>2. Print A5, laminate, stick on the booth at phone-height.</li>
              <li>3. Test: phone camera → scan Wi-Fi QR → tap the join notification.</li>
              <li>4. Scan the App QR → upload a photo → done.</li>
            </ol>
            <div className="border border-primary/30 bg-primary/5 p-4 font-mono text-xs">
              <div className="mb-2 font-bold uppercase tracking-[0.2em] text-primary">
                ✓ Booth live
              </div>
              <div>location: {location?.location_label}</div>
              <div>ssid: {location?.ssid}</div>
              <div>app url: http://10.42.0.1:8080/booth?loc={location?.location_id}</div>
            </div>
          </StepCard>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps = ["Connect", "Discover", "Configure", "Test", "Sticker"];
  return (
    <div className="flex gap-1 border border-primary/20 bg-background/60 p-2">
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const state = n < current ? "done" : n === current ? "active" : "todo";
        return (
          <div
            key={label}
            className={`flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${
              state === "done"
                ? "bg-primary/15 text-primary"
                : state === "active"
                ? "bg-primary text-primary-foreground"
                : "text-foreground/40"
            }`}
          >
            {n}. {label}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({
  n, active, done, title, children,
}: {
  n: number; active: boolean; done: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <div
      className={`border p-6 transition-opacity ${
        active ? "border-primary bg-background/80"
        : done ? "border-primary/30 bg-background/40 opacity-70"
        : "border-primary/10 bg-background/30 opacity-50"
      }`}
    >
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
        Step {n} {done && "· done"}
      </div>
      <h2 className="mb-4 text-xl font-bold tracking-tight">{title}</h2>
      {(active || done) && children}
    </div>
  );
}

function Pill({ ok, label, neutral }: { ok: boolean; label: string; neutral?: boolean }) {
  const color = neutral
    ? "border-primary/20 text-foreground/70"
    : ok
    ? "border-primary/60 text-primary"
    : "border-foreground/20 text-foreground/40";
  return (
    <span className={`inline-flex items-center gap-2 border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${color}`}>
      <span className={`size-1.5 rounded-full ${ok ? "bg-primary" : "bg-foreground/40"}`} />
      {label}
    </span>
  );
}
