// Flat image-based frame manifest. Frames are JPEG/PNG overlays that sit BELOW
// the photo layer in the studio export pipeline (photos are drawn last). White
// frames receive a hue+saturation tint via "multiply" blend at render time.

import frame1x1 from "@/assets/frames/frame-1x1.jpg";
import frame2x3 from "@/assets/frames/frame-2x3.jpg";
import frame3x2 from "@/assets/frames/frame-3x2.jpg";

export type Ratio = "1:1" | "2:3" | "3:2";

export const RATIOS: { id: Ratio; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "Square", w: 1, h: 1 },
  { id: "2:3", label: "Portrait", w: 2, h: 3 },
  { id: "3:2", label: "Landscape", w: 3, h: 2 },
];

export interface Frame {
  id: string;
  name: string;
  src: string;
  ratio: Ratio;
  kind: "preset" | "custom";
}

export const PRESET_FRAMES: Frame[] = [
  { id: "white-1x1", name: "White 1:1", src: frame1x1, ratio: "1:1", kind: "preset" },
  { id: "white-2x3", name: "White 2:3", src: frame2x3, ratio: "2:3", kind: "preset" },
  { id: "white-3x2", name: "White 3:2", src: frame3x2, ratio: "3:2", kind: "preset" },
];

export const WATERMARK_HEIGHT_RATIO = 0.045;

export const OUTPUT_PRESETS = [
  { id: "web-1x1", label: "Web Square 1080", ratio: "1:1" as Ratio, w: 1080, h: 1080, kind: "web" as const },
  { id: "web-2x3", label: "Web Portrait 1080×1620", ratio: "2:3" as Ratio, w: 1080, h: 1620, kind: "web" as const },
  { id: "web-3x2", label: "Web Landscape 1620×1080", ratio: "3:2" as Ratio, w: 1620, h: 1080, kind: "web" as const },
  { id: "print-2r-1x1", label: "Print Square 1800 @300dpi", ratio: "1:1" as Ratio, w: 1800, h: 1800, kind: "print" as const },
  { id: "print-2x3", label: "Print 4R (1200×1800) @300dpi", ratio: "2:3" as Ratio, w: 1200, h: 1800, kind: "print" as const },
  { id: "print-3x2", label: "Print 4R landscape (1800×1200) @300dpi", ratio: "3:2" as Ratio, w: 1800, h: 1200, kind: "print" as const },
  { id: "print-a5-2x3", label: "Print A5 (1748×2480) @300dpi", ratio: "2:3" as Ratio, w: 1748, h: 2480, kind: "print" as const },
] as const;

export type OutputPresetId = (typeof OUTPUT_PRESETS)[number]["id"];

/** Snap given aspect ratio (w/h) to the closest preset Ratio. */
export function snapToRatio(width: number, height: number): Ratio {
  const ar = width / height;
  let best: Ratio = "1:1";
  let bestDelta = Infinity;
  for (const r of RATIOS) {
    const target = r.w / r.h;
    const delta = Math.abs(Math.log(ar / target));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = r.id;
    }
  }
  return best;
}
