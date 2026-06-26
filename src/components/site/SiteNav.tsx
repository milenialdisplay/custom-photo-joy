import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLogo } from "@/components/site/BrandLogo";

export function SiteNav() {
  const [lang, setLang] = useState<"EN" | "ID">("EN");
  return (
    <nav className="sticky top-0 z-50 border-b border-primary/15 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="size-2.5 animate-blink rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
          <BrandLogo variant="dark" className="text-2xl md:text-3xl" />
        </Link>
        <div className="hidden gap-8 font-mono text-[11px] uppercase tracking-[0.2em] text-primary/60 md:flex">
          <Link to="/snap" className="transition-colors hover:text-primary" activeProps={{ className: "text-primary" }}>/snap</Link>
          <Link to="/frame" className="transition-colors hover:text-primary" activeProps={{ className: "text-primary" }}>/frame</Link>
          <Link to="/printer" className="transition-colors hover:text-primary" activeProps={{ className: "text-primary" }}>/printer</Link>
          <Link to="/event" className="transition-colors hover:text-primary" activeProps={{ className: "text-primary" }}>/event</Link>
        </div>
        <div className="flex items-center gap-1 rounded-sm border border-primary/20 p-0.5 font-mono text-[10px]">
          {(["EN", "ID"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-0.5 transition-colors ${
                lang === l ? "bg-primary text-primary-foreground" : "text-primary/50 hover:text-primary"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
