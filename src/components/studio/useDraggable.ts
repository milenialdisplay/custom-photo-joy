import { useCallback, useRef } from "react";

export interface Rect {
  x: number; // 0..1 normalized to stage
  y: number;
  w: number;
  h: number;
}

type Mode = "move" | "resize";

export interface RectOptions {
  /** Minimum width as normalized fraction of stage (0..1). Default 0.05 */
  minW?: number;
  /** Minimum height as normalized fraction of stage (0..1). Default 0.05 */
  minH?: number;
  /** Snap-to-edge threshold as normalized fraction. 0 disables snap. Default 0 */
  snap?: number;
}

/** Returns pointer handlers for dragging or resizing a normalized rect inside a stage element. */
export function useRectController(
  stageRef: React.RefObject<HTMLElement | null>,
  rect: Rect,
  onChange: (r: Rect) => void,
  opts: RectOptions = {},
) {
  const { minW = 0.05, minH = 0.05, snap = 0 } = opts;
  const stateRef = useRef<{ startX: number; startY: number; orig: Rect; mode: Mode } | null>(null);

  const onPointerDown = useCallback(
    (mode: Mode) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      stateRef.current = { startX: e.clientX, startY: e.clientY, orig: { ...rect }, mode };
    },
    [rect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = stateRef.current;
      const stage = stageRef.current;
      if (!s || !stage) return;
      const box = stage.getBoundingClientRect();
      const dx = (e.clientX - s.startX) / box.width;
      const dy = (e.clientY - s.startY) / box.height;
      if (s.mode === "move") {
        let nx = Math.max(0, Math.min(1 - s.orig.w, s.orig.x + dx));
        let ny = Math.max(0, Math.min(1 - s.orig.h, s.orig.y + dy));
        if (snap > 0) {
          if (nx < snap) nx = 0;
          if (ny < snap) ny = 0;
          if (1 - (nx + s.orig.w) < snap) nx = 1 - s.orig.w;
          if (1 - (ny + s.orig.h) < snap) ny = 1 - s.orig.h;
        }
        onChange({ ...s.orig, x: nx, y: ny });
      } else {
        let w = Math.max(minW, Math.min(1 - s.orig.x, s.orig.w + dx));
        let h = Math.max(minH, Math.min(1 - s.orig.y, s.orig.h + dy));
        if (snap > 0) {
          if (1 - (s.orig.x + w) < snap) w = 1 - s.orig.x;
          if (1 - (s.orig.y + h) < snap) h = 1 - s.orig.y;
        }
        onChange({ ...s.orig, w, h });
      }
    },
    [onChange, stageRef, minW, minH, snap],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    stateRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
