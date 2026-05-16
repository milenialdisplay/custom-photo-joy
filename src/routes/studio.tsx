import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { FRAMES, OUTPUT_PRESETS, type FrameId, type OutputPresetId } from "@/lib/frames";
import { useRectController, type Rect } from "@/components/studio/useDraggable";
import { exportJPEG, downloadBlob, type ExportState } from "@/lib/studio-export";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Frame Studio — d'poto" },
      { name: "description", content: "Layered photo editor: drop a photo, pick a frame, drag your logo and caption, and export print-ready files." },
      { property: "og:title", content: "Frame Studio — d'poto" },
      { property: "og:description", content: "Compose, frame, and export at print resolution." },
    ],
  }),
  component: StudioPage,
});

const DEFAULT_LOGO: Rect = { x: 0.04, y: 0.04, w: 0.18, h: 0.1 };
const DEFAULT_CAPTION: Rect = { x: 0.1, y: 0.82, w: 0.8, h: 0.1 };

function StudioPage() {
  // photo / frame
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [frameId, setFrameId] = useState<FrameId>("neon-bezel");
  const [frameHue, setFrameHue] = useState(0);

  // logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoRect, setLogoRect] = useState<Rect>(DEFAULT_LOGO);
  const [logoOpacity, setLogoOpacity] = useState(1);

  // caption + bg box
  const [caption, setCaption] = useState("");
  const [captionFont, setCaptionFont] = useState("Space Grotesk");
  const [captionSize, setCaptionSize] = useState(0.045);
  const [captionColor, setCaptionColor] = useState("#F0F0FF");
  const [captionRect, setCaptionRect] = useState<Rect>(DEFAULT_CAPTION);
  const [captionBg, setCaptionBg] = useState("#0A0A0F");
  const [captionBgOpacity, setCaptionBgOpacity] = useState(0.6);

  // export
  const [presetId, setPresetId] = useState<OutputPresetId>("portrait-1080");
  const [trial, setTrial] = useState(true);
  const [exporting, setExporting] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);

  const preset = useMemo(
    () => OUTPUT_PRESETS.find((p) => p.id === presetId) ?? OUTPUT_PRESETS[0],
    [presetId],
  );
  const stageAspect = preset.w / preset.h;

  const exportState: ExportState = {
    photoUrl,
    frameId,
    frameHue,
    logoUrl,
    logoRect,
    logoOpacity,
    caption,
    captionFont,
    captionSize,
    captionColor,
    captionRect,
    captionBg,
    captionBgOpacity,
    trial,
  };

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [photoUrl, logoUrl]);

  const onPickPhoto = (f: File | null) => {
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(f));
  };
  const onPickLogo = (f: File | null) => {
    if (!f) return;
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(URL.createObjectURL(f));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportJPEG(exportState, preset.w, preset.h);
      downloadBlob(blob, `dpoto-${preset.id}-${Date.now()}.jpg`);
    } finally {
      setExporting(false);
    }
  };

  const frameSvg = useMemo(() => {
    const f = FRAMES.find((x) => x.id === frameId);
    if (!f || f.id === "none") return "";
    return f.render(1000, 1000 / stageAspect, frameHue);
  }, [frameId, frameHue, stageAspect]);

  const logoCtl = useRectController(stageRef, logoRect, setLogoRect);
  const capCtl = useRectController(stageRef, captionRect, setCaptionRect);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <header className="border-b border-primary/15 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// 02_FRAME_STUDIO</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Compose, frame, export.</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        {/* PREVIEW */}
        <div>
          <div className="metal-panel rounded p-4">
            <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">
              <span>LIVE_PREVIEW · {preset.label}</span>
              <span className="flex items-center gap-2">
                <span className="size-1.5 animate-blink rounded-full bg-primary" />
                {preset.w}×{preset.h}
              </span>
            </div>
            <div className="relative mx-auto w-full" style={{ maxWidth: stageAspect >= 1 ? "100%" : `${stageAspect * 70}vh` }}>
              <div
                ref={stageRef}
                className="relative w-full overflow-hidden bg-card scanlines select-none"
                style={{ aspectRatio: `${preset.w} / ${preset.h}` }}
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-muted/40">
                    <label className="cursor-pointer rounded border border-dashed border-primary/40 px-6 py-4 text-center font-mono text-xs text-primary/70 hover:bg-primary/5">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                      />
                      drop photo · or click
                    </label>
                  </div>
                )}

                {frameSvg && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    aria-hidden
                    dangerouslySetInnerHTML={{
                      __html: frameSvg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%" preserveAspectRatio="none"'),
                    }}
                  />
                )}

                {/* caption bg + text */}
                {caption.trim() && (
                  <DraggableBox rect={captionRect} ctl={capCtl} accent>
                    <div
                      className="absolute inset-0 flex items-center justify-center text-center"
                      style={{
                        background: captionBg,
                        opacity: captionBgOpacity,
                      }}
                    />
                    <div
                      className="relative flex size-full items-center justify-center px-2 text-center"
                      style={{
                        color: captionColor,
                        fontFamily: `${captionFont}, sans-serif`,
                        fontWeight: 700,
                        fontSize: `calc(${captionSize} * 100cqw)`,
                        lineHeight: 1.05,
                      }}
                    >
                      {caption}
                    </div>
                  </DraggableBox>
                )}

                {/* logo */}
                {logoUrl && (
                  <DraggableBox rect={logoRect} ctl={logoCtl}>
                    <img
                      src={logoUrl}
                      alt=""
                      draggable={false}
                      style={{ opacity: logoOpacity }}
                      className="pointer-events-none absolute inset-0 size-full object-contain"
                    />
                  </DraggableBox>
                )}

                {/* trial watermark preview band */}
                {trial && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[4.5%] items-center justify-center bg-background/85 font-mono text-[8px] tracking-[0.3em] text-primary">
                    D'POTO.COM — TRIAL
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
              <span>drag elements · corner = resize</span>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded border border-primary/30 px-3 py-1.5 text-primary/80 hover:bg-primary/10">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)} />
                  Swap_Photo
                </label>
                <button
                  className="rounded border border-primary/30 px-3 py-1.5 text-primary/80 hover:bg-primary/10"
                  onClick={() => {
                    setLogoRect(DEFAULT_LOGO);
                    setCaptionRect(DEFAULT_CAPTION);
                  }}
                >
                  Reset_Layout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <aside className="space-y-5">
          <Panel title="01 · Frame">
            <div className="grid grid-cols-3 gap-2">
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFrameId(f.id)}
                  className={`group relative aspect-square overflow-hidden rounded border text-[9px] font-mono uppercase tracking-wider transition-all ${
                    frameId === f.id
                      ? "border-primary neon-glow"
                      : "border-primary/15 hover:border-primary/40"
                  }`}
                  title={f.name}
                >
                  <div
                    className="absolute inset-0 bg-muted"
                    dangerouslySetInnerHTML={{
                      __html: f.render(120, 120, frameHue).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"'),
                    }}
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5 text-primary/80">{f.tag}</span>
                </button>
              ))}
            </div>
            <Slider label={`Hue ${frameHue}°`} min={0} max={360} value={frameHue} onChange={setFrameHue} />
          </Panel>

          <Panel title="02 · Logo">
            <label className="block cursor-pointer rounded border border-dashed border-primary/30 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70 hover:bg-primary/5">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)} />
              {logoUrl ? "Replace_Logo" : "Upload_Logo"}
            </label>
            {logoUrl && (
              <>
                <Slider label={`Opacity ${(logoOpacity * 100).toFixed(0)}%`} min={0} max={100} value={logoOpacity * 100} onChange={(v) => setLogoOpacity(v / 100)} />
                <button onClick={() => setLogoUrl(null)} className="font-mono text-[10px] uppercase tracking-[0.2em] text-destructive/80 hover:text-destructive">
                  remove_logo
                </button>
              </>
            )}
          </Panel>

          <Panel title="03 · Caption">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="// type your caption"
              className="w-full rounded border border-primary/20 bg-background px-3 py-2 font-mono text-sm placeholder:text-primary/30 focus:border-primary focus:outline-none"
            />
            {caption && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={captionFont}
                    onChange={(e) => setCaptionFont(e.target.value)}
                    className="rounded border border-primary/20 bg-background px-2 py-1.5 font-mono text-[11px]"
                  >
                    {["Space Grotesk", "JetBrains Mono", "Georgia", "Impact", "Courier New"].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <input
                    type="color"
                    value={captionColor}
                    onChange={(e) => setCaptionColor(e.target.value)}
                    className="h-full w-full cursor-pointer rounded border border-primary/20 bg-background"
                  />
                </div>
                <Slider label={`Size ${(captionSize * 100).toFixed(1)}%`} min={1} max={15} step={0.1} value={captionSize * 100} onChange={(v) => setCaptionSize(v / 100)} />
                <div className="space-y-2 rounded border border-primary/15 p-2">
                  <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary/60">caption_background</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={captionBg}
                      onChange={(e) => setCaptionBg(e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border border-primary/20 bg-background"
                    />
                    <span className="font-mono text-[10px] text-primary/60">drag box on preview</span>
                  </div>
                  <Slider label={`Fill ${(captionBgOpacity * 100).toFixed(0)}%`} min={0} max={100} value={captionBgOpacity * 100} onChange={(v) => setCaptionBgOpacity(v / 100)} />
                </div>
              </>
            )}
          </Panel>

          <Panel title="04 · Export">
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value as OutputPresetId)}
              className="w-full rounded border border-primary/20 bg-background px-2 py-2 font-mono text-[11px]"
            >
              <optgroup label="Web">
                {OUTPUT_PRESETS.filter((p) => p.kind === "web").map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Print @300dpi">
                {OUTPUT_PRESETS.filter((p) => p.kind === "print").map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            </select>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-primary/80">
              <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
              trial_watermark
            </label>
            <NeonButton
              size="lg"
              glow
              onClick={handleExport}
              disabled={exporting || !photoUrl}
              className="w-full"
            >
              {exporting ? "Rendering…" : "Export_JPEG"}
            </NeonButton>
            {!photoUrl && <p className="font-mono text-[10px] text-primary/40">// upload a photo first</p>}
          </Panel>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded border border-primary/15 bg-card/40 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">{title}</div>
      {children}
    </section>
  );
}

function Slider({
  label, min, max, step = 1, value, onChange,
}: {
  label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </label>
  );
}

function DraggableBox({
  rect, ctl, accent, children,
}: {
  rect: Rect;
  ctl: ReturnType<typeof useRectController>;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute touch-none border ${accent ? "border-secondary/60" : "border-primary/60"} border-dashed`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        containerType: "inline-size",
      }}
      onPointerDown={ctl.onPointerDown("move")}
      onPointerMove={ctl.onPointerMove}
      onPointerUp={ctl.onPointerUp}
    >
      {children}
      <span
        onPointerDown={ctl.onPointerDown("resize")}
        onPointerMove={ctl.onPointerMove}
        onPointerUp={ctl.onPointerUp}
        className={`absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize ${accent ? "bg-secondary" : "bg-primary"} shadow-[0_0_8px_currentColor]`}
      />
    </div>
  );
}
