import { useRef, useState } from "react";
import { useRectController, type Rect } from "@/components/studio/useDraggable";
import type { FrameSlot } from "@/lib/event-render";

interface Props {
  frameUrl: string | null;
  slot: FrameSlot;
  onSlotChange: (slot: FrameSlot) => void;
}

const RATIOS: Array<{ id: FrameSlot["ratio"]; label: string; w: number; h: number }> = [
  { id: "1:1", label: "Square", w: 1, h: 1 },
  { id: "2:3", label: "Portrait", w: 2, h: 3 },
  { id: "3:2", label: "Landscape", w: 3, h: 2 },
];

export function SingleSlotEditor({ frameUrl, slot, onSlotChange }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageRatio] = useState(1); // stage shown as 1:1; frame stretched

  const setRect = (r: Rect) => onSlotChange({ ...slot, rect: r });
  const ctl = useRectController(stageRef, slot.rect, setRect, { minW: 0.1, minH: 0.1, snap: 0.02 });

  function setRatio(r: FrameSlot["ratio"]) {
    // adjust rect to match the new aspect, centered, keeping width
    const target = RATIOS.find((x) => x.id === r)!;
    const arSlot = target.w / target.h;
    const w = slot.rect.w;
    const h = Math.min(0.95, w / arSlot);
    const x = Math.max(0, Math.min(1 - w, slot.rect.x));
    const y = Math.max(0, Math.min(1 - h, slot.rect.y + (slot.rect.h - h) / 2));
    onSlotChange({ ratio: r, rect: { x, y, w, h } });
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRatio(r.id)}
            className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${
              slot.ratio === r.id ? "border-primary bg-primary/10 text-primary" : "border-primary/30 text-foreground/70"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div
        ref={stageRef}
        className="relative w-full overflow-hidden border border-primary/30 bg-[repeating-conic-gradient(#2a2a2a_0deg_25%,#1a1a1a_0deg_50%)] [background-size:24px_24px]"
        style={{ aspectRatio: String(stageRatio) }}
      >
        {frameUrl ? (
          <img src={frameUrl} alt="frame" className="absolute inset-0 size-full object-fill" />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">
            Upload a frame to begin
          </div>
        )}
        {/* slot rectangle */}
        <div
          onPointerDown={ctl.onPointerDown("move")}
          onPointerMove={ctl.onPointerMove}
          onPointerUp={ctl.onPointerUp}
          className="absolute cursor-move border-2 border-dashed border-primary bg-primary/10"
          style={{
            left: `${slot.rect.x * 100}%`,
            top: `${slot.rect.y * 100}%`,
            width: `${slot.rect.w * 100}%`,
            height: `${slot.rect.h * 100}%`,
          }}
        >
          <span className="pointer-events-none absolute left-1 top-1 bg-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary-foreground">
            PHOTO SLOT
          </span>
          {/* resize handle SE */}
          <span
            onPointerDown={ctl.onPointerDown("se")}
            onPointerMove={ctl.onPointerMove}
            onPointerUp={ctl.onPointerUp}
            className="absolute -bottom-1.5 -right-1.5 size-4 cursor-se-resize border border-primary bg-background"
          />
        </div>
      </div>
      <p className="mt-2 font-mono text-[10px] text-foreground/50">
        Drag the slot to position · drag the corner to resize. Guests' photos will fill this area.
      </p>
    </div>
  );
}
