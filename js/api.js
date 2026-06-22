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
