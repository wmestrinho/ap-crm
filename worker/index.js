/**
 * AP CRM — Cloudflare Worker
 * Serves the static frontend (env.ASSETS) and a small JSON API backed by D1.
 *
 * Routes (only /api/* reaches this Worker; see run_worker_first in wrangler.jsonc):
 *   GET    /api/all                 → { ok, accounts, contacts, leads, opportunities, activities }
 *   GET    /api/:entity             → [ ...rows ]
 *   POST   /api/:entity             → insert a row (body = full object)
 *   PUT    /api/:entity/:id         → update provided fields
 *   DELETE /api/:entity/:id         → delete (accounts/contacts cascade by name)
 *   POST   /api/gumroad-webhook     → Gumroad Ping → insert a lead (source=gumroad)
 *   GET    /api/whatsapp-webhook    → Meta webhook verification handshake
 *   POST   /api/whatsapp-webhook    → Meta WhatsApp message → insert a lead (source=whatsapp)
 */

// Column allowlist per table — also the entity → table map.
const TABLES = {
  accounts:      ['id', 'name', 'industry', 'website', 'notes', 'owner', 'createdAt'],
  contacts:      ['id', 'account', 'name', 'role', 'email', 'phone', 'owner', 'createdAt'],
  leads:         ['id', 'name', 'company', 'email', 'phone', 'status', 'notes', 'owner', 'source', 'createdAt'],
  opportunities: ['id', 'account', 'name', 'stage', 'value', 'closeDate', 'notes', 'owner', 'createdAt'],
  activities:    ['id', 'type', 'subject', 'relatedType', 'relatedName', 'dueDate', 'status', 'notes', 'owner', 'createdAt'],
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const uuid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);

async function listAll(env) {
  const out = {};
  for (const entity of Object.keys(TABLES)) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${entity} ORDER BY createdAt ASC`).all();
    out[entity] = results || [];
  }
  return out;
}

// Build an INSERT from the allowlisted columns present in `row`.
function insertStmt(env, entity, row) {
  const cols = TABLES[entity].filter((c) => row[c] !== undefined && row[c] !== null);
  if (!cols.includes('id')) cols.unshift('id');
  const values = cols.map((c) => (c === 'id' ? row.id || uuid() : row[c]));
  const placeholders = cols.map(() => '?').join(', ');
  // INSERT OR REPLACE so retrying an offline-queued create that actually
  // half-succeeded is idempotent (same id) instead of erroring forever.
  return env.DB
    .prepare(`INSERT OR REPLACE INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`)
    .bind(...values);
}

async function handleApi(request, env, url) {
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [entity, id] = parts;

  if (entity === 'gumroad-webhook') return handleGumroad(request, env);
  if (entity === 'whatsapp-webhook') return handleWhatsapp(request, env);

  if (entity === 'all' && request.method === 'GET') {
    return json({ ok: true, ...(await listAll(env)) });
  }

  if (!TABLES[entity]) return json({ ok: false, error: 'unknown entity' }, 404);

  // GET /api/:entity → list
  if (request.method === 'GET' && !id) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${entity} ORDER BY createdAt ASC`).all();
    return json(results || []);
  }

  // POST /api/:entity → insert
  if (request.method === 'POST' && !id) {
    const row = await request.json().catch(() => null);
    if (!row || typeof row !== 'object') return json({ ok: false, error: 'invalid body' }, 400);
    if (!row.id) row.id = uuid();
    await insertStmt(env, entity, row).run();
    return json({ ok: true, row });
  }

  // PUT /api/:entity/:id → update provided allowlisted fields
  if (request.method === 'PUT' && id) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid body' }, 400);
    const cols = TABLES[entity].filter((c) => c !== 'id' && c in body);
    if (!cols.length) return json({ ok: false, error: 'no updatable fields' }, 400);
    const setClause = cols.map((c) => `${c} = ?`).join(', ');
    const values = cols.map((c) => body[c]);
    await env.DB.prepare(`UPDATE ${entity} SET ${setClause} WHERE id = ?`).bind(...values, id).run();
    return json({ ok: true });
  }

  // DELETE /api/:entity/:id → delete (+ cascade by name for accounts/contacts)
  if (request.method === 'DELETE' && id) {
    const stmts = [];
    if (entity === 'accounts') {
      const acct = await env.DB.prepare('SELECT name FROM accounts WHERE id = ?').bind(id).first();
      if (acct?.name) {
        stmts.push(env.DB.prepare('DELETE FROM contacts WHERE account = ?').bind(acct.name));
        stmts.push(env.DB.prepare('DELETE FROM opportunities WHERE account = ?').bind(acct.name));
        stmts.push(env.DB.prepare("DELETE FROM activities WHERE relatedType = 'account' AND relatedName = ?").bind(acct.name));
      }
    } else if (entity === 'contacts') {
      const c = await env.DB.prepare('SELECT name FROM contacts WHERE id = ?').bind(id).first();
      if (c?.name) {
        stmts.push(env.DB.prepare("DELETE FROM activities WHERE relatedType = 'contact' AND relatedName = ?").bind(c.name));
      }
    }
    stmts.push(env.DB.prepare(`DELETE FROM ${entity} WHERE id = ?`).bind(id));
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
}

// Gumroad Ping posts application/x-www-form-urlencoded. We also accept JSON.
// Optional shared secret: set WEBHOOK_SECRET and pass ?token=... on the Ping URL.
async function handleGumroad(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const url = new URL(request.url);
  if (env.WEBHOOK_SECRET && url.searchParams.get('token') !== env.WEBHOOK_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let data = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    }
  } catch {
    return json({ ok: false, error: 'unparseable body' }, 400);
  }

  const email = (data.email || data.purchaser_email || '').toString().trim();
  if (!email) return json({ ok: false, error: 'no email in payload' }, 400);

  const name = (data.full_name || data.name || email.split('@')[0]).toString().trim();
  const company = (data.product_name || '').toString().trim();

  // Idempotent: skip if this email already arrived from Gumroad.
  const existing = await env.DB
    .prepare("SELECT id FROM leads WHERE email = ? AND source = 'gumroad'")
    .bind(email)
    .first();
  if (existing) return json({ ok: true, deduped: true });

  const row = {
    id: uuid(),
    name,
    company,
    email,
    phone: '',
    status: 'New',
    notes: 'Imported from Gumroad',
    owner: '',
    source: 'gumroad',
    createdAt: new Date().toISOString(),
  };
  await insertStmt(env, 'leads', row).run();
  return json({ ok: true, created: true });
}

// Keyword → project-type classification for inbound WhatsApp messages.
const WHATSAPP_PROJECT_KEYWORDS = [
  { match: ['shopify', 'store', 'ecomm'], type: 'Shopify / E-Commerce' },
  { match: ['web app', 'webapp', 'application'], type: 'Web App Development' },
  { match: ['website', 'landing page', 'portfolio'], type: 'Website' },
  { match: ['automation', 'n8n', 'workflow', 'zapier'], type: 'Automation / n8n' },
  { match: ['consult', 'advice', 'strategy'], type: 'Consulting' },
  { match: ['pallet', 'furniture', 'wood'], type: 'DIY / Custom Build' },
  { match: ['music', 'merch', 'print', 'sticker'], type: 'Robot Fantome / Merch' },
];

function classifyWhatsappLead(message) {
  const lower = message.toLowerCase();
  for (const { match, type } of WHATSAPP_PROJECT_KEYWORDS) {
    if (match.some((kw) => lower.includes(kw))) return type;
  }
  return 'General Inquiry';
}

// Meta calls this endpoint directly — no middleman workflow tool.
// GET is the one-time verification handshake (WhatsApp → Configuration → Webhook).
// POST delivers each inbound message event; must always ack fast with 200 or Meta retries.
// Optional shared secret: set WEBHOOK_SECRET and append ?token=... to the Webhook URL you give Meta.
async function handleWhatsapp(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') || '';
    if (mode === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
    }
    return json({ ok: false, error: 'verification failed' }, 403);
  }

  if (request.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  if (env.WEBHOOK_SECRET && url.searchParams.get('token') !== env.WEBHOOK_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const body = await request.json().catch(() => null);
  // Ack malformed/unrelated payloads (e.g. status callbacks) so Meta doesn't retry forever.
  if (!body || typeof body !== 'object') return json({ ok: true, ignored: true });

  const value = body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message || message.type !== 'text') return json({ ok: true, ignored: true });

  const phone = (message.from || '').toString().trim();
  if (!phone) return json({ ok: true, ignored: true });

  const contact = value.contacts?.[0];
  const name = (contact?.profile?.name || 'Unknown').toString().trim();
  const text = (message.text?.body || '').toString().trim();
  const projectType = classifyWhatsappLead(text);
  const notes = [`Project type: ${projectType}`, text].filter(Boolean).join('\n');

  // Idempotent: skip if this phone number already arrived from WhatsApp.
  const existing = await env.DB
    .prepare("SELECT id FROM leads WHERE phone = ? AND source = 'whatsapp'")
    .bind(phone)
    .first();
  if (existing) return json({ ok: true, deduped: true });

  const row = {
    id: uuid(),
    name,
    company: '',
    email: '',
    phone,
    status: 'New',
    notes,
    owner: '',
    source: 'whatsapp',
    createdAt: new Date().toISOString(),
  };
  await insertStmt(env, 'leads', row).run();
  return json({ ok: true, created: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ ok: false, error: String(err && err.message || err) }, 500);
      }
    }
    // Non-API paths: serve the static frontend.
    return env.ASSETS.fetch(request);
  },
};
