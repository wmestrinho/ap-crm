/**
 * AP CRM — D1 API client
 * Talks to the Cloudflare Worker (/api/*). Replaces the legacy Google Sheets bridge.
 * localStorage remains a best-effort offline cache; D1 is the source of truth.
 */

const API_BASE = '/api';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// Pull the entire CRM from D1.
const apiGetAll = () => apiFetch('/all');

// Mutations. Each maps to one row operation on the matching table.
const apiCreate = (entity, row) =>
  apiFetch(`/${entity}`, { method: 'POST', body: JSON.stringify(row) });

const apiUpdate = (entity, id, fields) =>
  apiFetch(`/${entity}/${id}`, { method: 'PUT', body: JSON.stringify(fields) });

const apiDelete = (entity, id) =>
  apiFetch(`/${entity}/${id}`, { method: 'DELETE' });

/* ── Offline sync queue ───────────────────────────────────────────
 * When a write can't reach D1 (offline / API error) the row still lives
 * in localStorage; we also record the operation here so it can be retried
 * later — on next load, on a manual Refresh, or when the browser fires an
 * 'online' event. The queue is collapsed per (entity, id) so it can't grow
 * without bound and so offline create→edit→delete chains resolve to the
 * minimal set of operations.
 */
const PENDING_KEY = 'ap_pending_sync';

function loadPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
  catch { return []; }
}

function savePending(queue) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
}

function pendingSyncCount() {
  return loadPending().length;
}

// Record one failed op, collapsing any prior op on the same row.
function enqueuePending(op, entity, id, payload) {
  const queue = loadPending();
  const prior = queue.find(e => e.entity === entity && e.id === id);
  const rest = queue.filter(e => !(e.entity === entity && e.id === id));

  if (op === 'delete') {
    // Deleting a row that only ever existed locally cancels its create.
    if (prior && prior.op === 'create') { savePending(rest); return; }
    rest.push({ op: 'delete', entity, id });
  } else if (op === 'create') {
    rest.push({ op: 'create', entity, id, payload });
  } else { // update — fold into a still-unsynced create/update for this row
    if (prior && prior.op === 'create') {
      rest.push({ op: 'create', entity, id, payload: { ...prior.payload, ...payload } });
    } else if (prior && prior.op === 'update') {
      rest.push({ op: 'update', entity, id, payload: { ...prior.payload, ...payload } });
    } else {
      rest.push({ op: 'update', entity, id, payload });
    }
  }
  savePending(rest);
}

// Write-through helpers: try D1, queue on failure. Return true if synced.
async function syncCreate(entity, row) {
  try { await apiCreate(entity, row); return true; }
  catch { enqueuePending('create', entity, row.id, row); return false; }
}

async function syncUpdate(entity, id, fields) {
  try { await apiUpdate(entity, id, fields); return true; }
  catch { enqueuePending('update', entity, id, fields); return false; }
}

async function syncDelete(entity, id) {
  try { await apiDelete(entity, id); return true; }
  catch { enqueuePending('delete', entity, id); return false; }
}

// Retry every queued op; keep whatever still fails for next time.
async function flushPending() {
  const queue = loadPending();
  if (!queue.length) return { flushed: 0, remaining: 0 };
  const remaining = [];
  let flushed = 0;
  for (const e of queue) {
    try {
      if (e.op === 'create') await apiCreate(e.entity, e.payload);
      else if (e.op === 'update') await apiUpdate(e.entity, e.id, e.payload);
      else if (e.op === 'delete') await apiDelete(e.entity, e.id);
      flushed++;
    } catch {
      remaining.push(e);
    }
  }
  savePending(remaining);
  return { flushed, remaining: remaining.length };
}
