# `/print` redesign — file picker + adjustable pricing + connect-printer + queue

## Scope (DESIGN ONLY — payment wiring deferred until /kiosk is also done)

1. Raise per-job copies cap 3 → **10** (agent + studio + printer + README)
2. Redesign `/print` to match the user's ASCII layout
3. **Connect printer** indicator top-right (orange → green)
4. **Select files** picker, max 10 files
5. Per-file size dropdown (A4 / A5) + live per-row price + total
6. **Pay now** button (UI only — wired in a later phase)
7. **Upload & print** button (grey, disabled until paid)
8. Queue strip at the bottom — printing box + next-up boxes
9. "← Back to main page" link top-right of header on the four product sub-pages
10. Starting prices: **A4 = Rp 15,000**, **A5 = Rp 5,000** — adjustable per booth, not hardcoded

## "← Back to main page" link — scope

Top-right of the header on each product sub-page:

| Page | Route | Status |
|---|---|---|
| Snap photo | `/snap` (or current snap route) | already done — verify link present, add if missing |
| Frame studio | `/studio` | already done — verify link present, add if missing |
| Printer | `/printer` and `/print` | **add now** (this plan) |
| Kiosk | `/kiosk` | add in the next phase |

Single shared component so all four pages stay visually identical:

```tsx
// src/components/site/BackToHome.tsx
import { Link } from "@tanstack/react-router";

export function BackToHome() {
  return (
    <Link
      to="/"
      className="font-mono text-xs uppercase tracking-[0.3em] text-foreground/60 hover:text-primary"
    >
      ← Back to main page
    </Link>
  );
}
```

Used like `<BackToHome />` in the top-right of each sub-page header.

## Out of scope (confirmed)

- Real Midtrans / Lemon Squeezy wiring (after `/kiosk` is done)
- Lovable Cloud / orders DB / webhooks
- Real upload to agent on green-button click
- 24h per-guest quota (queue is the only fairness mechanism)
- 60s cooldown
- **Bulk pricing discounts — explicitly NOT included**
- Operator price-editor UI (prices adjustable via config now; admin screen later)

## Pricing — adjustable, not locked

Lives in `agent/config.json` so each booth can have its own rates and the operator can edit anytime **without redeploying the web app**:

```json
{
  "location_id": "mall-a-l2",
  "printer_name": "HP_M451",
  "prices_idr": { "A4": 15000, "A5": 5000 },
  "max_copies_per_job": 10,
  "max_files_per_order": 10
}
```

Web flow:
1. `/print` loads → `GET http://10.42.0.1:8080/api/config`.
2. UI renders prices + limits from the response.
3. Offline / no agent → fall back to defaults in `src/lib/pricing.ts` + small banner "Showing default prices — connect to the booth for live pricing."

## `/print` layout (matches the user's ASCII sketch)

```text
┌──────────────────────────────────────────────────────────┐
│ dpotopoto.com                          ← Back to main page│
│                                                          │
│ Printing at: Mall A · L2     [● Connect printer ]        │
│                              (orange=offline, green=ready)│
│                                                          │
│   ┌─────────────────────────┐                            │
│   │ 📁 Select files (max 10)│                            │
│   └─────────────────────────┘                            │
│                                                          │
│   File              Size       Price                     │
│   ───────────────────────────────────                    │
│   photo-01.jpg      [A5 ▾]    Rp 5,000                   │
│   photo-02.jpg      [A4 ▾]    Rp 15,000                  │
│   photo-03.jpg      [A5 ▾]    Rp 5,000                   │
│                     ────────────────                     │
│                     Total:    Rp 25,000                  │
│                                                          │
│              ┌─────────────────────┐                     │
│              │   💳 Pay now        │                     │
│              └─────────────────────┘                     │
│                                                          │
│              ┌─────────────────────┐                     │
│              │ ⬆ Upload & print    │ (grey, disabled)    │
│              └─────────────────────┘                     │
│                                                          │
│   Queue                                                  │
│   ┌──────┐ ┌──────┐ ┌──────┐                             │
│   │ ●    │ │ next │ │ next │  ← printing pulses green    │
│   │print │ │      │ │      │     others muted grey       │
│   └──────┘ └──────┘ └──────┘                             │
└──────────────────────────────────────────────────────────┘
```

## Connect indicator behavior

- On mount, `GET /api/health` against the agent URL (from `?agent=` or `localStorage`).
- No response → orange "Connect printer" pill. Click → dialog with steps ("Join the booth Wi-Fi, then retry").
- 200 OK → green "Printer ready · {printer_name}".
- Re-polls every 10s.

## Queue strip behavior

- Polls `GET /api/jobs` every 3s once printer is connected.
- Up to 5 small boxes; first = printing (pulsing green), rest = next (muted grey). Empty queue → single "Idle" box.
- Matches operator-console styling on `/printer` for visual consistency.

## File-picker flow (UI only, no real upload yet)

1. **Select files** → native `<input type="file" multiple accept="image/*,application/pdf">`, capped at `max_files_per_order`.
2. Files held in memory; rendered with A4/A5 dropdown + per-row price.
3. Total recomputes on every change. **Flat per-sheet pricing, no bulk discount.**
4. **Pay now** → toast "Payment coming soon — design phase".
5. **Upload & print** → stays disabled+grey. Tooltip: "Available after payment".

## Copies-cap changes (3 → 10)

| File | Change |
|---|---|
| `agent/main.py` | Validate `1 ≤ copies ≤ 10`, 400 `{error:"copies_out_of_range", max:10}` on overflow |
| `agent/README.md` | Contract block → `copies (1-10)` |
| `agent/config.json` | Add `max_copies_per_job: 10` |
| `src/routes/studio.tsx` | Copies selector → 1–10 stepper with clamp |
| `src/routes/printer.tsx` | Operator queue row shows `× N` |

**Acceptance:** `copies=10` → 200, one job, `lp -n 10` → 10 sheets. `copies=11` → 400 with JSON above. Operator console shows "× 10". README matches code.

## Files to create / modify

- **create** `src/components/site/BackToHome.tsx`
- **modify** `src/routes/print.tsx` — full redesign + `<BackToHome />`
- **modify** `src/routes/printer.tsx` — `× N` badge + `<BackToHome />`
- **modify** `src/routes/studio.tsx` — 1–10 copies stepper + verify/add `<BackToHome />`
- **modify** snap-photo route — verify/add `<BackToHome />`
- **modify** `src/routes/kiosk.tsx` — `<BackToHome />` will be added in the next phase
- **create** `src/lib/pricing.ts` — defaults + helpers (`formatIDR`, `priceFor`, `MAX_*`)
- **create** `src/hooks/useBoothConfig.ts` — fetches `/api/config`, falls back to defaults
- **create** `src/components/print/FileRow.tsx`
- **create** `src/components/print/ConnectIndicator.tsx`
- **create** `src/components/print/PrintQueueStrip.tsx`
- **modify** `agent/main.py` — copies validator 1–10 + `GET /api/config`
- **modify** `agent/README.md` — contract block
- **modify** `agent/config.json` — `prices_idr`, `max_copies_per_job`, `max_files_per_order`

## Build order

1. `BackToHome` component → add to `/snap`, `/studio`, `/printer`, `/print` (kiosk gets it in its own phase)
2. Copies cap 3 → 10 across agent + studio + printer + README
3. Pricing defaults in `src/lib/pricing.ts`
4. Agent: `GET /api/config` + bump validators
5. `useBoothConfig` hook
6. `ConnectIndicator` wired to `/api/health`
7. File picker + `FileRow` + total
8. Pay now + Upload buttons (visual states only)
9. `PrintQueueStrip` wired to `/api/jobs`
10. Manual smoke test in preview against a stubbed agent URL

## Next phases (after `/print` is approved)

- **`/kiosk`** — redesign + `<BackToHome />` + connect indicator + queue strip (reuse same components).
- **Payments** — Lovable Cloud + orders DB + Midtrans Snap + Lemon Squeezy + `/api/public/payment-webhook` + wire green Upload button.

## Dell + printer testing — independent track (can start today)

1. Dell Wyse + Linux + printer over USB, powered on.
2. SSH → `agent/deploy/install.sh`.
3. `agent/deploy/provision.sh mall-a-l2`.
4. On Dell: `lpstat -p` and `lp -d <printer_name> /usr/share/cups/data/testprint`.
5. From a laptop on booth Wi-Fi: `curl http://10.42.0.1:8080/api/health` and `curl -F 'file=@test.png' http://10.42.0.1:8080/api/print`.

If those pass, hardware is done — only web UI remains.
