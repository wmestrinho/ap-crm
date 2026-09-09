# AP CRM | Absolutely Plausible

**Absolutely Plausible's customer relationship management app**

Separate surface from AP Ops, but reachable from the AP Ops UI and kept in the same brand family
(cool watercolour palette, Share Tech Mono).

**Status:** live/gated at `crm.absolutelyplausible.com`

**Version:** `1.10.0`

## Scope

- Leads
- Accounts
- Contacts
- Opportunities
- Activities

## Relationship to AP Ops

- Separate repo: `ap-crm`
- Linked from AP Ops, but not merged into it

## Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | Static HTML/CSS/JS | $0 |
| Backend API | Cloudflare Worker | $0 (free tier) |
| Database | Cloudflare D1 | $0 (free tier) |

Deployment target: **`crm.absolutelyplausible.com`** — a Cloudflare Worker (`absolutely-plausible-crm`) serves the static assets and the `/api/*` JSON API in one deploy; no build step.

## Dev

```bash
npx wrangler dev
```

Runs the Worker locally with the static assets and a local D1 database, so `/api/*` works end to end.

```bash
python3 server.py 5500   # static-only, no API — falls back to the localStorage cache
```

## Deployment

```bash
npx wrangler d1 migrations apply ap-crm --remote   # apply pending schema changes first
npx wrangler deploy                                # deploy the Worker + assets
```

See `CLAUDE.md` for the full API route table, schema/migration workflow, and webhook integrations (Gumroad, WhatsApp via n8n).

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
- Cloudflare Worker deploy (`npx wrangler deploy`), not Pages — see **Deployment** above

Version rule:
 - Current baseline version: `1.10.0`
- Keep version source documented.
- Web UIs must visibly display the version.

Validation:
- Run `python3 scripts/validate_agent_baseline.py`.
- Also run project-specific tests/builds when present.
