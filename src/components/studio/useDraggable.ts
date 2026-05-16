import { useCallback, useRef } from "react";

export interface Rect {
  x: number; // 0..1 normalized to stage
  y: number;
  w: number;
  h: number;
}

type Mode = "move" | "resize";

/** Returns pointer-down handler for dragging or resizing a normalized rect inside a stage element. */
export function useRectController(
  stageRef: React.RefObject<HTMLElement | null>,
  rect: Rect,
  onChange: (r: Rect) => void,
) {
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
        onChange({
          ...s.orig,
          x: Math.max(0, Math.min(1 - s.orig.w, s.orig.x + dx)),
          y: Math.max(0, Math.min(1 - s.orig.h, s.orig.y + dy)),
        });
      } else {
        const w = Math.max(0.05, Math.min(1 - s.orig.x, s.orig.w + dx));
        const h = Math.max(0.05, Math.min(1 - s.orig.y, s.orig.h + dy));
        onChange({ ...s.orig, w, h });
      }
    },
    [onChange, stageRef],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    stateRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
