# WhatsApp → CRM Lead Intake

Meta's WhatsApp Business webhook is handled **directly by the AP CRM Worker** — no third-party workflow tool (n8n, Zapier, etc.) sits in between. Every inbound WhatsApp message:

1. Arrives at `POST /api/whatsapp-webhook` on `crm.absolutelyplausible.com`
2. Gets parsed and keyword-classified into a `project_type` (see `WHATSAPP_PROJECT_KEYWORDS` in `worker/index.js`)
3. Is inserted straight into the CRM's `leads` table (`source: whatsapp`), deduplicated by phone number
4. Gets a `200 OK` back within Meta's 15-second window

Non-text messages (images, audio, reactions, delivery-status callbacks) are acknowledged and ignored — they don't create leads.

---

## Setup Steps

### Step 1 — Set the Verify Token

Meta's one-time verification handshake compares a token you choose against `WHATSAPP_VERIFY_TOKEN`:

```bash
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
```

Pick any string (e.g. `aps-whatsapp-2026`) — you'll enter the same value in Meta's app config in Step 3.

### Step 2 — (Optional) Require a Shared Secret

The endpoint reuses the same `WEBHOOK_SECRET` as the Gumroad webhook. If it's set, append `?token=<secret>` to the Webhook URL you give Meta in Step 3 — Meta preserves query params on both the verification GET and every message POST.

```bash
npx wrangler secret put WEBHOOK_SECRET   # skip if already set for Gumroad
```

### Step 3 — Connect WhatsApp Business API (Meta)

You need a **Meta Developer App** connected to a WhatsApp Business account.

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an app → choose **Business** type
3. Add the **WhatsApp** product
4. Under **WhatsApp → Configuration**:
   - **Webhook URL**: `https://crm.absolutelyplausible.com/api/whatsapp-webhook` (append `?token=<WEBHOOK_SECRET>` if you set one in Step 2)
   - **Verify Token**: the same value you set as `WHATSAPP_VERIFY_TOKEN` in Step 1
   - Subscribe to the **messages** webhook field
5. Add a test phone number and send a message to verify it's flowing

### Step 4 — Confirm the Access Bypass

`crm.absolutelyplausible.com` sits behind Cloudflare Access, which 302s server-to-server callers (like Meta) before they reach the Worker. `/api/gumroad-webhook` already has a path-scoped Access **Bypass** application; `/api/whatsapp-webhook` needs the same one added in the Cloudflare Zero Trust dashboard before Meta's verification handshake or message deliveries can reach the Worker.

### Step 5 — Verify End-to-End

1. Send yourself a test WhatsApp message
2. Check the **Leads** view in AP CRM — a new row tagged `source: whatsapp` should appear within seconds

---

## Lead Status Values

New leads land with status `New`. Move them through AP CRM's standard lead pipeline as you work them:

| Status | Meaning |
|--------|---------|
| `New` | Just came in, not yet reviewed |
| `Attempted Contact` | You've reached out, no reply yet |
| `Open` | Actively being worked |
| `Qualified` | Confirmed as a real opportunity |
| `Unqualified` | Not a fit / not a real inquiry |
| `Converted` | Turned into an Account + Opportunity |

---

## Project Type Keywords (Customize These)

Edit `WHATSAPP_PROJECT_KEYWORDS` in `worker/index.js` to add your own:

| Keyword detected | Assigned `project_type` |
|-------------------|--------------------------|
| shopify, store, ecomm | Shopify / E-Commerce |
| web app, webapp, application | Web App Development |
| website, landing page, portfolio | Website |
| automation, n8n, workflow, zapier | Automation / n8n |
| consult, advice, strategy | Consulting |
| pallet, furniture, wood | DIY / Custom Build |
| music, merch, print, sticker | Robot Fantome / Merch |
| *(none matched)* | General Inquiry |

---

## Next Steps (Future Improvements)

- [ ] Send an auto-acknowledge WhatsApp reply on new-lead creation (Meta's Cloud API `/messages` endpoint)
- [ ] Notify on each new lead (e.g. an email via a Worker `fetch` to a transactional-email API)
- [ ] Auto-create a customer record when a lead converts
- [ ] Add iMessage / SMS intake via a second webhook endpoint (same pattern, different trigger)

---

*Absolutely Plausible Solutions · absolutelyplausible.com*
