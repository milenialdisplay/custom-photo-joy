# ICC profiles

Drop ICC profiles here. The agent looks for the paths set in `config.json`:

- `profiles/sRGB.icc`  — source profile (any standard sRGB v4 ICC)
- `profiles/HP_M451.icc` — printer/paper profile

If either is missing the pipeline skips color management and only applies the
tone-curve preset. That's fine for smoke-testing — just expect washed-out
color until the ICCs are dropped in.

## Where to get them

- **sRGB**: shipped with most OSes (`/System/Library/ColorSync/Profiles/sRGB Profile.icc`
  on macOS, or download from color.org).
- **HP M451**: from HP's support site under your printer model → drivers →
  "color profile". Grab the one matching your paper (glossy vs matte).

## Build your own

For the last 5% of accuracy, use Argyll CMS + an i1Studio (or similar)
colorimeter to profile your specific paper + printer combo. Drop the resulting
`.icc` here and update `config.json`.
