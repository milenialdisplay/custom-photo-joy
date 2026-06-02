# Two prerequisites before the Dell setup

You hit two blockers. Both are quick to fix. Do these first, then go back to the Dell walkthrough.

---

## A. Get the project files onto your PC (GitHub)

Lovable stores your project's code in a GitHub repo. You need to connect GitHub once, then download the repo as a ZIP. No `git` install required.

### A1. Connect Lovable to GitHub (one-time)

1. In Lovable (top-right of this project), click **GitHub** → **Connect to GitHub**.
2. Authorize the Lovable GitHub app for your account.
3. Pick **"Create Repository"**. Lovable creates a new GitHub repo and pushes all your project files (including the `agent/` folder) into it.

After this, every change you make in Lovable auto-syncs to GitHub.

### A2. Download the repo as a ZIP

1. Click the GitHub button in Lovable again → **Open on GitHub**. Your browser opens the repo page.
2. On the GitHub page, click the green **`< > Code`** button → **Download ZIP**.
3. Unzip on your PC, e.g. to `C:\dpotopoto\`. Inside you'll see the `agent/` folder — that's what you copy to the Dell.

> Every time you want the latest version of `agent/` on the Dell, repeat A2 (download ZIP, unzip, re-copy the folder via WinSCP). You don't need to redo A1.

### A3. (Optional, only if you do Step 8 — full React UI on Dell)

To run `bun run build` on your PC you need **bun** installed: open PowerShell and run
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```
Skip this if you'll only use the minimal `/booth` page on the Dell.

---

## B. Fix WinSCP "putty.exe not found"

WinSCP doesn't include PuTTY — it just launches it if it's already installed. You have two equally good options. Pick **B1** (easiest).

### B1. Use WinSCP's built-in console (no PuTTY needed) ✅ recommended

1. In WinSCP, with the Dell session open, press **Ctrl+T** (or top menu → **Commands → Open Terminal**).
2. A small window opens — type Linux commands here, press Enter, see output. Works exactly like SSH for our purposes.

Caveat: this terminal is not a full interactive shell — it works fine for `bash deploy/install.sh`, `hp-setup -i`, `curl`, `lpstat`, `systemctl`, etc. If `hp-setup -i` ever gets stuck because it's expecting tty input, fall back to B2.

### B2. Install PuTTY (full terminal)

1. Download from https://www.putty.org → **64-bit MSI installer**. Run it, accept defaults.
2. Back in WinSCP: top menu → **Options → Preferences → Integration → Applications**.
3. The "PuTTY/Terminal client path" field should now auto-fill. If not, click **Browse** and pick `C:\Program Files\PuTTY\putty.exe`. Click **OK**.
4. Now the **Open in PuTTY** button works.

---

## What to do next

1. Do **A1 + A2** → you'll have the `agent/` folder on your PC.
2. Do **B1** (or B2) → you'll have a terminal to the Dell.
3. Then resume the Dell walkthrough from **Step 1** in `.lovable/plan.md`:
   - WinSCP-copy `agent/` to `/home/elenajaya/` on the Dell.
   - Open WinSCP terminal (Ctrl+T).
   - Run `cd ~/agent && bash deploy/install.sh`.
   - Continue through Steps 4 → 7.

Total extra time for these two prerequisites: ~5 minutes.

---

## Quick reference

| Need | Where |
|---|---|
| Connect to GitHub | Lovable top-right → GitHub button |
| Download project ZIP | github.com → your repo → green Code button → Download ZIP |
| Open terminal to Dell | WinSCP → Ctrl+T |
| Install PuTTY (optional) | putty.org → 64-bit MSI |
