import { useEffect, useRef, useState } from "react";

type FacingMode = "user" | "environment";

export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera API not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
          setReady(true);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not access camera.";
        setError(
          msg.includes("Permission") || msg.includes("NotAllowed")
            ? "Camera permission denied. Allow access in your browser settings and retry."
            : msg.includes("NotFound")
            ? "No camera found on this device."
            : msg,
        );
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [open, facing]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur">
      <div className="relative w-full max-w-2xl rounded-lg border border-primary/40 bg-card p-4 shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-primary">Live Camera</h2>
          <button
            onClick={onClose}
            className="rounded border border-primary/40 px-2 py-1 font-mono text-[10px] uppercase text-primary/80 hover:bg-primary/10"
          >
            Close ×
          </button>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded bg-black">
          {error ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="font-mono text-xs text-destructive">{error}</p>
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
          {!ready && !error && (
            <div className="absolute inset-0 grid place-items-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
                Starting camera…
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="rounded border border-primary/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            Switch ({facing === "user" ? "Front" : "Back"})
          </button>
          <button
            onClick={capture}
            disabled={!ready || !!error}
            className="rounded bg-primary px-6 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_12px_currentColor] disabled:opacity-40"
          >
            ● Capture
          </button>
        </div>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-primary/40">
          Tip: requires HTTPS · grant camera permission when prompted
        </p>
      </div>
    </div>
  );
}
