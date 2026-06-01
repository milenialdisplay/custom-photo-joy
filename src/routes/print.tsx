import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "Print here — dpotopoto" },
      { name: "description", content: "Upload a photo and print at this dpotopoto booth." },
      { name: "viewport", content: "width=device-width,initial-scale=1,viewport-fit=cover" },
    ],
  }),
  component: PrintPage,
});

/**
 * End-user print page reached by scanning a booth QR.
 *
 * URL shape from the QR sticker:
 *   http://10.42.0.1:8080/booth?loc=<id>
 *
 * The Dell serves /booth itself (offline-friendly). This route is the
 * online/published version — if you opened https://dpotopoto.com/print?agent=...
 * it points your phone at the configured agent on the same Wi-Fi.
 */
function PrintPage() {
  const [agent, setAgent] = useState<string>("");
  const [loc, setLoc] = useState<string>("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const a = url.searchParams.get("agent") ?? localStorage.getItem("dpoto.printer.agent_url");
    const l = url.searchParams.get("loc") ?? "";
    if (a) {
      setAgent(a.replace(/\/$/, ""));
      // If the QR points at the agent directly, bounce there for the offline booth UI.
      if (window.location.origin !== a) {
        window.location.replace(`${a}/booth?loc=${encodeURIComponent(l)}`);
      }
    }
    setLoc(l);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-md">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
          // dpotopoto · print
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          {loc ? `Printing at: ${loc}` : "Open this from the booth QR"}
        </h1>
        <p className="text-sm text-foreground/60">
          {agent
            ? `Redirecting to the booth printer at ${agent}…`
            : "Scan the QR sticker on the booth. Your phone will join the booth Wi-Fi and open the print page."}
        </p>
      </div>
    </div>
  );
}
