export function SiteFooter() {
  return (
    <footer className="border-t border-primary/10 px-6 py-12 font-mono text-[10px] uppercase tracking-[0.2em]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-blink rounded-full bg-primary" />
          <span className="text-primary">D'POTO_</span>
          <span className="text-primary/30">SYSTEM_v.03</span>
        </div>
        <div className="flex gap-8 text-primary/40">
          <a href="#" className="transition-colors hover:text-primary">Instagram</a>
          <a href="#" className="transition-colors hover:text-primary">TikTok</a>
          <a href="#" className="transition-colors hover:text-primary">Support</a>
        </div>
        <div className="text-primary/30">&copy; 2026 d'poto.com</div>
      </div>
    </footer>
  );
}
