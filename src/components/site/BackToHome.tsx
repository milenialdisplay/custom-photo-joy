import { Link } from "@tanstack/react-router";

/**
 * Shared "← Back to main page" link used in the top-right of header
 * on product sub-pages: /snap, /studio, /printer, /print, /kiosk.
 */
export function BackToHome() {
  return (
    <Link
      to="/"
      className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/60 transition-colors hover:text-primary"
    >
      ← Back to main page
    </Link>
  );
}
