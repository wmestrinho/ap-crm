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
  return env.DB
    .prepare(`INSERT INTO ${entity} (${cols.join(', ')}) VALUES (${placeholders})`)
    .bind(...values);
}

async function handleApi(request, env, url) {
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [entity, id] = parts;

  if (entity === 'gumroad-webhook') return handleGumroad(request, env);

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
