# AP CRM | Absolutely Plausible

**Absolutely Plausible's customer relationship management app**

Separate surface from AP Ops, but reachable from the AP Ops UI and kept in the same brand family
(cool watercolour palette, Share Tech Mono).

**Status:** live/gated at `crm.absolutelyplausible.com`

**Version:** `v1.6.0`

## Scope

- Leads
- Accounts
- Contacts
- Opportunities
- Activities

## Relationship to AP Ops

- Separate repo: `ap-crm`
- Linked from AP Ops, but not merged into it
- Shared backend pattern with AP Ops until the CRM handlers are fully built

## Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | Static HTML/CSS/JS | $0 |
| CRM UI | Static HTML/CSS/JS | $0 |
| Backend API | Google Apps Script Web App | $0 |
| Database | Google Sheets | $0 |

**Total: $0/month.** Deployment target: **`crm.absolutelyplausible.com`**. Cloudflare Pages - pure static, no build step.

## Dev

```bash
python3 server.py 5500
```

Opens at `http://localhost:5500`. Pure static - no build step, no npm, no bundler.

## TODO

- Build the CRM-specific views for leads, accounts, contacts, and opportunities
- Finish the CRM Apps Script handlers so CRM entities persist cleanly
- Keep the AP Ops link prominent so the two apps stay connected but separate

## Backend setup

1. Create a Google Spreadsheet; copy its Sheet ID.
2. [script.google.com](https://script.google.com) -> New Project -> paste `google-apps-script/Code.gs`.
3. Deploy -> New Deployment -> Web App (Execute as: **Me** | Access: **Anyone**).
4. Paste the Web App URL into `AP.SHEETS_SCRIPT_URL` in `js/config.js` (currently empty).
5. Paste the Sheet ID into `SPREADSHEET_ID` in `google-apps-script/Code.gs` (currently empty).

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
- Deployment target: `crm.absolutelyplausible.com`
- Cloudflare Pages static deploy

Version rule:
 - Current baseline version: `v1.6.0`
- Keep version source documented.
- Web UIs must visibly display the version.

Validation:
- Run `python3 scripts/validate_agent_baseline.py`.
- Also run project-specific tests/builds when present.
