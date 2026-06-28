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
import { CameraCapture } from "@/components/studio/CameraCapture";
import { consumePendingCapture, dataUrlToFile } from "@/lib/pending-capture";
import { toast } from "sonner";

export const Route = createFileRoute("/frame")({
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
const DEFAULT_CAPTION_RECT: Rect = { x: 0.1, y: 0.82, w: 0.8, h: 0.08 };
const DEFAULT_CAPTION_BG: Rect = { x: 0.1, y: 0.82, w: 0.8, h: 0.08 };
const MAX_CAPTIONS = 3;

export type Caption = {
  id: string;
  text: string;
  font: string;
  color: string;
  sizePx: number; // px on export canvas
  rect: Rect;
  bgColor: string;
  bgOpacity: number;
  bgRect: Rect;
};

const makeCaption = (overrides: Partial<Caption> = {}): Caption => ({
  id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  text: "",
  font: "Space Grotesk",
  color: "#F0F0FF",
  sizePx: 64,
  rect: { ...DEFAULT_CAPTION_RECT },
  bgColor: "#0A0A0F",
  bgOpacity: 0.6,
  bgRect: { ...DEFAULT_CAPTION_BG },
  ...overrides,
});

const PATTERN_LOOKUP = (id: string) => PATTERNS.find((p) => p.id === id)?.src;

function StudioPage() {
  const [activePanel, setActivePanel] = useState<"layout" | "frame" | "pattern" | "logo" | "caption" | "export">("layout");
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
  const [customFrameOpacity, setCustomFrameOpacity] = useState(1);

  // pattern
  const [patternId, setPatternId] = useState<string | null>(null);
  const [patternOpacity, setPatternOpacity] = useState(0.6);
  const [patternTile, setPatternTile] = useState(false);

  // logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoRect, setLogoRect] = useState<Rect>(DEFAULT_LOGO);
  const [logoOpacity, setLogoOpacity] = useState(1);

  // caption (array of up to 3)
  const [captions, setCaptions] = useState<Caption[]>(() => [makeCaption()]);
  const updateCaption = (id: string, patch: Partial<Caption>) =>
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCaption = (id: string) =>
    setCaptions((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
  const addCaption = () =>
    setCaptions((prev) => {
      if (prev.length >= MAX_CAPTIONS) return prev;
      // place new caption above existing ones
      const topY = prev.reduce((min, c) => Math.min(min, c.rect.y, c.bgRect.y), 1);
      const newY = Math.max(0.02, topY - 0.1);
      const cap = makeCaption({
        rect: { x: 0.1, y: newY, w: 0.8, h: 0.08 },
        bgRect: { x: 0.1, y: newY, w: 0.8, h: 0.08 },
      });
      return [cap, ...prev];
    });

  // preview mode (hide editing affordances)
  const [previewMode, setPreviewMode] = useState(false);

  // export
  const [presetId, setPresetId] = useState<OutputPresetId>("web-1x1");
  const [trial, setTrial] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [cameraSlot, setCameraSlot] = useState<number | null>(null);

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

  // Consume a pending capture handed off from /snap → load into slot 0
  useEffect(() => {
    const pending = consumePendingCapture();
    if (!pending) return;
    let cancelled = false;
    dataUrlToFile(pending).then((file) => {
      if (cancelled) return;
      setSlots((prev) =>
        prev.map((s, i) => {
          if (i !== 0) return s;
          if (s.photoUrl) URL.revokeObjectURL(s.photoUrl);
          return { ...s, photoUrl: URL.createObjectURL(file) };
        }),
      );
      toast.success("Photo imported", {
        description: "Your captured snapshot is loaded into slot 0.",
      });
    });
    return () => {
      cancelled = true;
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
      setCustomFrameOpacity(1);
    };
    img.src = url;
  };

  const onRemoveCustomFrame = () => {
    if (customFrame?.kind === "custom") URL.revokeObjectURL(customFrame.src);
    setCustomFrame(null);
    const preset = PRESET_FRAMES.find((f) => f.ratio === ratio) ?? PRESET_FRAMES[0];
    setFrameId(preset.id);
    setCustomFrameOpacity(1);
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
    customFrameOpacity,
    patternId,
    patternOpacity,
    patternTile,
    slots,
    logoUrl,
    logoRect,
    logoOpacity,
    captions,
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
  

  const framesForRatio = useMemo(
    () => [...PRESET_FRAMES.filter((f) => f.ratio === ratio), ...(customFrame && customFrame.ratio === ratio ? [customFrame] : [])],
    [ratio, customFrame],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <header className="border-b border-primary/15 px-6 py-6">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// 02_FRAME_STUDIO</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Compose, frame, export.</h1>
          </div>
          
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-6 md:py-8 lg:grid-cols-[1fr_380px]">
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
                style={{ aspectRatio: `${preset.w} / ${preset.h}`, containerType: "inline-size" }}
              >
                {/* Frame */}
                {activeFrame && (
                  <>
                    <img
                      src={activeFrame.src}
                      alt=""
                      className="pointer-events-none absolute inset-0 size-full"
                      draggable={false}
                      style={activeFrame.kind === "custom" ? { opacity: customFrameOpacity } : undefined}
                    />
                    {frameSat > 0 && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: tintCss,
                          mixBlendMode: "multiply",
                          opacity: activeFrame.kind === "custom" ? customFrameOpacity : 1,
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
                    previewMode={previewMode}
                    onRectChange={(r) => setSlotRect(i, r)}
                    onPick={(f) => setSlotPhoto(i, f)}
                    onClear={() => clearSlotPhoto(i)}
                    onCamera={() => setCameraSlot(i)}
                  />
                ))}

                {/* captions */}
                {captions.map((cap) => (
                  <CaptionLayer
                    key={cap.id}
                    caption={cap}
                    stageRef={stageRef}
                    previewMode={previewMode}
                    onChange={(patch) => updateCaption(cap.id, patch)}
                    canvasW={preset.w}
                  />
                ))}

                {/* logo */}
                {logoUrl && (
                  <DraggableBox rect={logoRect} ctl={logoCtl} previewMode={previewMode}>
                    <img
                      src={logoUrl}
                      alt=""
                      draggable={false}
                      style={{ opacity: logoOpacity }}
                      className="pointer-events-none absolute inset-0 size-full object-contain"
                    />
                  </DraggableBox>
                )}

                {/* branding mark — tight black pill keeps wordmark legible over light frames */}
                <div className="pointer-events-none absolute bottom-[6px] left-[6px] z-10">
                  <span className="inline-flex items-center rounded-sm bg-black/90 px-2 py-1">
                    <BrandLogo variant="dark" className="text-[10px] md:text-xs" />
                  </span>
                </div>
              </div>
            </div>

            {/* Quick controls — directly below LIVE_PREVIEW */}
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/55">quick_controls</span>
                <button
                  onClick={() => setPreviewMode((v) => !v)}
                  className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-all ${
                    previewMode
                      ? "border-primary bg-primary/30 text-primary neon-glow"
                      : "border-primary/30 text-primary/70 hover:bg-primary/10"
                  }`}
                  title="Toggle clean preview (hide edit handles)"
                >
                  {previewMode ? "● preview" : "preview"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[
                  ["layout", "01 layout"],
                  ["frame", "02 frame"],
                  ["pattern", "03 pattern"],
                  ["logo", "04 logo"],
                  ["caption", "05 caption"],
                  ["export", "06 export"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActivePanel(key as typeof activePanel)}
                    className={`rounded border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.15em] transition-all ${
                      activePanel === key ? "border-primary bg-primary/10 text-primary neon-glow" : "border-primary/15 text-primary/55"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>



            {/* Frame strip — gated behind 02 FRAME button */}
            {activePanel === "frame" && (
              <FrameStrip
                frames={framesForRatio}
                activeFrameId={frameId}
                onPickFrame={setFrameId}
                onPickCustomFrame={onPickCustomFrame}
                onRemoveCustomFrame={onRemoveCustomFrame}
                hasCustom={!!customFrame && customFrame.ratio === ratio}
                isCustomActive={!!customFrame && customFrame.id === frameId}
                customOpacity={customFrameOpacity}
                onCustomOpacityChange={setCustomFrameOpacity}
                hue={frameHue}
                sat={frameSat}
                onPickTint={(h, s) => {
                  setFrameHue(h);
                  setFrameSat(s);
                }}
                onHueChange={setFrameHue}
                onSatChange={setFrameSat}
              />
            )}

          </div>
        </div>

        {/* CONTROLS */}
        <aside className="space-y-5">
          <Panel title="01 · Ratio & Layout" mobileActive={activePanel === "layout"}>
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


          <Panel title="03 · Pattern" mobileActive={activePanel === "pattern"}>
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

          <Panel title="04 · Logo" mobileActive={activePanel === "logo"}>
            <label className="block cursor-pointer rounded border border-dashed border-primary/30 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70 hover:bg-primary/5">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)} />
              Upload_Logo
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

          <Panel
            title="05 · Caption"
            mobileActive={activePanel === "caption"}
            headerRight={
              <button
                onClick={addCaption}
                disabled={captions.length >= MAX_CAPTIONS}
                className="rounded border border-primary/30 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-primary/80 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + add caption {captions.length}/{MAX_CAPTIONS}
              </button>
            }
          >
            {captions.map((cap, idx) => (
              <div key={cap.id} className="space-y-2 rounded border border-primary/15 bg-background/40 p-2">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.25em] text-primary/60">
                  <span>caption_{idx + 1}</span>
                  {captions.length > 1 && (
                    <button
                      onClick={() => removeCaption(cap.id)}
                      className="rounded px-1 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                      title="remove this caption"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Size slider — first, closest to LIVE_PREVIEW on mobile */}
                <Slider
                  label={`Size ${cap.sizePx}px`}
                  min={10}
                  max={350}
                  step={1}
                  value={cap.sizePx}
                  onChange={(v) => updateCaption(cap.id, { sizePx: v })}
                />
                {/* bg color + fill slider on one row */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cap.bgColor}
                    onChange={(e) => updateCaption(cap.id, { bgColor: e.target.value })}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded border border-primary/20 bg-background"
                    title="caption background"
                  />
                  <div className="flex-1">
                    <Slider
                      label={`Fill ${(cap.bgOpacity * 100).toFixed(0)}%`}
                      min={0}
                      max={100}
                      value={cap.bgOpacity * 100}
                      onChange={(v) => updateCaption(cap.id, { bgOpacity: v / 100 })}
                    />
                  </div>
                </div>
                {/* text input + font color (small square) */}
                <div className="flex items-center gap-2">
                  <input
                    value={cap.text}
                    onChange={(e) => updateCaption(cap.id, { text: e.target.value })}
                    placeholder="// type your caption"
                    className="flex-1 rounded border border-primary/20 bg-background px-2 py-1.5 font-mono text-sm placeholder:text-primary/30 focus:border-primary focus:outline-none"
                  />
                  <input
                    type="color"
                    value={cap.color}
                    onChange={(e) => updateCaption(cap.id, { color: e.target.value })}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-primary/20 bg-background"
                    title="font color"
                  />
                </div>
                {/* font select (narrower) */}
                <select
                  value={cap.font}
                  onChange={(e) => updateCaption(cap.id, { font: e.target.value })}
                  className="w-3/5 rounded border border-primary/20 bg-background px-2 py-1.5 font-mono text-[11px]"
                >
                  {["Space Grotesk", "JetBrains Mono", "Georgia", "Impact", "Courier New"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
            ))}
          </Panel>


          <Panel title="06 · Export" mobileActive={activePanel === "export"}>
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

      <div className="mx-auto max-w-7xl px-4 pb-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60">
          <span>drag slots · corner = resize · click slot to upload</span>
          <button
            onClick={resetLayout}
            className="rounded border border-primary/30 px-3 py-1.5 text-primary/80 hover:bg-primary/10"
          >
            Reset_Layout
          </button>
        </div>
      </div>

      <SiteFooter />

      <CameraCapture
        open={cameraSlot !== null}
        onClose={() => setCameraSlot(null)}
        onCapture={(f) => {
          if (cameraSlot !== null) setSlotPhoto(cameraSlot, f);
        }}
      />
    </div>
  );
}

function Panel({
  title,
  children,
  mobileActive = true,
  headerRight,
}: {
  title: string;
  children: React.ReactNode;
  mobileActive?: boolean;
  headerRight?: React.ReactNode;
}) {
  return (
    <section className={`space-y-3 rounded border border-primary/15 bg-card/40 p-4 ${mobileActive ? "block" : "hidden lg:block"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">{title}</div>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function CaptionLayer({
  caption,
  stageRef,
  previewMode,
  onChange,
  canvasW,
}: {
  caption: Caption;
  stageRef: React.RefObject<HTMLDivElement | null>;
  previewMode: boolean;
  onChange: (patch: Partial<Caption>) => void;
  canvasW: number;
}) {
  const bgCtl = useRectController(stageRef, caption.bgRect, (r) => onChange({ bgRect: r }), { snap: 0.008 });
  const txtCtl = useRectController(stageRef, caption.rect, (r) => onChange({ rect: r }), { snap: 0.008 });
  // font size in preview: stage uses container queries (100cqw = stage width)
  const fontSize = `calc(${caption.sizePx / canvasW} * 100cqw)`;
  return (
    <>
      {/* bg rect (independent) */}
      <DraggableBox rect={caption.bgRect} ctl={bgCtl} accent previewMode={previewMode}>
        <div
          className="absolute inset-0"
          style={{ background: caption.bgColor, opacity: caption.bgOpacity }}
        />
      </DraggableBox>
      {/* text rect (independent) */}
      {caption.text.trim() && (
        <DraggableBox rect={caption.rect} ctl={txtCtl} previewMode={previewMode}>
          <div
            className="flex size-full items-center justify-center px-1 text-center"
            style={{
              color: caption.color,
              fontFamily: `${caption.font}, sans-serif`,
              fontWeight: 700,
              fontSize,
              lineHeight: 1.05,
            }}
          >
            {caption.text}
          </div>
        </DraggableBox>
      )}
    </>
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
  index, slot, stageRef, minW, minH, onRectChange, onPick, onClear, onCamera,
}: {
  index: number;
  slot: SlotState;
  stageRef: React.RefObject<HTMLDivElement | null>;
  minW: number;
  minH: number;
  onRectChange: (r: Rect) => void;
  onPick: (f: File | null) => void;
  onClear: () => void;
  onCamera: () => void;
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
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/60"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-center leading-tight">
            slot {index + 1}
            <br />
            <span className="text-[8px] text-primary/40">drag center · drag edges to resize</span>
          </span>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded border border-primary/50 px-2 py-1 text-[9px] hover:bg-primary/10">
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
              Upload
            </label>
            <button
              onClick={(e) => { e.stopPropagation(); onCamera(); }}
              className="rounded border border-secondary/60 px-2 py-1 text-[9px] text-secondary hover:bg-secondary/10"
            >
              ● Camera
            </button>
          </div>
        </div>
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
  rect, ctl, accent, previewMode = false, children,
}: {
  rect: Rect;
  ctl: ReturnType<typeof useRectController>;
  accent?: boolean;
  previewMode?: boolean;
  children: React.ReactNode;
}) {
  const interactive = !previewMode;
  return (
    <div
      className={`absolute touch-none ${interactive ? `border border-dashed ${accent ? "border-secondary/60" : "border-primary/60"}` : ""}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
      }}
      onPointerDown={interactive ? ctl.onPointerDown("move") : undefined}
      onPointerMove={interactive ? ctl.onPointerMove : undefined}
      onPointerUp={interactive ? ctl.onPointerUp : undefined}
    >
      {children}
      {interactive && accent && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-sm bg-secondary px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-secondary-foreground shadow-[0_0_8px_currentColor]">
          drag
        </span>
      )}
      {interactive && (
        <span
          onPointerDown={ctl.onPointerDown("se")}
          onPointerMove={ctl.onPointerMove}
          onPointerUp={ctl.onPointerUp}
          className={`absolute -bottom-1.5 -right-1.5 z-10 size-4 cursor-nwse-resize ${accent ? "bg-secondary" : "bg-primary"} shadow-[0_0_8px_currentColor]`}
        />
      )}
      {interactive && accent && (
        <span className="absolute -bottom-7 right-0 rounded-sm bg-secondary px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-secondary-foreground shadow-[0_0_8px_currentColor]">
          resize
        </span>
      )}
    </div>
  );
}

const TINT_PRESETS: { id: string; label: string; hue: number; sat: number; swatch: string }[] = [
  { id: "none", label: "Plain", hue: 0, sat: 0, swatch: "transparent" },
  { id: "mint", label: "Mint", hue: 150, sat: 60, swatch: "hsl(150, 60%, 50%)" },
  { id: "pink", label: "Pink", hue: 330, sat: 70, swatch: "hsl(330, 70%, 55%)" },
  { id: "sun", label: "Sun", hue: 45, sat: 75, swatch: "hsl(45, 75%, 55%)" },
  { id: "sky", label: "Sky", hue: 200, sat: 65, swatch: "hsl(200, 65%, 55%)" },
  { id: "violet", label: "Violet", hue: 270, sat: 60, swatch: "hsl(270, 60%, 55%)" },
  { id: "fire", label: "Fire", hue: 15, sat: 80, swatch: "hsl(15, 80%, 55%)" },
];

function FrameStrip({
  frames,
  activeFrameId,
  onPickFrame,
  onPickCustomFrame,
  onRemoveCustomFrame,
  hasCustom,
  isCustomActive,
  customOpacity,
  onCustomOpacityChange,
  hue,
  sat,
  onPickTint,
  onHueChange,
  onSatChange,
}: {
  frames: Frame[];
  activeFrameId: string;
  onPickFrame: (id: string) => void;
  onPickCustomFrame: (f: File | null) => void;
  onRemoveCustomFrame: () => void;
  hasCustom: boolean;
  isCustomActive: boolean;
  customOpacity: number;
  onCustomOpacityChange: (v: number) => void;
  hue: number;
  sat: number;
  onPickTint: (hue: number, sat: number) => void;
  onHueChange: (v: number) => void;
  onSatChange: (v: number) => void;
}) {
  const activeTintId = TINT_PRESETS.find((t) => t.hue === hue && t.sat === sat)?.id;

  return (
    <div className="mt-4 rounded border border-primary/20 bg-background/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">
          frames · tap to preview · upload your own
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/40">
          {frames.length} frame{frames.length !== 1 ? "s" : ""} · 7 tints
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* LEFT: frame tiles + upload */}
        <div className="order-2 md:order-1 flex flex-wrap gap-2">
          {frames.map((f) => (
            <button
              key={f.id}
              onClick={() => onPickFrame(f.id)}
              className={`group relative shrink-0 overflow-hidden rounded border-2 transition-all ${
                activeFrameId === f.id
                  ? "border-primary neon-glow scale-105"
                  : "border-primary/15 hover:border-primary/50"
              }`}
              style={{
                width: 88,
                aspectRatio: `${f.ratio.split(":")[0]} / ${f.ratio.split(":")[1]}`,
              }}
              title={f.name}
            >
              <img src={f.src} alt={f.name} className="absolute inset-0 size-full bg-muted object-cover" />
              {sat > 0 && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `hsl(${hue}, ${sat}%, 50%)`,
                    mixBlendMode: "multiply",
                  }}
                />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-background/85 px-1 py-0.5 text-center font-mono text-[8px] uppercase tracking-wider text-primary/80">
                {f.kind === "custom" ? "CUSTOM" : f.ratio}
              </span>
            </button>
          ))}

          <div className="flex shrink-0 items-stretch gap-2">
            <label
              className="group relative flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-primary/40 bg-background/60 text-primary/70 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
              style={{ width: 88, aspectRatio: "1 / 1" }}
              title="Upload your own frame (PNG with transparency recommended)"
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onPickCustomFrame(e.target.files?.[0] ?? null)}
              />
              <span className="text-2xl leading-none">+</span>
              <span className="px-1 text-center font-mono text-[8px] uppercase tracking-wider">
                Upload
              </span>
              <span className="px-1 text-center font-mono text-[7px] uppercase tracking-wider text-primary/40">
                PNG · custom
              </span>
            </label>
            {hasCustom && (
              <button
                type="button"
                onClick={onRemoveCustomFrame}
                className="flex shrink-0 flex-col items-center justify-center gap-1 rounded border-2 border-destructive/40 bg-background/60 px-2 font-mono text-[9px] uppercase tracking-wider text-destructive/80 transition-all hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                style={{ width: 88, aspectRatio: "1 / 1" }}
                title="Remove uploaded custom frame"
              >
                <span className="text-xl leading-none">×</span>
                <span>Remove</span>
              </button>
            )}
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-primary/60">
            Custom frame sets the ratio — your canvas will match the uploaded frame's shape.
          </p>
        </div>

        {/* RIGHT: tint swatches + hue/sat sliders */}
        <div className="order-1 md:order-2 space-y-3">
          {isCustomActive && (
            <div className="rounded border border-primary/30 bg-primary/5 p-2">
              <Slider
                label={`Custom Frame Opacity ${Math.round(customOpacity * 100)}%`}
                min={0}
                max={100}
                value={Math.round(customOpacity * 100)}
                onChange={(v) => onCustomOpacityChange(v / 100)}
              />
            </div>
          )}
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary/50">tint</div>
          <div className="grid grid-cols-7 gap-2">
            {TINT_PRESETS.map((t) => (
              <button
                key={t.id}
                onClick={() => onPickTint(t.hue, t.sat)}
                className={`flex flex-col items-center gap-1 transition-transform hover:scale-110 ${
                  activeTintId === t.id ? "scale-110" : ""
                }`}
                title={t.label}
              >
                <span
                  className={`block size-7 rounded-full border-2 transition-all ${
                    activeTintId === t.id ? "border-primary neon-glow" : "border-primary/20"
                  }`}
                  style={{
                    background: t.id === "none" ? "transparent" : t.swatch,
                    backgroundImage:
                      t.id === "none"
                        ? "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%)"
                        : undefined,
                    backgroundSize: t.id === "none" ? "8px 8px" : undefined,
                  }}
                />
                <span className="font-mono text-[8px] uppercase tracking-wider text-primary/60">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          <Slider label={`Hue ${hue}°`} min={0} max={360} value={hue} onChange={onHueChange} />
          <Slider label={`Saturation ${sat}%`} min={0} max={100} value={sat} onChange={onSatChange} />
        </div>
      </div>
    </div>
  );
}

