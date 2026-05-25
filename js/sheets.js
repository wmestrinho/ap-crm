/**
 * AP CRM | Google Sheets bridge (Phase 2)
 * Best-effort sync: localStorage remains source of truth if offline.
 */

async function sheetsPost(action, payload) {
  const url = AP.SHEETS_SCRIPT_URL;
  if (!url || url.includes('YOUR_SCRIPT_ID')) {
    return { ok: true, offline: true };
  }
  try {
    const params = new URLSearchParams({
      action,
      payload: JSON.stringify(payload || {})
    });
    const res = await fetch(`${url}?${params}`, { method: 'GET', redirect: 'follow' });
    return await res.json();
  } catch (err) {
    throw err;
  }
}

async function syncLead(payload) {
  return sheetsPost('crmLogLead', payload);
}

async function syncAccount(payload) {
  return sheetsPost('crmLogAccount', payload);
}

async function syncContact(payload) {
  return sheetsPost('crmLogContact', payload);
}

async function syncOpportunity(payload) {
  return sheetsPost('crmLogOpportunity', payload);
}

async function syncActivity(payload) {
  return sheetsPost('crmLogActivity', payload);
}
