import { FRAMES, type FrameId, WATERMARK_HEIGHT_RATIO } from "@/lib/frames";
import type { Rect } from "@/components/studio/useDraggable";

export interface ExportState {
  photoUrl: string | null;
  frameId: FrameId;
  frameHue: number;
  logoUrl: string | null;
  logoRect: Rect;
  logoOpacity: number;
  caption: string;
  captionFont: string;
  captionSize: number; // relative to canvas width (0..1)
  captionColor: string;
  captionRect: Rect;
  captionBg: string;
  captionBgOpacity: number;
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

const svgToImage = async (svg: string): Promise<HTMLImageElement | null> => {
  if (!svg) return null;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height;
  const cr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

export async function renderToCanvas(
  state: ExportState,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // 1) base photo (or solid bg)
  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, width, height);
  if (state.photoUrl) {
    const photo = await loadImage(state.photoUrl);
    drawCover(ctx, photo, width, height);
  }

  // 2) frame
  const frame = FRAMES.find((f) => f.id === state.frameId);
  if (frame && frame.id !== "none") {
    const svg = frame.render(width, height, state.frameHue);
    const fimg = await svgToImage(svg);
    if (fimg) ctx.drawImage(fimg, 0, 0, width, height);
  }

  // 3) caption background box + text
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

  // 4) logo
  if (state.logoUrl) {
    const logo = await loadImage(state.logoUrl);
    const r = state.logoRect;
    ctx.save();
    ctx.globalAlpha = state.logoOpacity;
    ctx.drawImage(logo, r.x * width, r.y * height, r.w * width, r.h * height);
    ctx.restore();
  }

  // 5) trial watermark at bottom (not over photo content -> draw a band)
  if (state.trial) {
    const bandH = Math.max(28, height * WATERMARK_HEIGHT_RATIO);
    ctx.fillStyle = "rgba(10,10,15,0.85)";
    ctx.fillRect(0, height - bandH, width, bandH);
    ctx.fillStyle = "#73FFB8";
    ctx.font = `bold ${bandH * 0.5}px "JetBrains Mono", monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("d'poto.com — trial", width / 2, height - bandH / 2);
  }

  return canvas;
}

export async function exportJPEG(state: ExportState, width: number, height: number, quality = 0.92): Promise<Blob> {
  const canvas = await renderToCanvas(state, width, height);
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
