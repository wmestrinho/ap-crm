# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project

**AP CRM** — Absolutely Plausible's customer relationship management app. Manages the full sales pipeline: leads, contacts, accounts, opportunities, and activities. Pure static HTML/CSS/JS — no build step, no npm.

## Domain model

The app is organized around **Accounts** (companies/organizations). Each Account has one or more **Contacts** and **Opportunities**.

- **Leads** — potential prospects before qualification (`New`, `Attempted Contact`, `Open`, `Qualified`, `Unqualified`, `Converted`)
- **Accounts** — companies/organizations that AP works with or targets
- **Contacts** — people at accounts (name, role, email, phone)
- **Opportunities** — potential deals in the sales pipeline
  - Stages: `Prospecting` → `Qualification` → `Needs Analysis` → `Value Proposition` → `Id. Decision Makers` → `Perception Analysis` → `Proposal/Price Quote` → `Negotiation/Review` → `Closed Won` / `Closed Lost`
- **Activities** — interactions with contacts/leads (`Call`, `Meeting`, `Email`, `Task`, `Other`)
- **Templates** — pre-built activity sequences for common sales motions

## Dev Server

```bash
python3 server.py 5500
```

Serves the app at `http://localhost:5500` with no-cache headers. The app is pure static HTML/CSS/JS — no build step, no npm, no bundler.

## Deployment

Target: **`crm.absolutelyplausible.com`** (Absolutely Plausible's CRM). Pure static — deploy via Cloudflare Pages with no build command, output directory `/`. `server.py` is local dev only. The Cloudflare Pages project + DNS + (optional) Access gate are set up in the Cloudflare dashboard.

## Version Bumping

Single source of truth: `AP.version` in `js/config.js`. It populates the header badge, menu header, and footer automatically via `init()`. Bump in the same commit as the change.

| Change | Bump |
|--------|------|
| Bug fix, style tweak | PATCH (e.g. v1.0.0 → v1.0.1) |
| New feature | MINOR (e.g. v1.0.x → v1.1.0) |

## Architecture

Single-page application. All views live in `index.html` as `<div class="view">` elements. Navigation is `go(viewId)` in `js/app.js`, which toggles the `active` class.

**JS load order matters** (all via `<script>` tags in `index.html`):
1. `js/config.js` — `AP` config object + `STATE` (in-memory, backed by localStorage) + persistence helpers
2. `js/sheets.js` — Google Sheets API layer
3. `js/app.js` — all UI logic, form handlers, dashboard, activity logging

**Data flow:**
- Every form submit: saves to `STATE` (localStorage) first, then fires-and-forgets to Google Sheets
- Dashboard reads exclusively from `STATE` — fully offline
- Sheets writes are GET requests to work around CORS/redirect limitations

**Views (`<div class="view">` IDs):** `mainMenu`, `logActivity`, `logExpense`, `invoiceBuilder`, `newCustomer`, `newProject`, `workCosts`, `clientDashboard`

Note: The domain model defines CRM entities (accounts, contacts, leads, opportunities, activities) but the current views are carried over from the AP Ops app foundation. The CRM-specific views (lead list, opportunity pipeline, contact management) are yet to be built. The data layer in `js/config.js` already supports the full CRM model — the UI needs to catch up.

## localStorage Keys

| Key | Contents |
|-----|----------|
| `ap_user` | current operator name |
| `ap_account` | current account name |
| `ap_contact` | current contact name |
| `ap_opportunity` | current opportunity name |
| `ap_lead` | current lead name |
| `ap_accounts` | account list |
| `ap_contacts` | contact list |
| `ap_leads` | lead list |
| `ap_opportunities` | opportunity list |
| `ap_activities` | activity log entries |
| `ap_local_entries` | legacy Ops entries (work/expense/cost/invoice) |
| `ap_clients` | legacy client list |
| `ap_projects` | legacy project list |
| `ap_local_clients` | legacy client autocomplete list |

## Google Apps Script Backend

`google-apps-script/Code.gs` is the authoritative source. To deploy changes:

1. Copy the full file contents
2. Go to [script.google.com](https://script.google.com), open the project, paste and replace
3. Create a **New Deployment** (always new — never redeploy existing)
4. Copy the new URL into `AP.SHEETS_SCRIPT_URL` in `js/config.js`

`AP.SHEETS_SCRIPT_URL` in `config.js` is currently empty — configure AP's own Google Sheet when wiring the backend.

Sheet tabs: `Leads`, `Accounts`, `Contacts`, `Opportunities`, `Activities`.

## Assets

Only `assets/ap-logo.png` is tracked in git. Everything else in `assets/` is gitignored (marketing images, videos, PDFs — kept locally but not deployed). Do not add other files to `assets/` without updating `.gitignore`.
