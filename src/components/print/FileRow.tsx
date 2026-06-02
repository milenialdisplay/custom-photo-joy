import { formatIDR, PAPER_SIZES, type PaperSize } from "@/lib/pricing";

interface Props {
  name: string;
  size: PaperSize;
  price: number;
  onSizeChange: (s: PaperSize) => void;
  onRemove: () => void;
}

export function FileRow({ name, size, price, onSizeChange, onRemove }: Props) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-primary/10 py-3">
      <span className="truncate font-mono text-xs text-foreground/80" title={name}>
        {name}
      </span>
      <select
        value={size}
        onChange={(e) => onSizeChange(e.target.value as PaperSize)}
        className="border border-primary/20 bg-background px-2 py-1 font-mono text-xs"
      >
        {PAPER_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span className="w-24 text-right font-mono text-sm tabular-nums">
        {formatIDR(price)}
      </span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="font-mono text-xs text-foreground/40 hover:text-destructive"
      >
        ✕
      </button>
    </div>
  );
}
