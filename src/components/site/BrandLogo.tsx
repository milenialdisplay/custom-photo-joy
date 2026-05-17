import blackLogo from "@/assets/brand/dpotopoto-black.png";
import whiteLogo from "@/assets/brand/dpotopoto-white.png";

interface BrandLogoProps {
  /** "light" = on light bg → black logo. "dark" = on dark bg → white logo. Default "dark". */
  variant?: "light" | "dark";
  className?: string;
  alt?: string;
}

export function BrandLogo({ variant = "dark", className = "h-5 w-auto", alt = "dpotopoto.com" }: BrandLogoProps) {
  const src = variant === "light" ? blackLogo : whiteLogo;
  return <img src={src} alt={alt} className={className} draggable={false} />;
}
