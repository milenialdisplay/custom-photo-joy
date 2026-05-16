import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "metal";
type Size = "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  glow?: boolean;
}

export function NeonButton({
  variant = "primary",
  size = "md",
  glow = false,
  className = "",
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center font-mono font-bold uppercase tracking-[0.2em] transition-all select-none";
  const sizes: Record<Size, string> = {
    md: "px-6 py-3 text-xs",
    lg: "px-8 py-4 text-xs",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-primary text-primary-foreground hover:bg-secondary " +
      (glow ? "animate-pulse-glow" : "shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_35%,transparent)]"),
    ghost:
      "border border-primary/30 text-foreground hover:bg-primary/10 hover:border-primary/60",
    metal:
      "metal-button text-foreground border border-black/50",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
