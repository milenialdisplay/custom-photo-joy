import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";
import { NeonButton } from "@/components/site/NeonButton";

interface Props {
  label: string;
  url: string;
  filename?: string;
}

export function EventQR({ label, url, filename }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  function download() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = filename ?? `${label.replace(/\s+/g, "-")}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="border border-primary/20 bg-background/40 p-4 text-center">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">{label}</div>
      <div ref={wrapRef} className="mx-auto inline-block bg-white p-3">
        <QRCodeCanvas value={url} size={180} includeMargin={false} />
      </div>
      <div className="mt-2 break-all font-mono text-[10px] text-foreground/50">{url}</div>
      <div className="mt-3">
        <NeonButton size="md" variant="ghost" onClick={download}>
          Download PNG
        </NeonButton>
      </div>
    </div>
  );
}
