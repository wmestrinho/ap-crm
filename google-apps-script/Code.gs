/**
 * AP Ops | Absolutely Plausible — Google Apps Script Backend
 * Deploy as Web App: Execute as Me, Anyone can access.
 * Paste the deployment URL into js/config.js → AP.SHEETS_SCRIPT_URL
 *
 * Domain model: Clients have one or more Projects. Every work /
 * expense / invoice entry belongs to a Client AND a Project.
 *
 * Sheet structure:
 *   Clients            — global client contact list
 *   Projects           — global project list (each tagged to a client)
 *   {Client}_Work      — per-client billable work entries
 *   {Client}_Expenses  — per-client client-billable pass-through costs
 *   {Client}_Costs     — per-client AP overhead (not client-billable)
 *   {Client}_Invoices  — per-client invoices
 *
 * Per-client entry tabs carry a Project column.
 */

const SPREADSHEET_ID = '1vb-Uyo9_CeUvoVH29vYaxsgeCkK5KFrFgHQZU8oPLio'; // TODO: paste AP's own Google Sheet ID when wiring the backend

// ── Sheet name helpers ─────────────────────────────────────────
function sanitizeSheetName(name) {
  if (!name) return 'NoClient';
  // Remove chars Google Sheets disallows in tab names, trim to 45 chars
  return name.replace(/[\/\\*\?\[\]:]/g, '-').substring(0, 45).trim();
}

function clientSheet(clientName, type) {
  return sanitizeSheetName(clientName) + '_' + type;
}

// ── Sheet access (auto-creates with headers if missing) ────────
function getSheet(name, headerType) {
  if (!name) throw new Error('getSheet: sheet name is required (got: ' + name + ')');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    setupHeaders(sheet, headerType || name);
  }
  return sheet;
}

function getOrEmpty(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1);
}

function setupHeaders(sheet, type) {
  // Guard: if type is missing or not a string, nothing to set up
  if (!type || typeof type !== 'string') return;

  // Strip client prefix to get base type (e.g. "EvolutionKart_Work" → "Work")
  let baseType = type;
  const known = ['Work', 'Expenses', 'Costs', 'Invoices', 'Clients', 'Projects'];
  for (const k of known) {
    if (type === k || type.endsWith('_' + k)) { baseType = k; break; }
  }

  const headers = {
    Clients:   ['Timestamp','LoggedBy','Client','Location','FirstName','LastName','Title','Phone','Email'],
    Projects:  ['Timestamp','LoggedBy','Client','Project','Description'],
    Work:      ['Timestamp','LoggedBy','Client','Project','ServiceName','Quantity','Rate','Amount','Description','PaymentMethod','PaymentStatus'],
    Expenses:  ['Timestamp','LoggedBy','Client','Project','Category','Amount','Description','PaymentMethod','PaymentStatus'],
    Costs:     ['Timestamp','LoggedBy','Category','Amount','PaidBy','PaymentMethod','Description'],
    Invoices:  ['Timestamp','LoggedBy','InvoiceNumber','Client','Project','Contact','Email','Phone','Items','Total','Notes'],
  };

  if (headers[baseType]) {
    sheet.getRange(1, 1, 1, headers[baseType].length).setValues([headers[baseType]]);
    sheet.getRange(1, 1, 1, headers[baseType].length)
      .setBackground('#3f7d9c')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  }
}

// ── Router (GET — works around CORS/redirect issues from browsers) ────
function doGet(e) {
  // Health check — no params
  if (!e.parameter || !e.parameter.action) {
    return jsonResponse({ status: 'AP Ops API is alive' });
  }

  try {
    const action  = e.parameter.action;
    const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
    return jsonResponse(route(action, payload));
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ── Also keep POST for direct API use ────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return jsonResponse(route(body.action, body));
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ── Action routing (shared by doGet / doPost) ────────────────
function route(action, payload) {
  const handlers = {
    logWork:          () => appendWork(payload),
    logExpense:       () => appendExpense(payload),
    logCost:          () => appendCost(payload),
    logNewClient:     () => appendClient(payload),
    logNewProject:    () => appendProject(payload),
    logInvoice:       () => appendInvoice(payload),
    getClientSummary: () => clientSummary(payload.client),
    getClients:       () => clientList(),
    getProjects:      () => projectList(),
  };
  if (!handlers[action]) return { ok: false, error: 'Unknown action: ' + action };
  return handlers[action]();
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Appenders — each write to its own client-scoped tab ───────
function appendWork(d) {
  const sheet = getSheet(clientSheet(d.client, 'Work'), 'Work');
  sheet.appendRow([
    d.timestamp || new Date().toISOString(),
    d.loggedBy, d.client, d.project,
    d.serviceName, d.quantity || '', d.rate || '', d.amount || 0,
    d.description || '', d.paymentMethod, d.paymentStatus,
  ]);
  return { ok: true };
}

function appendExpense(d) {
  const sheet = getSheet(clientSheet(d.client, 'Expenses'), 'Expenses');
  sheet.appendRow([
    d.timestamp || new Date().toISOString(),
    d.loggedBy, d.client, d.project,
    d.category, d.amount || 0, d.description || '',
    d.paymentMethod, d.paymentStatus,
  ]);
  return { ok: true };
}

function appendCost(d) {
  // Business costs are AP overhead — not client-scoped.
  const sheet = getSheet(clientSheet(d.client, 'Costs'), 'Costs');
  sheet.appendRow([
    d.timestamp || new Date().toISOString(),
    d.loggedBy, d.category,
    parseFloat(d.amount) || 0, d.paidBy,
    d.paymentMethod, d.description || '',
  ]);
  return { ok: true };
}

function appendClient(d) {
  // Clients always go to the global Clients tab
  getSheet('Clients').appendRow([
    d.timestamp || new Date().toISOString(),
    d.loggedBy, d.client, d.homeTrack || '',
    d.firstName, d.lastName, d.title,
    d.phone, d.email || '',
  ]);
  return { ok: true };
}

function appendProject(d) {
  // Projects always go to the global Projects tab
  getSheet('Projects').appendRow([
    d.timestamp || new Date().toISOString(),
    d.loggedBy, d.client, d.project, d.description || '',
  ]);
  return { ok: true };
}

function appendInvoice(d) {
  const itemsStr = Array.isArray(d.items)
    ? d.items.map(i => `${i.qty}x ${i.desc} @$${i.unit}`).join(' | ')
    : '';
  const client = d.client || d.org;
  const sheet = getSheet(clientSheet(client, 'Invoices'), 'Invoices');
  sheet.appendRow([
    d.date || new Date().toISOString(),
    d.loggedBy, d.number, client, d.project || '',
    d.contact || '', d.email || '', d.phone || '',
    itemsStr, d.total || 0, d.notes || '',
  ]);
  return { ok: true };
}

// ── Queries ───────────────────────────────────────────────────
function clientSummary(clientName) {
  if (!clientName) return { ok: false, error: 'No client specified' };

  const workRows = getOrEmpty(clientSheet(clientName, 'Work'));
  const expRows  = getOrEmpty(clientSheet(clientName, 'Expenses'));
  const invRows  = getOrEmpty(clientSheet(clientName, 'Invoices'));

  // Work amount is column 8 (index 7); Expense amount is column 6 (index 5).
  const revenue = [
    ...workRows.map(r => parseFloat(r[7]) || 0),
    ...expRows.map(r => parseFloat(r[5]) || 0),
  ].reduce((s, v) => s + v, 0);

  // Invoice total is column 10 (index 9).
  const invoiced = invRows.map(r => parseFloat(r[9]) || 0).reduce((s, v) => s + v, 0);

  const loggerSet = new Set([
    ...workRows.map(r => r[1]),
    ...expRows.map(r => r[1]),
  ]);

  return {
    ok: true,
    summary: {
      workCount:     workRows.length,
      expenseCount:  expRows.length,
      revenue:       revenue,
      invoiced:      invoiced,
      invoiceCount:  invRows.length,
      loggers:       [...loggerSet].filter(Boolean),
    },
  };
}

function clientList() {
  const rows = getOrEmpty('Clients');
  const names = [...new Set(rows.map(r => r[2]).filter(Boolean))].sort();
  return { ok: true, clients: names };
}

function projectList() {
  const rows = getOrEmpty('Projects');
  // Each project: { client, name }
  const projects = rows
    .filter(r => r[3])
    .map(r => ({ client: r[2], name: r[3] }));
  return { ok: true, projects: projects };
}
