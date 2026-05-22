/**
 * AP Ops | Absolutely Plausible — Google Sheets API
 * Talks to the deployed Google Apps Script web app.
 * Uses GET with URL params — Apps Script returns JSON with CORS headers.
 */

async function sheetsPost(action, payload) {
  const url = AP.SHEETS_SCRIPT_URL;
  if (!url || url.includes('YOUR_SCRIPT_ID')) {
    // No backend configured — run offline (localStorage only)
    console.log('[OFFLINE] sheetsPost skipped:', action);
    return { ok: true, dev: true };
  }
  try {
    const params = new URLSearchParams({
      action,
      payload: JSON.stringify(payload),
    });
    const res = await fetch(`${url}?${params}`, {
      method: 'GET',
      redirect: 'follow',
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[Sheets Error]', err);
    throw err;
  }
}

async function pushWork(data) {
  return sheetsPost('logWork', data);
}

async function pushExpense(data) {
  return sheetsPost('logExpense', data);
}

async function logWorkCosts(data) {
  return sheetsPost('logCost', data);
}

async function logNewCustomer(data) {
  return sheetsPost('logNewClient', data);
}

async function logNewProject(data) {
  return sheetsPost('logNewProject', data);
}

async function logInvoice(data) {
  return sheetsPost('logInvoice', data);
}

async function getClientSummary(clientName) {
  return sheetsPost('getClientSummary', { client: clientName });
}

async function getClients() {
  return sheetsPost('getClients', {});
}

async function getProjects() {
  return sheetsPost('getProjects', {});
}

function loadClientDatalist() {
  const dl = document.getElementById('clientList');
  if (!dl) return;

  // Seed from local cache immediately (works offline)
  const render = (names) => {
    dl.innerHTML = [...new Set(names)].sort()
      .map(n => `<option value="${n}">`)
      .join('');
  };
  render(STATE.localClients);

  // Attempt to merge from Sheets in background
  getClients().then(res => {
    if (res && res.clients && res.clients.length) {
      res.clients.forEach(n => saveLocalClient(n));
      render(STATE.localClients);
    }
  }).catch(() => {});
}

function loadProjectDatalist() {
  const dl = document.getElementById('projectList');
  if (!dl) return;
  const names = [...new Set(STATE.projects.map(p => p.name))].sort();
  dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
}
