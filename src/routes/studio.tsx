import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NeonButton } from "@/components/site/NeonButton";
import { BrandLogo } from "@/components/site/BrandLogo";
import {
  PRESET_FRAMES,
  RATIOS,
  OUTPUT_PRESETS,
  snapToRatio,
  type Frame,
  type Ratio,
  type OutputPresetId,
} from "@/lib/frames";
import { PATTERNS } from "@/lib/patterns";
import { getLayout, type SlotCount } from "@/lib/layouts";
import { useRectController, type Rect } from "@/components/studio/useDraggable";
import { exportJPEG, downloadBlob, type ExportState, type SlotState } from "@/lib/studio-export";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Frame Studio — dpotopoto.com" },
      { name: "description", content: "Pick a ratio, drop photos into draggable slots, tint a frame, overlay a pattern, and export print-ready JPEG." },
      { property: "og:title", content: "Frame Studio — dpotopoto.com" },
      { property: "og:description", content: "Compose, frame, and export at print resolution." },
    ],
  }),
  component: StudioPage,
});

const DEFAULT_LOGO: Rect = { x: 0.04, y: 0.04, w: 0.18, h: 0.1 };
const DEFAULT_CAPTION: Rect = { x: 0.1, y: 0.82, w: 0.8, h: 0.1 };

const PATTERN_LOOKUP = (id: string) => PATTERNS.find((p) => p.id === id)?.src;

function StudioPage() {
  const [activeMobilePanel, setActiveMobilePanel] = useState<"layout" | "frame" | "pattern" | "logo" | "caption" | "export">("layout");
  // ratio + layout
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [slotCount, setSlotCount] = useState<SlotCount>(1);
  const [slots, setSlots] = useState<SlotState[]>(() =>
    getLayout("1:1", 1).map((rect) => ({ rect, photoUrl: null })),
  );

  // frame
  const [customFrame, setCustomFrame] = useState<Frame | null>(null);
  const [frameId, setFrameId] = useState<string>("white-1x1");
  const [frameHue, setFrameHue] = useState(0);
  const [frameSat, setFrameSat] = useState(0);

  // pattern
  const [patternId, setPatternId] = useState<string | null>(null);
  const [patternOpacity, setPatternOpacity] = useState(0.6);
  const [patternTile, setPatternTile] = useState(false);

  // logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoRect, setLogoRect] = useState<Rect>(DEFAULT_LOGO);
  const [logoOpacity, setLogoOpacity] = useState(1);

  // caption
  const [caption, setCaption] = useState("");
  const [captionFont, setCaptionFont] = useState("Space Grotesk");
  const [captionSize, setCaptionSize] = useState(0.045);
  const [captionColor, setCaptionColor] = useState("#F0F0FF");
  const [captionRect, setCaptionRect] = useState<Rect>(DEFAULT_CAPTION);
  const [captionBg, setCaptionBg] = useState("#0A0A0F");
  const [captionBgOpacity, setCaptionBgOpacity] = useState(0.6);

  // export
  const [presetId, setPresetId] = useState<OutputPresetId>("web-1x1");
  const [trial, setTrial] = useState(true);
  const [exporting, setExporting] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);

  // when user changes ratio, snap output preset + frame to a matching one
  useEffect(() => {
    const match = OUTPUT_PRESETS.find((p) => p.ratio === ratio);
    if (match) setPresetId(match.id as OutputPresetId);
    const preset = PRESET_FRAMES.find((f) => f.ratio === ratio);
    if (preset && (!frameId || PRESET_FRAMES.find((f) => f.id === frameId)?.ratio !== ratio)) {
      if (customFrame?.ratio !== ratio) setFrameId(preset.id);
    }
    // rebuild slot layout for new ratio + current count
    setSlots((prev) =>
      getLayout(ratio, slotCount).map((rect, i) => ({
        rect,
        photoUrl: prev[i]?.photoUrl ?? null,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  // when slot count changes, rebuild but preserve photos in order
  useEffect(() => {
    setSlots((prev) =>
      getLayout(ratio, slotCount).map((rect, i) => ({
        rect,
        photoUrl: prev[i]?.photoUrl ?? null,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotCount]);

  const preset = useMemo(
    () => OUTPUT_PRESETS.find((p) => p.id === presetId) ?? OUTPUT_PRESETS[0],
    [presetId],
  );
  const stageAspect = preset.w / preset.h;

  // min slot size = 350 canvas px → normalized
  const minSlotW = 350 / preset.w;
  const minSlotH = 350 / preset.h;

  useEffect(() => {
    return () => {
      slots.forEach((s) => s.photoUrl && URL.revokeObjectURL(s.photoUrl));
      if (logoUrl) URL.revokeObjectURL(logoUrl);
      if (customFrame?.kind === "custom") URL.revokeObjectURL(customFrame.src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSlotPhoto = (idx: number, file: File | null) => {
    if (!file) return;
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (s.photoUrl) URL.revokeObjectURL(s.photoUrl);
        return { ...s, photoUrl: URL.createObjectURL(file) };
      }),
    );
  };
  const setSlotRect = (idx: number, rect: Rect) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, rect } : s)));
  const clearSlotPhoto = (idx: number) =>
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (s.photoUrl) URL.revokeObjectURL(s.photoUrl);
        return { ...s, photoUrl: null };
      }),
    );

  const onPickLogo = (f: File | null) => {
    if (!f) return;
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(URL.createObjectURL(f));
  };

  const onPickCustomFrame = (f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const snapped = snapToRatio(img.width, img.height);
      const cf: Frame = {
        id: `custom-${Date.now()}`,
        name: `Custom ${snapped}`,
        src: url,
        ratio: snapped,
        kind: "custom",
      };
      if (customFrame?.kind === "custom") URL.revokeObjectURL(customFrame.src);
      setCustomFrame(cf);
      setFrameId(cf.id);
      setRatio(snapped);
    };
    img.src = url;
  };

  const resetLayout = () => {
    setSlots((prev) =>
      getLayout(ratio, slotCount).map((rect, i) => ({
        rect,
        photoUrl: prev[i]?.photoUrl ?? null,
      })),
    );
  };

  const exportState: ExportState = {
    frameId,
    customFrame,
    frameHue,
    frameSat,
    patternId,
    patternOpacity,
    patternTile,
    slots,
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportJPEG(exportState, preset.w, preset.h, PATTERN_LOOKUP);
      downloadBlob(blob, `dpotopoto-${preset.id}-${Date.now()}.jpg`);
    } finally {
      setExporting(false);
    }
  };

  const activeFrame: Frame | null =
    customFrame?.id === frameId ? customFrame : PRESET_FRAMES.find((f) => f.id === frameId) ?? null;
  const tintCss =
    frameSat > 0 ? `hsl(${frameHue}, ${frameSat}%, 50%)` : "transparent";
  const patternSrc = patternId ? PATTERN_LOOKUP(patternId) : undefined;

  const logoCtl = useRectController(stageRef, logoRect, setLogoRect, { snap: 0.008 });
  const capCtl = useRectController(stageRef, captionRect, setCaptionRect, { snap: 0.008 });

  const framesForRatio = useMemo(
    () => [...PRESET_FRAMES.filter((f) => f.ratio === ratio), ...(customFrame && customFrame.ratio === ratio ? [customFrame] : [])],
    [ratio, customFrame],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <header className="border-b border-primary/15 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// 02_FRAME_STUDIO</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Compose, frame, export.</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]">
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
                className="relative w-full overflow-hidden bg-white scanlines select-none"
                style={{ aspectRatio: `${preset.w} / ${preset.h}` }}
              >
                {/* Frame */}
                {activeFrame && (
                  <>
                    <img src={activeFrame.src} alt="" className="pointer-events-none absolute inset-0 size-full" draggable={false} />
                    {frameSat > 0 && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: tintCss,
                          mixBlendMode: "multiply",
                        }}
                      />
                    )}
                  </>
                )}

                {/* Pattern overlay */}
                {patternSrc && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      opacity: patternOpacity,
                      backgroundImage: `url(${patternSrc})`,
                      backgroundSize: patternTile ? "auto" : "100% 100%",
                      backgroundRepeat: patternTile ? "repeat" : "no-repeat",
                    }}
                  />
                )}

                {/* Photo slots (on top of pattern) */}
                {slots.map((slot, i) => (
                  <PhotoSlot
                    key={i}
                    index={i}
                    slot={slot}
                    stageRef={stageRef}
                    minW={minSlotW}
                    minH={minSlotH}
                    onRectChange={(r) => setSlotRect(i, r)}
                    onPick={(f) => setSlotPhoto(i, f)}
                    onClear={() => clearSlotPhoto(i)}
                  />
                ))}

                {/* caption */}
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

                {/* trial watermark band */}
                {trial && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[4.5%] items-center justify-center bg-background/85 font-mono text-[8px] tracking-[0.3em] text-primary">
                    DPOTOPOTO.COM — TRIAL
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
              <span>drag slots · corner = resize · click slot to upload</span>
              <button
                onClick={resetLayout}
                className="rounded border border-primary/30 px-3 py-1.5 text-primary/80 hover:bg-primary/10"
              >
                Reset_Layout
              </button>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <aside className="space-y-5">
          <Panel title="01 · Ratio & Layout">
            <div className="grid grid-cols-3 gap-2">
              {RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRatio(r.id)}
                  className={`rounded border px-2 py-3 font-mono text-[10px] uppercase tracking-wider transition-all ${
                    ratio === r.id ? "border-primary bg-primary/10 text-primary neon-glow" : "border-primary/15 text-primary/60 hover:border-primary/40"
                  }`}
                >
                  {r.id}
                  <div className="mt-0.5 text-[8px] text-primary/50">{r.label}</div>
                </button>
              ))}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary/50">photos</div>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as SlotCount[]).map((n) => (
                <button
                  key={n}
                  onClick={() => setSlotCount(n)}
                  className={`rounded border py-2 font-mono text-xs transition-all ${
                    slotCount === n ? "border-primary bg-primary/10 text-primary" : "border-primary/15 text-primary/60 hover:border-primary/40"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="02 · Frame">
            <div className="grid grid-cols-3 gap-2">
              {framesForRatio.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFrameId(f.id)}
                  className={`group relative overflow-hidden rounded border text-[9px] font-mono uppercase tracking-wider transition-all ${
                    frameId === f.id ? "border-primary neon-glow" : "border-primary/15 hover:border-primary/40"
                  }`}
                  style={{ aspectRatio: `${f.ratio.split(":")[0]} / ${f.ratio.split(":")[1]}` }}
                  title={f.name}
                >
                  <img src={f.src} alt={f.name} className="absolute inset-0 size-full bg-muted object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5 text-primary/80 truncate">
                    {f.kind === "custom" ? "CUSTOM" : f.ratio}
                  </span>
                </button>
              ))}
            </div>
            <Slider label={`Hue ${frameHue}°`} min={0} max={360} value={frameHue} onChange={setFrameHue} />
            <Slider label={`Saturation ${frameSat}%`} min={0} max={100} value={frameSat} onChange={setFrameSat} />
            <label className="block cursor-pointer rounded border border-dashed border-primary/30 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70 hover:bg-primary/5">
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => onPickCustomFrame(e.target.files?.[0] ?? null)} />
              Upload_Custom_Frame
            </label>
          </Panel>

          <Panel title="03 · Pattern">
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setPatternId(null)}
                className={`aspect-square rounded border font-mono text-[9px] uppercase tracking-wider transition-all ${
                  patternId === null ? "border-primary bg-primary/10 text-primary" : "border-primary/15 text-primary/50 hover:border-primary/40"
                }`}
              >
                None
              </button>
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatternId(p.id)}
                  className={`relative aspect-square overflow-hidden rounded border transition-all ${
                    patternId === p.id ? "border-primary neon-glow" : "border-primary/15 hover:border-primary/40"
                  }`}
                  title={p.name}
                >
                  <img src={p.src} alt={p.name} className="absolute inset-0 size-full object-cover" />
                </button>
              ))}
            </div>
            {patternId && (
              <>
                <Slider label={`Opacity ${(patternOpacity * 100).toFixed(0)}%`} min={0} max={100} value={patternOpacity * 100} onChange={(v) => setPatternOpacity(v / 100)} />
                <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
                  <input type="checkbox" checked={patternTile} onChange={(e) => setPatternTile(e.target.checked)} />
                  tile_repeat
                </label>
              </>
            )}
          </Panel>

          <Panel title="04 · Logo">
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

          <Panel title="05 · Caption">
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

          <Panel title="06 · Export">
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
              disabled={exporting || slots.every((s) => !s.photoUrl)}
              className="w-full"
            >
              {exporting ? "Rendering…" : "Export_JPEG"}
            </NeonButton>
            {slots.every((s) => !s.photoUrl) && (
              <p className="font-mono text-[10px] text-primary/40">// upload at least one photo</p>
            )}
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

function PhotoSlot({
  index, slot, stageRef, minW, minH, onRectChange, onPick, onClear,
}: {
  index: number;
  slot: SlotState;
  stageRef: React.RefObject<HTMLDivElement | null>;
  minW: number;
  minH: number;
  onRectChange: (r: Rect) => void;
  onPick: (f: File | null) => void;
  onClear: () => void;
}) {
  const ctl = useRectController(stageRef, slot.rect, onRectChange, { minW, minH, snap: 0.008 });
  const edgeHandle = (edge: "n" | "s" | "e" | "w", cls: string, label: string) => (
    <span
      onPointerDown={ctl.onPointerDown(edge)}
      onPointerMove={ctl.onPointerMove}
      onPointerUp={ctl.onPointerUp}
      className={`absolute z-10 flex items-center justify-center bg-primary/80 font-mono text-[8px] font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_6px_currentColor] hover:bg-primary ${cls}`}
    >
      {label}
    </span>
  );
  return (
    <div
      className="absolute touch-none border-2 border-dashed border-primary/70"
      style={{
        left: `${slot.rect.x * 100}%`,
        top: `${slot.rect.y * 100}%`,
        width: `${slot.rect.w * 100}%`,
        height: `${slot.rect.h * 100}%`,
      }}
      onPointerDown={ctl.onPointerDown("move")}
      onPointerMove={ctl.onPointerMove}
      onPointerUp={ctl.onPointerUp}
    >
      {slot.photoUrl ? (
        <>
          <img src={slot.photoUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-cover" />
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-1 right-1 z-20 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            ×
          </button>
        </>
      ) : (
        <label
          className="absolute inset-0 grid cursor-pointer place-items-center bg-card/40 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60 hover:bg-primary/5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
          <span className="text-center leading-tight">
            + photo {index + 1}
            <br />
            <span className="text-[8px] text-primary/40">drag center · drag edges to resize</span>
          </span>
        </label>
      )}
      <span className="absolute top-1 left-1 z-20 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[9px] text-primary/80">
        {index + 1}
      </span>

      {/* edge resize handles with visible DRAG labels */}
      {edgeHandle("n", "left-1/2 -translate-x-1/2 -top-2.5 h-5 px-2 cursor-ns-resize rounded-sm", "↕ DRAG")}
      {edgeHandle("s", "left-1/2 -translate-x-1/2 -bottom-2.5 h-5 px-2 cursor-ns-resize rounded-sm", "↕ DRAG")}
      {edgeHandle("w", "top-1/2 -translate-y-1/2 -left-2.5 w-5 py-2 cursor-ew-resize rounded-sm [writing-mode:vertical-rl]", "↔ DRAG")}
      {edgeHandle("e", "top-1/2 -translate-y-1/2 -right-2.5 w-5 py-2 cursor-ew-resize rounded-sm [writing-mode:vertical-rl]", "↔ DRAG")}

      {/* corner resize */}
      <span
        onPointerDown={ctl.onPointerDown("se")}
        onPointerMove={ctl.onPointerMove}
        onPointerUp={ctl.onPointerUp}
        className="absolute z-10 -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize rounded-sm bg-primary shadow-[0_0_8px_currentColor]"
      />
    </div>
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
        onPointerDown={ctl.onPointerDown("se")}
        onPointerMove={ctl.onPointerMove}
        onPointerUp={ctl.onPointerUp}
        className={`absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize ${accent ? "bg-secondary" : "bg-primary"} shadow-[0_0_8px_currentColor]`}
      />
    </div>
  );
}
