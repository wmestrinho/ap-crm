/**
 * AP CRM | Google Sheets bridge
 * Best-effort sync + pull
 */

async function sheetsPost(action, payload) {
  const url = AP.SHEETS_SCRIPT_URL;
  if (!url || url.includes('YOUR_SCRIPT_ID')) return { ok: true, offline: true };
  const params = new URLSearchParams({ action, payload: JSON.stringify(payload || {}) });
  const res = await fetch(`${url}?${params}`, { method: 'GET', redirect: 'follow' });
  return await res.json();
}

const syncLead = (payload) => sheetsPost('crmLogLead', payload);
const syncAccount = (payload) => sheetsPost('crmLogAccount', payload);
const syncContact = (payload) => sheetsPost('crmLogContact', payload);
const syncOpportunity = (payload) => sheetsPost('crmLogOpportunity', payload);
const syncActivity = (payload) => sheetsPost('crmLogActivity', payload);

const fetchCRMAll = () => sheetsPost('crmGetAll', {});
