# WhatsApp → CRM Lead Intake
### n8n Workflow · Absolutely Plausible Solutions

---

## What This Does

Every time someone messages your WhatsApp Business number, this workflow:

1. Receives the message via Meta's webhook
2. Parses the sender's name, phone number, and message
3. Runs keyword detection to classify the project type automatically
4. POSTs the lead straight into **AP CRM** (`crm.absolutelyplausible.com`) via its `/api/whatsapp-webhook` endpoint — no separate database required
5. Returns a `200 OK` to Meta (required within 15 seconds or they'll retry)

Leads land in the same `leads` table the CRM UI reads from, tagged `source: whatsapp`, deduplicated by phone number.

Non-text messages (images, audio, reactions, delivery receipts) are silently acknowledged and ignored — they don't create duplicate leads.

---

## Setup Steps

### Step 1 — Import the Workflow into n8n

1. Open your n8n instance
2. Go to **Workflows → Import from File**
3. Select `whatsapp-crm-workflow.json`
4. The workflow loads in draft mode (inactive by default)

---

### Step 2 — Point the "Insert Lead → AP CRM" Node at Your CRM

The workflow's HTTP Request node already targets `https://crm.absolutelyplausible.com/api/whatsapp-webhook` and posts `{ name, phone, message, project_type }` as JSON — no database credential to configure.

1. Open the **Insert Lead → AP CRM** node
2. Confirm the URL matches your deployed CRM (only change it if you're testing against a local `wrangler dev` instance)
3. If the Worker has `WEBHOOK_SECRET` set (see **Note on the shared secret** below), set an `AP_CRM_WEBHOOK_TOKEN` environment variable in your n8n instance — the node's `token` query param reads from `$env.AP_CRM_WEBHOOK_TOKEN`

> **Note on the shared secret:**
> `crm.absolutelyplausible.com` sits behind Cloudflare Access, which 302s server-to-server requests (like this one) before they reach the Worker.
> The Gumroad webhook was made reachable via a path-scoped Access **Bypass** application for `/api/gumroad-webhook`. `/api/whatsapp-webhook` needs the same treatment — ask whoever manages the Cloudflare Zero Trust dashboard to add a matching bypass for this path before going live, otherwise n8n's POST will hit the Access login page instead of the Worker.
> Once bypassed, set `WEBHOOK_SECRET` via `npx wrangler secret put WEBHOOK_SECRET` so the endpoint isn't wide open, and mirror that value into n8n's `AP_CRM_WEBHOOK_TOKEN`.

---

### Step 3 — Get Your n8n Webhook URL

1. Open the workflow in n8n
2. Click the **WhatsApp Webhook** node
3. Copy the **Test URL** (for testing) or **Production URL** (for live use)
   - It will look like: `https://your-n8n-instance.com/webhook/whatsapp-intake`

---

### Step 4 — Connect WhatsApp Business API (Meta)

You need a **Meta Developer App** connected to a WhatsApp Business account.

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an app → choose **Business** type
3. Add the **WhatsApp** product
4. Under **WhatsApp → Configuration**:
   - **Webhook URL**: paste your n8n webhook URL from Step 3
   - **Verify Token**: set any string (e.g. `aps-whatsapp-2026`) — you'll handle verification manually or via a separate GET endpoint
   - Subscribe to **messages** webhook field
5. Add a test phone number and send a message to verify it's flowing

> **Note on Webhook Verification:**
> Meta sends a GET request to verify your webhook before activation.
> n8n's webhook node only handles POST by default.
> To handle the GET verification, add a second **Webhook** node set to GET method
> that reads `hub.challenge` from query params and returns it as plain text.
> Or use a simple reverse proxy / serverless function for the one-time verification step.

---

### Step 5 — Activate the Workflow

1. Go back to your workflow in n8n
2. Toggle **Active** to ON (top right)
3. Send yourself a test WhatsApp message
4. Check the **Leads** view in AP CRM — a new row tagged `source: whatsapp` should appear within seconds

---

## Lead Status Values

New leads land with status `New`. Move them through AP CRM's standard lead pipeline as you work them — see the **Leads** view in the CRM UI:

| Status              | Meaning                          |
|---------------------|-----------------------------------|
| `New`                | Just came in, not yet reviewed   |
| `Attempted Contact`  | You've reached out, no reply yet |
| `Open`                | Actively being worked            |
| `Qualified`           | Confirmed as a real opportunity  |
| `Unqualified`         | Not a fit / not a real inquiry   |
| `Converted`           | Turned into an Account + Opportunity |

---

## Project Type Keywords (Customize These)

The **Classify Lead** node detects these keywords in the message body.
Edit the Code node directly in n8n to add your own:

| Keyword detected           | Assigned `project_type`     |
|----------------------------|-----------------------------|
| shopify, store, ecomm      | Shopify / E-Commerce        |
| web app, webapp            | Web App Development         |
| website, landing page      | Website                     |
| automation, n8n, workflow  | Automation / n8n            |
| consult, advice, strategy  | Consulting                  |
| pallet, furniture, wood    | DIY / Custom Build          |
| music, merch, print        | Robot Fantome / Merch       |
| *(none matched)*           | General Inquiry             |

---

## Next Steps (Future Improvements)

- [ ] Add a **Send WhatsApp Reply** node to auto-acknowledge the client ("Thanks for reaching out! I'll get back to you shortly.")
- [ ] Add a **Gmail** or **SMTP** node to notify yourself by email on each new lead
- [ ] Add a **Stripe** node to auto-create a customer record when a lead converts
- [ ] Add iMessage intake via Apple Business Chat or a Twilio SMS webhook (same pattern, different trigger)

---

*Generated for Absolutely Plausible Solutions · absolutelyplausible.com*
