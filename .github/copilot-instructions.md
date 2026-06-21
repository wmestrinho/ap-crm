# Copilot instructions — AP CRM

Authoritative agent guidance for this repo lives in [`CLAUDE.md`](../CLAUDE.md).
This file mirrors the key rules so Copilot's inline help stays aligned.

## What this repo is
**AP CRM** — Absolutely Plausible's CRM at `crm.absolutelyplausible.com`. Pure
static HTML/CSS/JS (no build, no npm) on Cloudflare Pages. Manages the sales
pipeline: Leads → Accounts → Contacts → Opportunities → Activities.

## Rules that matter
- **Version: single source of truth is `AP.version` in `js/config.js`.** Bump in
  the same commit (PATCH = fix/style, MINOR = feature).
- **SPA shape:** views are `<div class="view">` in `index.html`; navigation is
  `go(viewId)` in `js/app.js`. JS load order matters (config → sheets → app).
- **Data flow:** form submits save to `STATE`/localStorage first, then
  fire-and-forget to Google Sheets (GET requests; opaque responses).
- **Shared backend:** the Apps Script + Google Sheet are shared with AP Ops. A new
  `Code.gs` deployment URL must be copied into **both** `ap-crm/js/config.js` and
  `absolutely-plausible-ops/js/config.js`.
- **No frameworks/bundlers/npm.** Keep it static.

## Paired sources of truth — never auto-edit without review
- `VERSION` / footer version ↔ `js/config.js` `AP.version`.
- `AP.SHEETS_SCRIPT_URL` must match across ap-crm **and** ap-ops.
Copilot has no cross-file awareness of these pairings.

## Division of labor
Copilot: inline completions, in-editor explanations, JSDoc, view/form boilerplate.
Leave cross-repo reasoning, the shared backend deploy, and secrets to Claude Code.

## Commits
Convention: `type(scope): subject`.
