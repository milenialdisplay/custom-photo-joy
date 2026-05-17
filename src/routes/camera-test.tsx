import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { AlertCircle, RefreshCw, Camera, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import { setPendingCapture } from "@/lib/pending-capture";

type FacingMode = "user" | "environment";

type CameraStatus = "idle" | "starting" | "ready" | "error" | "denied";

export const Route = createFileRoute("/camera-test")({
  head: () => ({
    meta: [
      { title: "Camera Test — dpotopoto.com" },
      { name: "description", content: "Test your camera before entering the photo booth studio." },
    ],
  }),
  component: CameraTestPage,
});

function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "safari";
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Edg")) return "edge";
  return "other";
}

function PermissionHelp() {
  const browser = getBrowserName();
  const steps: Record<string, string[]> = {
    chrome: [
      "Click the lock icon in the address bar.",
      "Select 'Site settings'.",
      "Set 'Camera' to Allow.",
      "Refresh this page and try again.",
    ],
    safari: [
      "Open Safari Preferences (⌘,).",
      "Go to the 'Websites' tab.",
      "Select 'Camera' on the left.",
      "Find this site and set it to Allow.",
    ],
    firefox: [
      "Click the lock icon in the address bar.",
      "Click the 'x' next to 'Blocked Temporarily' for Camera.",
      "Refresh this page and allow when prompted.",
    ],
    edge: [
      "Click the lock icon in the address bar.",
      "Select 'Permissions for this site'.",
      "Set 'Camera' to Allow.",
      "Refresh this page and try again.",
    ],
    other: [
      "Open your browser settings / preferences.",
      "Find Privacy / Permissions / Camera settings.",
      "Allow camera access for this website.",
      "Refresh this page and try again.",
    ],
  };

  return (
    <div className="mx-auto max-w-sm text-left">
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="size-5 shrink-0 text-destructive" />
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
          Camera Access Blocked
        </h3>
      </div>
      <p className="mb-4 font-mono text-[11px] leading-relaxed text-primary/70">
        We need your permission to use the camera. Your browser or device is currently blocking access.
      </p>
      <ol className="mb-4 list-decimal space-y-1.5 pl-4 font-mono text-[11px] leading-relaxed text-primary/80">
        {(steps[browser] || steps.other).map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div className="flex items-center gap-1.5 rounded border border-primary/20 bg-primary/5 p-2 font-mono text-[10px] text-primary/50">
        Also check: Settings → Privacy → Camera (on iPhone / Android)
      </div>
    </div>
  );
}

function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  async function startCamera() {
    setStatus("starting");
    setErrorMsg(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMsg("Camera API not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
        setStatus("ready");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not access camera.";
      const permissionDenied =
        msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied");
      setStatus(permissionDenied ? "denied" : "error");
      setErrorMsg(
        permissionDenied
          ? "Camera permission denied. Allow access in your browser settings and retry."
          : msg.includes("NotFound")
          ? "No camera found on this device."
          : msg,
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }

  function switchFacing() {
    stopCamera();
    setFacing((f) => (f === "user" ? "environment" : "user"));
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setCapturedUrl(canvas.toDataURL("image/jpeg", 0.92));
  }

  function retake() {
    setCapturedUrl(null);
  }

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const isReady = status === "ready";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <header className="border-b border-primary/15 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// CAMERA_DIAGNOSTIC</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Test your camera.</h1>
          <p className="mt-2 max-w-lg font-mono text-sm text-foreground/60">
            Make sure your camera is working before you start designing. If you see yourself, you are good to go.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Preview */}
        <div className="metal-panel rounded p-4">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">
            <span>LIVE_PREVIEW</span>
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${isReady ? "animate-blink bg-primary" : "bg-primary/30"}`} />
              {isReady ? "Signal OK" : status === "starting" ? "Connecting…" : "No Signal"}
            </span>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-lg overflow-hidden rounded bg-black">
            {status === "denied" || status === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                {status === "denied" ? (
                  <PermissionHelp />
                ) : (
                  <div className="mx-auto max-w-sm">
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <AlertCircle className="size-5 text-destructive" />
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
                        Camera Error
                      </h3>
                    </div>
                    <p className="font-mono text-xs text-destructive/80">{errorMsg}</p>
                  </div>
                )}
                <button
                  onClick={startCamera}
                  className="mt-5 inline-flex items-center gap-2 rounded border border-primary/40 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10"
                >
                  <RefreshCw className="size-3.5" />
                  Try Again
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="size-full object-cover"
              />
            )}
            {status === "starting" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <div className="text-center">
                  <Camera className="mx-auto mb-3 size-8 animate-pulse text-primary/60" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
                    Starting camera…
                  </p>
                </div>
              </div>
            )}
            {status === "idle" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60">
                <div className="text-center">
                  <Camera className="mx-auto mb-3 size-8 text-primary/40" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/40">
                    Camera is off
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={switchFacing}
              disabled={status === "starting" || status === "idle" || !!capturedUrl}
              className="rounded border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10 disabled:opacity-30"
            >
              Switch ({facing === "user" ? "Front" : "Back"})
            </button>

            <div className="flex items-center gap-2">
              {isReady && !capturedUrl && (
                <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Camera works
                </div>
              )}
              <Link to="/studio">
                <NeonButton size="md" glow disabled={!isReady}>
                  <span className="flex items-center gap-2">
                    Start Designing
                    <ArrowRight className="size-3.5" />
                  </span>
                </NeonButton>
              </Link>
            </div>
          </div>

          {/* Capture button */}
          {isReady && !capturedUrl && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={capture}
                className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-mono text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_16px_currentColor] transition-transform active:scale-95 hover:brightness-110"
              >
                <Camera className="size-5" />
                Capture
              </button>
            </div>
          )}

          {/* Captured photo confirmation */}
          {capturedUrl && (
            <div className="mt-5 rounded border border-primary/20 bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  Snapshot captured
                </div>
                <button
                  onClick={retake}
                  className="inline-flex items-center gap-1.5 rounded border border-primary/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10"
                >
                  <RotateCcw className="size-3" />
                  Retake
                </button>
              </div>
              <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded bg-black">
                <img
                  src={capturedUrl}
                  alt="Captured snapshot"
                  className="size-full object-cover"
                />
              </div>
              <div className="mt-4 flex justify-center">
                <Link to="/studio">
                  <NeonButton size="md" glow>
                    <span className="flex items-center gap-2">
                      Looks Good — Start Designing
                      <ArrowRight className="size-3.5" />
                    </span>
                  </NeonButton>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { title: "HTTPS Required", desc: "Camera access only works on secure connections." },
            { title: "Grant Permission", desc: "Allow when your browser asks for camera access." },
            { title: "Phone or Laptop", desc: "Front camera, back camera, or built-in webcam all work." },
          ].map((tip) => (
            <div key={tip.title} className="rounded border border-primary/10 bg-muted/30 p-4">
              <h4 className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                {tip.title}
              </h4>
              <p className="font-mono text-[11px] leading-relaxed text-foreground/60">{tip.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
