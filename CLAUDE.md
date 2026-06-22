# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project

**AP CRM** — Absolutely Plausible's customer relationship management app. Manages the full sales pipeline: leads, contacts, accounts, opportunities, and activities. Static HTML/CSS/JS frontend (no build step, no npm) served by a Cloudflare Worker that also exposes a JSON API backed by D1.

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
npx wrangler dev
```

Runs the Worker locally with the static assets and a **local** D1 database (`.wrangler/state`), so the `/api/*` routes work end to end. This is the correct way to develop now that the frontend depends on the Worker API.

```bash
python3 server.py 5500   # static-only, no API
```

`server.py` serves the static files with no-cache headers but does **not** provide `/api/*` — the app falls back to its localStorage cache and shows "sync failed" toasts on writes. Use it only for pure UI/CSS work.

## Deployment

Target: **`crm.absolutelyplausible.com`** (Absolutely Plausible's CRM). Deployed as a **Cloudflare Worker** (`absolutely-plausible-crm`) — the Worker serves the static assets and the `/api/*` JSON API.

```bash
npx wrangler d1 migrations apply ap-crm --remote   # apply pending schema changes first
npx wrangler deploy                                # deploy the Worker + assets
```

Config lives in `wrangler.jsonc`: `main` = `worker/index.js`, the `ASSETS` binding serves the repo root, `run_worker_first: ["/api/*"]` routes only API paths to the Worker, and the `DB` binding points at the `ap-crm` D1 database. `.assetsignore` keeps repo internals (`.git/`, `.claude/`, `worker/`, `migrations/`, `.wrangler/`, `*.map`, docs, etc.) off the live site — keep it current when adding non-public files. DNS / custom domain / (optional) Access gate are configured in the Cloudflare dashboard.

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
2. `js/api.js` — D1 API client (`apiGetAll`, `apiCreate`, `apiUpdate`, `apiDelete`); talks to `/api/*`
3. `js/app.js` — all UI logic, form handlers, dashboard, activity logging

**Data flow:**
- **D1 is the source of truth; localStorage is a best-effort offline cache.**
- On load, `refreshFromDB()` calls `GET /api/all` and merges by `id` — remote rows win, local-only rows that never synced are retained as a safety net.
- Every mutation writes to `STATE` (localStorage) first, then writes through to D1 via `js/api.js`. If the API call fails, the row stays local and the UI shows a "Saved locally — sync failed" toast.
- The dashboard reads from `STATE`, so it stays usable offline.

**Views (`<div class="view">` IDs):** `mainMenu`, `logActivity`, `logExpense`, `invoiceBuilder`, `newCustomer`, `newProject`, `workCosts`, `clientDashboard`

All CRM views are built: Leads, Accounts, Contacts, Opportunities (pipeline), and Activities — each with search/filter, CSV export, and full CRUD. As of v1.7.0 the data layer is backed by Cloudflare D1 via the Worker API (see **Backend** below).

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

## Backend: Cloudflare Worker + D1

The backend is a single Worker (`worker/index.js`) bound to a D1 database (`ap-crm`). It serves the static frontend via the `ASSETS` binding and handles the `/api/*` routes (only those reach the Worker; see `run_worker_first` in `wrangler.jsonc`).

**API routes:**

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/api/all` | `{ ok, accounts, contacts, leads, opportunities, activities }` |
| `GET` | `/api/:entity` | list rows for one entity |
| `POST` | `/api/:entity` | insert a row (body = full object; `id` auto-filled if absent) |
| `PUT` | `/api/:entity/:id` | update the provided allowlisted fields |
| `DELETE` | `/api/:entity/:id` | delete; `accounts`/`contacts` cascade by **name** to related rows |
| `POST` | `/api/gumroad-webhook` | Gumroad Ping → insert a `lead` (`source=gumroad`), idempotent by email |

`:entity` is one of `accounts`, `contacts`, `leads`, `opportunities`, `activities`. Each maps to a D1 table with a per-table column allowlist (`TABLES` in `worker/index.js`) — add new columns there **and** in a migration. Relationships are stored by name (matching the frontend), not by foreign key.

**Schema:** `migrations/0001_init.sql` defines the 5 tables. To change the schema:

```bash
npx wrangler d1 migrations create ap-crm <description>   # scaffold a new migration
# edit the generated migrations/000N_*.sql
npx wrangler d1 migrations apply ap-crm --local          # test locally
npx wrangler d1 migrations apply ap-crm --remote          # apply to production
```

**Gumroad integration:** point a Gumroad Ping at the deployed `/api/gumroad-webhook`. Subscribers land as leads deduped by email. To require a shared secret, set `WEBHOOK_SECRET` (`npx wrangler secret put WEBHOOK_SECRET`) and append `?token=<secret>` to the Ping URL.

**Note:** `AP.SHEETS_SCRIPT_URL` in `js/config.js` is now vestigial — the CRM no longer writes to Google Sheets. (AP Ops at `ops.absolutelyplausible.com` still uses the Apps Script backend independently.)

## Assets

Only `assets/ap-logo.png` is tracked in git. Everything else in `assets/` is gitignored (marketing images, videos, PDFs — kept locally but not deployed). Do not add other files to `assets/` without updating `.gitignore`.
