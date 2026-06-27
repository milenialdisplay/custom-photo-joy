// Single-slot composite renderer used by the event capture flow.
// Frame drawn full-canvas first; photo drawn on top inside the saved slot rect.

export interface SlotRect {
  x: number; // 0..1 normalized
  y: number;
  w: number;
  h: number;
}

export interface FrameSlot {
  rect: SlotRect;
  ratio: "1:1" | "2:3" | "3:2";
}

export const DEFAULT_SLOT: FrameSlot = {
  rect: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  ratio: "1:1",
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.width / img.height;
  const cr = dw / dh;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (ir > cr) {
    sw = img.height * cr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Render frame + photo composite. Frame full-canvas, photo into slot rect. */
export async function renderEventComposite(opts: {
  frameUrl: string | null;
  slot: FrameSlot;
  photoUrl: string;
  width: number;
  height: number;
}): Promise<HTMLCanvasElement> {
  const { frameUrl, slot, photoUrl, width, height } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  if (frameUrl) {
    try {
      const frame = await loadImage(frameUrl);
      ctx.drawImage(frame, 0, 0, width, height);
    } catch {
      // ignore — render photo only
    }
  }

  const photo = await loadImage(photoUrl);
  drawCover(
    ctx,
    photo,
    slot.rect.x * width,
    slot.rect.y * height,
    slot.rect.w * width,
    slot.rect.h * height,
  );
  return canvas;
}

export async function compositeToBlob(opts: {
  frameUrl: string | null;
  slot: FrameSlot;
  photoUrl: string;
  width: number;
  height: number;
  quality?: number;
}): Promise<Blob> {
  const canvas = await renderEventComposite(opts);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      opts.quality ?? 0.92,
    ),
  );
}

/** Compute canvas pixel size from chosen ratio (target ~1600px on long edge). */
export function dimsForRatio(ratio: "1:1" | "2:3" | "3:2"): { w: number; h: number } {
  if (ratio === "1:1") return { w: 1600, h: 1600 };
  if (ratio === "2:3") return { w: 1200, h: 1800 };
  return { w: 1800, h: 1200 };
}
