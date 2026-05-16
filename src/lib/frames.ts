// Built-in frame gallery. Each frame renders as an SVG string sized to the
// output canvas; we draw it on top of the photo at export time and overlay it
// as a CSS background in the live preview.

export type FrameId =
  | "none"
  | "neon-bezel"
  | "polaroid"
  | "filmstrip"
  | "rivet-panel"
  | "scanline"
  | "double-line"
  | "ticket"
  | "arcade";

export interface Frame {
  id: FrameId;
  name: string;
  tag: string;
  /** SVG markup parameterised by width/height; receives hue rotation via CSS filter at runtime. */
  render: (w: number, h: number, hue: number) => string;
}

const wrap = (w: number, h: number, hue: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="filter:hue-rotate(${hue}deg)">${inner}</svg>`;

export const FRAMES: Frame[] = [
  {
    id: "none",
    name: "No frame",
    tag: "RAW",
    render: () => "",
  },
  {
    id: "neon-bezel",
    name: "Neon Bezel",
    tag: "01",
    render: (w, h, hue) =>
      wrap(
        w,
        h,
        hue,
        `<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#73FFB8"/><stop offset="1" stop-color="#00F0FF"/></linearGradient></defs>
         <rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="url(#g)" stroke-width="6" rx="6"/>
         <rect x="22" y="22" width="${w - 44}" height="${h - 44}" fill="none" stroke="#73FFB8" stroke-opacity="0.35" stroke-width="1"/>
         <g fill="#73FFB8" font-family="monospace" font-size="${Math.round(w * 0.018)}">
           <text x="28" y="${h - 28}" opacity="0.7">// D'POTO_</text>
           <text x="${w - 130}" y="${h - 28}" opacity="0.7">REC ●</text>
         </g>`,
      ),
  },
  {
    id: "polaroid",
    name: "Polaroid",
    tag: "02",
    render: (w, h, hue) => {
      const pad = Math.round(w * 0.04);
      const bottom = Math.round(h * 0.14);
      return wrap(
        w,
        h,
        hue,
        `<rect x="0" y="0" width="${w}" height="${h}" fill="#F5F0E0"/>
         <rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad - bottom}" fill="#000"/>`,
      );
    },
  },
  {
    id: "filmstrip",
    name: "Film Strip",
    tag: "03",
    render: (w, h, hue) => {
      const side = Math.round(w * 0.06);
      const holes = Array.from({ length: 12 })
        .map((_, i) => {
          const y = ((i + 1) * (h - 20)) / 13;
          const r = side * 0.28;
          return `<rect x="${side * 0.18}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="2" fill="#0A0A0F"/>
                  <rect x="${w - side * 0.18 - r * 2}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="2" fill="#0A0A0F"/>`;
        })
        .join("");
      return wrap(
        w,
        h,
        hue,
        `<rect x="0" y="0" width="${side}" height="${h}" fill="#1A1A24"/>
         <rect x="${w - side}" y="0" width="${side}" height="${h}" fill="#1A1A24"/>
         ${holes}`,
      );
    },
  },
  {
    id: "rivet-panel",
    name: "Rivet Panel",
    tag: "04",
    render: (w, h, hue) => {
      const t = Math.round(w * 0.05);
      const rivets = [
        [t / 2, t / 2],
        [w - t / 2, t / 2],
        [t / 2, h - t / 2],
        [w - t / 2, h - t / 2],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${t * 0.22}" fill="#2A2A35" stroke="#000" stroke-width="1"/>`)
        .join("");
      return wrap(
        w,
        h,
        hue,
        `<defs><linearGradient id="m" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2A2A35"/><stop offset="0.5" stop-color="#14141C"/><stop offset="1" stop-color="#2A2A35"/></linearGradient></defs>
         <rect x="0" y="0" width="${w}" height="${t}" fill="url(#m)"/>
         <rect x="0" y="${h - t}" width="${w}" height="${t}" fill="url(#m)"/>
         <rect x="0" y="0" width="${t}" height="${h}" fill="url(#m)"/>
         <rect x="${w - t}" y="0" width="${t}" height="${h}" fill="url(#m)"/>
         ${rivets}`,
      );
    },
  },
  {
    id: "scanline",
    name: "Scanline",
    tag: "05",
    render: (w, h, hue) =>
      wrap(
        w,
        h,
        hue,
        `<defs><pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="2" fill="#73FFB8" fill-opacity="0.08"/>
         </pattern></defs>
         <rect x="0" y="0" width="${w}" height="${h}" fill="url(#s)"/>
         <rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="#73FFB8" stroke-width="2" stroke-opacity="0.6"/>`,
      ),
  },
  {
    id: "double-line",
    name: "Editorial",
    tag: "06",
    render: (w, h, hue) =>
      wrap(
        w,
        h,
        hue,
        `<rect x="20" y="20" width="${w - 40}" height="${h - 40}" fill="none" stroke="#F0F0FF" stroke-width="1"/>
         <rect x="32" y="32" width="${w - 64}" height="${h - 64}" fill="none" stroke="#F0F0FF" stroke-width="3"/>`,
      ),
  },
  {
    id: "ticket",
    name: "Arcade Ticket",
    tag: "07",
    render: (w, h, hue) => {
      const r = Math.round(w * 0.025);
      const dots = Array.from({ length: 20 })
        .map((_, i) => `<circle cx="${(i + 0.5) * (w / 20)}" cy="${h - 30}" r="2" fill="#73FFB8"/>`)
        .join("");
      return wrap(
        w,
        h,
        hue,
        `<circle cx="0" cy="${h / 2}" r="${r * 2}" fill="#0A0A0F"/>
         <circle cx="${w}" cy="${h / 2}" r="${r * 2}" fill="#0A0A0F"/>
         <rect x="0" y="${h - 60}" width="${w}" height="60" fill="#73FFB8" fill-opacity="0.08"/>
         ${dots}`,
      );
    },
  },
  {
    id: "arcade",
    name: "Arcade HUD",
    tag: "08",
    render: (w, h, hue) =>
      wrap(
        w,
        h,
        hue,
        `<g fill="none" stroke="#73FFB8" stroke-width="2">
          <path d="M0 24 L24 24 L24 0"/>
          <path d="M${w} 24 L${w - 24} 24 L${w - 24} 0"/>
          <path d="M0 ${h - 24} L24 ${h - 24} L24 ${h}"/>
          <path d="M${w} ${h - 24} L${w - 24} ${h - 24} L${w - 24} ${h}"/>
         </g>
         <g font-family="monospace" font-size="${Math.round(w * 0.02)}" fill="#73FFB8">
          <text x="40" y="40">PLAYER 1</text>
          <text x="${w - 140}" y="40">SCORE 9999</text>
          <text x="40" y="${h - 28}">// LIVE FEED</text>
         </g>`,
      ),
  },
];

export const WATERMARK_HEIGHT_RATIO = 0.045;

export const OUTPUT_PRESETS = [
  { id: "square-1080", label: "Square 1080", w: 1080, h: 1080, kind: "web" as const },
  { id: "portrait-1080", label: "Portrait 1080×1350", w: 1080, h: 1350, kind: "web" as const },
  { id: "story-1080", label: "Story 1080×1920", w: 1080, h: 1920, kind: "web" as const },
  { id: "print-2r", label: "Print 2R", w: 762, h: 1050, kind: "print" as const },
  { id: "print-4r", label: "Print 4R", w: 1200, h: 1800, kind: "print" as const },
  { id: "print-a6", label: "Print A6", w: 1240, h: 1748, kind: "print" as const },
  { id: "print-a5", label: "Print A5", w: 1748, h: 2480, kind: "print" as const },
  { id: "print-square", label: "Print Square", w: 1800, h: 1800, kind: "print" as const },
] as const;

export type OutputPresetId = (typeof OUTPUT_PRESETS)[number]["id"];
