interface BrandLogoProps {
  /** "light" = on light bg → dark text. "dark" = on dark bg → light text. Default "dark". */
  variant?: "light" | "dark";
  className?: string;
  alt?: string;
}

/**
 * Text wordmark for dpotopoto.com. Uses Fredoka — a rounded, friendly display
 * font that matches the original PNG logo style. Sized via className.
 */
export function BrandLogo({ variant = "dark", className = "text-xl", alt = "dpotopoto.com" }: BrandLogoProps) {
  const color = variant === "light" ? "text-neutral-900" : "text-white";
  return (
    <span
      aria-label={alt}
      className={`select-none font-semibold leading-none ${color} ${className}`}
      style={{ fontFamily: '"Fredoka", "Quicksand", system-ui, sans-serif' }}
    >
      dpotopoto<span className="opacity-60">.com</span>
    </span>
  );
}
