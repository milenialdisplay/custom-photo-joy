import { BrandLogo } from "@/components/site/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-primary/10 px-6 py-12 font-mono text-[10px] uppercase tracking-[0.2em]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex items-center gap-3">
          <span className="size-2 animate-blink rounded-full bg-primary" />
          <BrandLogo variant="dark" className="text-base md:text-lg" />
        </div>
        <div className="flex gap-8 text-primary/40">
          <a href="#" className="transition-colors hover:text-primary">Contact Us</a>
        </div>
        <div className="text-primary/30">&copy; 2026 dpotopoto.com</div>
      </div>
    </footer>
  );
}
