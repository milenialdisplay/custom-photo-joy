// Photo slot layout presets. Each layout is an array of normalized rects (0..1)
// describing where photos sit on the canvas. Users can drag + resize each slot
// from the default positions; the layout just provides sensible starting points.

import type { Ratio } from "@/lib/frames";
import type { Rect } from "@/components/studio/useDraggable";

const M = 0.04; // outer margin
const G = 0.025; // gutter between slots

function inset(): Rect {
  return { x: M, y: M, w: 1 - M * 2, h: 1 - M * 2 };
}

function row2(): Rect[] {
  const w = (1 - M * 2 - G) / 2;
  return [
    { x: M, y: M, w, h: 1 - M * 2 },
    { x: M + w + G, y: M, w, h: 1 - M * 2 },
  ];
}

function col2(): Rect[] {
  const h = (1 - M * 2 - G) / 2;
  return [
    { x: M, y: M, w: 1 - M * 2, h },
    { x: M, y: M + h + G, w: 1 - M * 2, h },
  ];
}

function row3(): Rect[] {
  const w = (1 - M * 2 - G * 2) / 3;
  return [
    { x: M, y: M, w, h: 1 - M * 2 },
    { x: M + (w + G), y: M, w, h: 1 - M * 2 },
    { x: M + (w + G) * 2, y: M, w, h: 1 - M * 2 },
  ];
}

function col3(): Rect[] {
  const h = (1 - M * 2 - G * 2) / 3;
  return [
    { x: M, y: M, w: 1 - M * 2, h },
    { x: M, y: M + (h + G), w: 1 - M * 2, h },
    { x: M, y: M + (h + G) * 2, w: 1 - M * 2, h },
  ];
}

function grid2x2(): Rect[] {
  const w = (1 - M * 2 - G) / 2;
  const h = (1 - M * 2 - G) / 2;
  return [
    { x: M, y: M, w, h },
    { x: M + w + G, y: M, w, h },
    { x: M, y: M + h + G, w, h },
    { x: M + w + G, y: M + h + G, w, h },
  ];
}

export type SlotCount = 1 | 2 | 3 | 4;

export const LAYOUTS: Record<Ratio, Record<SlotCount, Rect[]>> = {
  "1:1": {
    1: [inset()],
    2: col2(),
    3: col3(),
    4: grid2x2(),
  },
  "2:3": {
    1: [inset()],
    2: col2(),
    3: col3(),
    4: grid2x2(),
  },
  "3:2": {
    1: [inset()],
    2: row2(),
    3: row3(),
    4: grid2x2(),
  },
};

export function getLayout(ratio: Ratio, count: SlotCount): Rect[] {
  return LAYOUTS[ratio][count].map((r) => ({ ...r }));
}
