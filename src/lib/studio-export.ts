import { PRESET_FRAMES } from "@/lib/frames";
import brandWhiteUrl from "@/assets/brand/dpotopoto-white.png";
import type { Frame } from "@/lib/frames";
import type { Rect } from "@/components/studio/useDraggable";

export interface ExportCaption {
  id: string;
  text: string;
  font: string;
  color: string;
  sizePx: number;
  rect: Rect;
  bgColor: string;
  bgOpacity: number;
  bgRect: Rect;
}

export interface SlotState {
  rect: Rect;
  photoUrl: string | null;
}

export interface ExportState {
  // frame
  frameId: string;
  customFrame: Frame | null;
  frameHue: number;
  frameSat: number; // 0..100
  customFrameOpacity?: number; // 0..1, only applied when active frame is custom
  // pattern
  patternId: string | null;
  patternOpacity: number; // 0..1
  patternTile: boolean;
  // slots
  slots: SlotState[];
  // logo
  logoUrl: string | null;
  logoRect: Rect;
  logoOpacity: number;
  // caption
  caption: string;
  captionFont: string;
  captionSize: number; // relative to canvas width 0..1
  captionColor: string;
  captionRect: Rect;
  captionBg: string;
  captionBgOpacity: number;
  // trial
  trial: boolean;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const ir = img.width / img.height;
  const cr = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function findFrame(state: ExportState): Frame | null {
  if (state.customFrame && state.frameId === state.customFrame.id) return state.customFrame;
  return PRESET_FRAMES.find((f) => f.id === state.frameId) ?? null;
}

export async function renderToCanvas(
  state: ExportState,
  width: number,
  height: number,
  patternLookup: (id: string) => string | undefined,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 1) background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // 2) frame (stretched to canvas) — white JPEG tinted with multiply
  const frame = findFrame(state);
  if (frame) {
    const fimg = await loadImage(frame.src);
    const customAlpha = frame.kind === "custom" ? state.customFrameOpacity ?? 1 : 1;
    ctx.save();
    ctx.globalAlpha = customAlpha;
    // draw white frame
    ctx.drawImage(fimg, 0, 0, width, height);
    // apply hue/sat tint via multiply: a solid color layer composited only where frame is white
    if (state.frameSat > 0) {
      const tintCanvas = document.createElement("canvas");
      tintCanvas.width = width;
      tintCanvas.height = height;
      const tctx = tintCanvas.getContext("2d")!;
      tctx.drawImage(fimg, 0, 0, width, height);
      tctx.globalCompositeOperation = "multiply";
      tctx.fillStyle = `hsl(${state.frameHue}, ${state.frameSat}%, 50%)`;
      tctx.fillRect(0, 0, width, height);
      ctx.drawImage(tintCanvas, 0, 0);
    }
    ctx.restore();
  }

  // 3) pattern overlay (above frame, BELOW photos)
  if (state.patternId) {
    const src = patternLookup(state.patternId);
    if (src) {
      const pimg = await loadImage(src);
      ctx.save();
      ctx.globalAlpha = state.patternOpacity;
      if (state.patternTile) {
        const pat = ctx.createPattern(pimg, "repeat");
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        ctx.drawImage(pimg, 0, 0, width, height);
      }
      ctx.restore();
    }
  }

  // 4) photos in slots (drawn LAST among media → always on top of frame & pattern)
  for (const slot of state.slots) {
    if (!slot.photoUrl) continue;
    const photo = await loadImage(slot.photoUrl);
    const dx = slot.rect.x * width;
    const dy = slot.rect.y * height;
    const dw = slot.rect.w * width;
    const dh = slot.rect.h * height;
    drawCover(ctx, photo, dx, dy, dw, dh);
  }

  // 5) caption bg + text
  if (state.caption.trim()) {
    const r = state.captionRect;
    const px = r.x * width;
    const py = r.y * height;
    const pw = r.w * width;
    const ph = r.h * height;
    ctx.save();
    ctx.globalAlpha = state.captionBgOpacity;
    ctx.fillStyle = state.captionBg;
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
    const fontPx = Math.max(12, state.captionSize * width);
    ctx.fillStyle = state.captionColor;
    ctx.font = `bold ${fontPx}px ${state.captionFont}, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(state.caption, px + pw / 2, py + ph / 2, pw * 0.95);
  }

  // 6) logo
  if (state.logoUrl) {
    const logo = await loadImage(state.logoUrl);
    const r = state.logoRect;
    ctx.save();
    ctx.globalAlpha = state.logoOpacity;
    ctx.drawImage(logo, r.x * width, r.y * height, r.w * width, r.h * height);
    ctx.restore();
  }

  // 6.5) bottom-left brand mark on a tight black pill (legible over white frames)
  const brand = await loadImage(brandWhiteUrl);
  const brandWidth = width * 0.12;
  const brandHeight = (brand.height / brand.width) * brandWidth;
  const padX = brandWidth * 0.08;
  const padY = brandHeight * 0.3;
  const EDGE_PX = 6;
  const boxW = brandWidth + padX * 2;
  const boxH = brandHeight + padY * 2;
  const boxX = EDGE_PX;
  const boxY = height - boxH - EDGE_PX;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  const r = Math.min(boxW, boxH) * 0.15;
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
  ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
  ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
  ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
  ctx.closePath();
  ctx.fill();
  ctx.drawImage(brand, boxX + padX, boxY + padY, brandWidth, brandHeight);
  ctx.restore();

  // trial watermark removed — branding mark above covers attribution.

  return canvas;
}

export async function exportJPEG(
  state: ExportState,
  width: number,
  height: number,
  patternLookup: (id: string) => string | undefined,
  quality = 0.92,
): Promise<Blob> {
  const canvas = await renderToCanvas(state, width, height, patternLookup);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob failed"))), "image/jpeg", quality),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
