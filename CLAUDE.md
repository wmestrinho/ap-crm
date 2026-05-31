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

All CRM views are built: Leads, Accounts, Contacts, Opportunities (pipeline), and Activities — each with search/filter, CSV export, and full CRUD. The data layer and UI are in sync as of v1.6.0.

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

The AP CRM shares the same Apps Script backend and Google Sheet as AP Ops (mech.robotfantome.com). Both apps write to the same spreadsheet via the same deployed Web App.

To deploy changes to the shared backend:

1. Copy the full `Code.gs` contents
2. Go to [script.google.com](https://script.google.com), open the project, paste and replace
3. Create a **New Deployment** (always new — never redeploy existing)
4. Copy the new URL into `AP.SHEETS_SCRIPT_URL` in **both** `ap-crm/js/config.js` AND `absolutely-plausible-ops/js/config.js`

`SPREADSHEET_ID` in `Code.gs` points to AP's shared Google Sheet.

Sheet tabs: `Clients`, `Projects` are global. Each client gets four per-client tabs: `{Client}_Work`, `{Client}_Expenses`, `{Client}_Costs`, `{Client}_Invoices`.

Note: The CRM-specific entities (Accounts, Contacts, Leads, Opportunities, Activities) are defined in `js/config.js` but don't yet have corresponding Apps Script handlers. Until those are added, only the Ops-origin entities (Clients, Projects, Work, Expenses, Costs, Invoices) are persisted to Sheets.

## Assets

Only `assets/ap-logo.png` is tracked in git. Everything else in `assets/` is gitignored (marketing images, videos, PDFs — kept locally but not deployed). Do not add other files to `assets/` without updating `.gitignore`.
