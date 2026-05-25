# AP Ops | Absolutely Plausible

**Absolutely Plausible — internal operations & invoicing app**

Foundation copied from the `hackFatura` app and re-themed to the Absolutely Plausible
brand (cool watercolour palette, Share Tech Mono).

**Tailoring status — CRM minimal v1 + Phase 2.1 modal-edit polish complete (v1.5.1):**

- ✅ Namespace `PCJ` → `AP`; localStorage keys `pcj_*` → `ap_*`
- ✅ Team set to the AP core: Luiz, Bebeco, Samuel
- ✅ Inherited PCJ Spreadsheet ID cleared from `Code.gs`
- ✅ Domain model reworked from karting → AP's real business:
  **Client → Project → entries**

## Domain model

The app is organized around **Clients**, each with one or more **Projects**.
Every work / expense / invoice entry belongs to a Client + Project.

| View | Purpose |
|------|---------|
| **Log Work** | Billable work — service (Hourly / Custom), description, qty × rate = amount |
| **Log Expense** | Client-billable pass-through costs (kept; optional, under review) |
| **Business Costs** | AP's own overhead — not client-billable |
| **Invoice Builder** | Generate a client invoice — `AP-YYYY-MMDD-001` format |
| **New Client** / **New Project** | Add clients and projects |
| **Client Dashboard** | Per-client totals + per-project breakdown |

Services are deliberately minimal: **Hourly** (rate × qty) and **Custom / quoted**
(flat amount). Entry types: `work`, `expense`, `cost`, `invoice`.

---

## Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | Static HTML/CSS/JS | $0 |
| Invoice PDF | jsPDF (client-side, offline-capable) | $0 |
| Backend API | Google Apps Script Web App | $0 |
| Database | Google Sheets | $0 |

**Total: $0/month.** Deployment target: **`ops.absolutelyplausible.com`** (Absolutely Plausible's internal operations & invoicing app). Cloudflare Pages — pure static, no build step.

---

## Dev

```bash
python3 server.py 5500
```

Opens at `http://localhost:5500`. Pure static — no build step, no npm, no bundler.

---

## Backend setup (when ready)

The app runs fully offline on `localStorage`; Google Sheets sync is optional.

1. Create a Google Spreadsheet; copy its Sheet ID.
2. [script.google.com](https://script.google.com) → New Project → paste `google-apps-script/Code.gs`.
3. Deploy → New Deployment → Web App (Execute as: **Me** · Access: **Anyone**).
4. Paste the Web App URL into `AP.SHEETS_SCRIPT_URL` in `js/config.js` (currently empty).
5. Paste the Sheet ID into `SPREADSHEET_ID` in `google-apps-script/Code.gs` (currently empty).

---

## Brand

Absolutely Plausible cool watercolour palette — defined in `css/style.css` `:root`:

- Steel-blue `#3f7d9c` · indigo `#4b5fa8` · violet `#6a4f9e` · teal `#5cb0ad`
- Cool paper `#eef0f2` · text `#1e2238` · font **Share Tech Mono**

---

*Internal tool — Absolutely Plausible.*

---

## AI Agent Handoff

Canonical local path:
- `/Users/wmestrinho/Workspace/Projects/ap-crm`

Legacy local path:
- `/Users/wmestrinho/.openclaw/workspace/projects/ap-crm`

Before editing:
- Read `AGENTS.md`.
- Check `git status --short --branch`.
- Preserve any project-specific instructions in `CLAUDE.md`.

Deployment notes:
- Deployment not fully identified yet. Add exact deploy command/target when this repo is next touched.

Version rule:
- Current baseline version: `v1.5.1`
- Keep version source documented.
- Web UIs must visibly display the version.

Validation:
- Run `python3 scripts/validate_agent_baseline.py`.
- Also run project-specific tests/builds when present.

