import leave01 from "@/assets/patterns/leave-01.png";
import leave02 from "@/assets/patterns/leave-02.png";
import love01 from "@/assets/patterns/love-01.png";
import love02 from "@/assets/patterns/love-02.png";
import ball01 from "@/assets/patterns/ball-01.png";
import bee01 from "@/assets/patterns/bee-01.png";
import graphic01 from "@/assets/patterns/graphic-01.png";

export interface Pattern {
  id: string;
  name: string;
  src: string;
  /** True if the pattern has transparency. Solid-bg patterns still work fine. */
  hasAlpha: boolean;
}

export const PATTERNS: Pattern[] = [
  { id: "leave-01", name: "Hibiscus", src: leave01, hasAlpha: false },
  { id: "leave-02", name: "Fronds", src: leave02, hasAlpha: false },
  { id: "love-01", name: "Love Script", src: love01, hasAlpha: false },
  { id: "love-02", name: "Heart Dots", src: love02, hasAlpha: true },
  { id: "ball-01", name: "Bubbles", src: ball01, hasAlpha: false },
  { id: "bee-01", name: "Honeycomb", src: bee01, hasAlpha: true },
  { id: "graphic-01", name: "Tribal", src: graphic01, hasAlpha: false },
];
