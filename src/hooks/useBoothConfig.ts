import { useEffect, useState } from "react";
import {
  DEFAULT_PRICES_IDR,
  MAX_COPIES_PER_JOB,
  MAX_FILES_PER_ORDER,
  type PaperSize,
} from "@/lib/pricing";

export interface BoothConfig {
  location_id: string;
  location_label: string;
  printer_name: string;
  prices_idr: Record<PaperSize, number>;
  max_copies_per_job: number;
  max_files_per_order: number;
  /** True when values come from the live agent; false when defaults are used. */
  live: boolean;
}

const DEFAULTS: BoothConfig = {
  location_id: "",
  location_label: "",
  printer_name: "",
  prices_idr: { ...DEFAULT_PRICES_IDR },
  max_copies_per_job: MAX_COPIES_PER_JOB,
  max_files_per_order: MAX_FILES_PER_ORDER,
  live: false,
};

/**
 * Fetches booth config (prices + limits) from the agent.
 * Falls back to local defaults if the agent is unreachable so the page still works.
 */
export function useBoothConfig(agentUrl: string | null): BoothConfig {
  const [cfg, setCfg] = useState<BoothConfig>(DEFAULTS);

  useEffect(() => {
    if (!agentUrl) {
      setCfg(DEFAULTS);
      return;
    }
    let aborted = false;
    (async () => {
      try {
        const r = await fetch(`${agentUrl}/api/config`, { cache: "no-store" });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const data = await r.json();
        if (aborted) return;
        setCfg({
          location_id: data.location_id ?? "",
          location_label: data.location_label ?? "",
          printer_name: data.printer_name ?? "",
          prices_idr: {
            A4: Number(data.prices_idr?.A4 ?? DEFAULT_PRICES_IDR.A4),
            A5: Number(data.prices_idr?.A5 ?? DEFAULT_PRICES_IDR.A5),
          },
          max_copies_per_job: Number(data.max_copies_per_job ?? MAX_COPIES_PER_JOB),
          max_files_per_order: Number(data.max_files_per_order ?? MAX_FILES_PER_ORDER),
          live: true,
        });
      } catch {
        if (!aborted) setCfg(DEFAULTS);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [agentUrl]);

  return cfg;
}
