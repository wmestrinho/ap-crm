/**
 * AP CRM | Absolutely Plausible — App Logic
 * Navigation, form submissions, accounts, contacts, opportunities, leads, activities, dashboard.
 */

// ── Navigation ────────────────────────────────────────────────
function go(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  updateAccountBadges();
  updateContactBadges();

  if (viewId === 'clientDashboard') refreshDashboard();
  if (viewId === 'invoiceBuilder') {
    if (document.getElementById('lineItemsList').children.length === 0) addLineItem();
    const invNum = document.getElementById('inv_number');
    if (invNum && !invNum.value) invNum.value = generateInvoiceNumber();
  }
}

// ── Keyboard Shortcuts ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Don't trigger shortcuts when typing in inputs/textareas
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }

  // Mod key (Cmd/Ctrl) combinations
  if (e.metaKey || e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case '1': // Log Activity
        e.preventDefault();
        go('logActivity');
        break;
      case '2': // Log Expense
        e.preventDefault();
        go('logExpense');
        break;
      case '3': // Invoice Builder
        e.preventDefault();
        go('invoiceBuilder');
        break;
      case '4': // New Client
        e.preventDefault();
        go('newCustomer');
        break;
      case '5': // New Project
        e.preventDefault();
        go('newProject');
        break;
      case '6': // Work Costs
        e.preventDefault();
        go('workCosts');
        break;
      case '7': // Client Dashboard
        e.preventDefault();
        go('clientDashboard');
        break;
      case '0': // Main Menu
        e.preventDefault();
        go('mainMenu');
        break;
      case 's': // Save (submit current form)
        e.preventDefault();
        const activeForm = document.querySelector('.view.active form');
        if (activeForm) {
          activeForm.dispatchEvent(new Event('submit'));
        }
        break;
      case 'escape': // Close modals/go back
        e.preventDefault();
        const openModal = document.querySelector('.modal.open');
        if (openModal) {
          const modalId = openModal.id;
          closeModal(modalId.replace('Modal', ''));
        } else {
          // Go back to main menu if no modal
          const currentView = document.querySelector('.view.active');
          if (currentView && currentView.id !== 'mainMenu') {
            go('mainMenu');
          }
        }
        break;
    }
  }
});

// ── Invoice number generator ───────────────────────────────────
// Format: AP-YYYY-MMDD-001
function generateInvoiceNumber() {
  const now  = new Date();
  const base = `AP-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const todayCount = STATE.localEntries.filter(e =>
    e.type === 'invoice' && e.invoiceNumber && e.invoiceNumber.startsWith(base)
  ).length;
  return `${base}-${String(todayCount + 1).padStart(3, '0')}`;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast${isError ? ' error' : ''}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}

function showModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── Clients ───────────────────────────────────────────────────
function renderClientSelect() {
  const sel = document.getElementById('currentClient');
  const current = STATE.currentClient;
  sel.innerHTML = '<option value="">— Select Client —</option>';
  STATE.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name + (c.location ? ` (${c.location})` : '');
    if (c.name === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function saveNewClient() {
  const name = document.getElementById('newClientName').value.trim();
  const loc  = document.getElementById('newClientLocation').value.trim();
  const note = document.getElementById('newClientNotes').value.trim();
  if (!name) { toast('Client name required', true); return; }
  if (STATE.clients.some(c => c.name === name)) { toast('Client already exists', true); return; }

  STATE.clients.push({ name, location: loc, notes: note });
  saveClients();
  saveLocalClient(name);
  renderClientSelect();
  setClient(name);
  document.getElementById('currentClient').value = name;
  closeModal('addClientModal');
  document.getElementById('newClientName').value = '';
  document.getElementById('newClientLocation').value = '';
  document.getElementById('newClientNotes').value = '';
  loadClientDatalist();
  toast(`Client created: ${name}`);
}

// ── Delete client ─────────────────────────────────────────────
function openDeleteClientModal() {
  if (!STATE.currentClient) { toast('Select a client to delete', true); return; }
  document.getElementById('deleteClientName').textContent = STATE.currentClient;
  showModal('deleteEventModal');
}

function confirmDeleteClient() {
  const name = STATE.currentClient;
  STATE.clients      = STATE.clients.filter(c => c.name !== name);
  STATE.projects     = STATE.projects.filter(p => p.client !== name);
  STATE.localEntries = STATE.localEntries.filter(e => e.client !== name);
  saveClients();
  saveProjects();
  localStorage.setItem('ap_local_entries', JSON.stringify(STATE.localEntries));
  setClient('');
  document.getElementById('currentClient').value = '';
  renderClientSelect();
  renderProjectSelect();
  closeModal('deleteEventModal');
  toast(`Client deleted: ${name}`);
}

// ── Projects ──────────────────────────────────────────────────
function renderProjectSelect() {
  const sel = document.getElementById('currentProject');
  if (!sel) return;
  const current = STATE.currentProject;
  const client  = STATE.currentClient;
  const scoped  = STATE.projects.filter(p => p.client === client);
  sel.innerHTML = '<option value="">— Select Project —</option>';
  scoped.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    if (p.name === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

// Add a project from a known client + name (used by both modal and view)
function createProject(client, name, description) {
  if (!client) { toast('Select a client first', true); return false; }
  if (!name)   { toast('Project name required', true); return false; }
  if (STATE.projects.some(p => p.client === client && p.name === name)) {
    toast('Project already exists for this client', true);
    return false;
  }
  STATE.projects.push({ client, name, description: description || '' });
  saveProjects();
  return true;
}

function saveNewProjectModal() {
  const client = STATE.currentClient;
  const name   = document.getElementById('newProjectName').value.trim();
  const desc   = document.getElementById('newProjectDesc').value.trim();
  if (!client) { toast('Select a client first (top right)', true); return; }
  if (!createProject(client, name, desc)) return;

  renderProjectSelect();
  setProject(name);
  document.getElementById('currentProject').value = name;
  closeModal('addProjectModal');
  document.getElementById('newProjectName').value = '';
  document.getElementById('newProjectDesc').value = '';
  loadProjectDatalist();
  toast(`Project created: ${name}`);
}

function openDeleteProjectModal() {
  if (!STATE.currentProject) { toast('Select a project to delete', true); return; }
  document.getElementById('deleteProjectName').textContent =
    `${STATE.currentClient} / ${STATE.currentProject}`;
  showModal('deleteProjectModal');
}

function confirmDeleteProject() {
  const client = STATE.currentClient;
  const name   = STATE.currentProject;
  STATE.projects     = STATE.projects.filter(p => !(p.client === client && p.name === name));
  STATE.localEntries = STATE.localEntries.filter(e => !(e.client === client && e.project === name));
  saveProjects();
  localStorage.setItem('ap_local_entries', JSON.stringify(STATE.localEntries));
  setProject('');
  document.getElementById('currentProject').value = '';
  renderProjectSelect();
  closeModal('deleteProjectModal');
  toast(`Project deleted: ${name}`);
}

// ── Work amount calc (rate × qty for Hourly, flat for Custom) ──
function updateServicePrice(sel) {
  const [name] = (sel.value || '').split('|');
  const rateLabel = document.getElementById('rateLabel');
  if (rateLabel) {
    rateLabel.textContent = name === 'Custom' ? 'Quoted Amount (USD)' : 'Rate (USD)';
  }
  updateWorkAmount();
}

function updateWorkAmount() {
  const form = document.getElementById('logWorkForm');
  if (!form) return;
  const service = (form.serviceType.value || '').split('|')[0];
  const qty  = parseFloat(form.quantity.value) || 0;
  const rate = parseFloat(form.rate.value)     || 0;
  // Custom = flat quoted amount; Hourly = rate × qty
  const amount = service === 'Custom' ? rate : rate * qty;
  document.getElementById('tablePrice').textContent = `$${amount.toFixed(2)}`;
  document.getElementById('workAmountHidden').value = amount.toFixed(2);
}

// ── Form: Log Work ────────────────────────────────────────────
async function submitWork(e) {
  e.preventDefault();
  if (!STATE.currentUser)    { toast('Select your name first (top right)', true); return; }
  if (!STATE.currentClient)  { toast('Select or create a client first', true); return; }
  if (!STATE.currentProject) { toast('Select or create a project first', true); return; }

  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const [serviceName] = (data.serviceType || '').split('|');
  const amount = parseFloat(data.amount || 0);
  const payload = {
    ...data,
    serviceName,
    amount,
    client:    data.client    || STATE.currentClient,
    project:   data.project   || STATE.currentProject,
    loggedBy:  STATE.currentUser,
    timestamp: new Date().toISOString(),
  };

  const localEntry = {
    type: 'work',
    client:  payload.client,
    project: payload.project,
    org:     payload.client,
    amount:  amount,
    serviceName:   payload.serviceName,
    description:   payload.description || '',
    quantity:      parseFloat(data.quantity) || 0,
    rate:          parseFloat(data.rate) || 0,
    loggedBy:      STATE.currentUser,
    paymentStatus: payload.paymentStatus,
  };

  try {
    await pushWork(payload);
    toast('Work entry saved ✓');
  } catch (err) {
    toast('Saved locally — Sheets offline', false);
  }
  saveLocalEntry(localEntry);
  saveLocalClient(payload.client);
  e.target.reset();
  document.getElementById('tablePrice').textContent = '$0.00';
  document.getElementById('workAmountHidden').value = '0';
}

// ── Template Loading ──────────────────────────────────────────
function loadTemplate(templateName) {
  if (!templateName || templateName === '') return;
  
  const template = AP.templates.find(t => t.name === templateName);
  if (!template) return;
  
  // Get the first work entry from the template to pre-fill the form
  const firstWork = template.work[0];
  if (!firstWork) return;
  
  // Set service type (format: "ServiceName|rate")
  const serviceTypeSelect = document.querySelector('select[name="serviceType"]');
  if (serviceTypeSelect) {
    serviceTypeSelect.value = `${firstWork.serviceName}|${firstWork.rate}`;
    updateServicePrice(serviceTypeSelect); // Update rate label and recalculate amount
  }
  
  // Set quantity
  const quantityInput = document.querySelector('input[name="quantity"]');
  if (quantityInput) {
    quantityInput.value = firstWork.quantity || 1;
  }
  
  // Set description
  const descriptionInput = document.querySelector('textarea[name="description"]');
  if (descriptionInput) {
    descriptionInput.value = firstWork.description || '';
  }
  
  // Update the amount display
  updateWorkAmount();
  
  // Show confirmation
  toast(`Template '${templateName}' loaded - adjust values as needed`);
  
  // Reset the template selector to avoid re-loading same template
  const form = document.getElementById('logWorkForm');
  if (form) form.template.value = '';
}

// ── Form: Log Expense ─────────────────────────────────────────
async function submitExpense(e) {
  e.preventDefault();
  if (!STATE.currentUser)    { toast('Select your name first', true); return; }
  if (!STATE.currentClient)  { toast('Select or create a client first', true); return; }
  if (!STATE.currentProject) { toast('Select or create a project first', true); return; }

  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const amount = parseFloat(data.amount || 0);
  const payload = {
    ...data,
    amount,
    client:    data.client  || STATE.currentClient,
    project:   data.project || STATE.currentProject,
    loggedBy:  STATE.currentUser,
    timestamp: new Date().toISOString(),
  };

  try {
    await pushExpense(payload);
    toast('Expense entry saved ✓');
  } catch (_) {
    toast('Saved locally — Sheets offline', false);
  }
  saveLocalEntry({
    type: 'expense',
    client:  payload.client,
    project: payload.project,
    org:     payload.client,
    amount:  amount,
    category:      payload.category,
    description:   payload.description || '',
    loggedBy:      STATE.currentUser,
    paymentStatus: payload.paymentStatus,
  });
  saveLocalClient(payload.client);
  e.target.reset();
}

// ── Form: Business Costs (AP overhead — not client-billable) ──
async function submitWorkCosts(e) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const payload = {
    ...data,
    loggedBy:  STATE.currentUser,
    timestamp: new Date().toISOString(),
  };
  try {
    await logWorkCosts(payload);
    toast('Business cost logged ✓');
  } catch (_) {
    toast('Saved locally — Sheets offline', false);
  }
  saveLocalEntry({
    type: 'cost',
    amount:   parseFloat(data.amount) || 0,
    category: data.category,
    description: data.description || '',
    loggedBy: STATE.currentUser,
  });
  e.target.reset();
}

// ── Form: New Client ──────────────────────────────────────────
async function submitNewCustomer(e) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const payload = { ...data, loggedBy: STATE.currentUser, timestamp: new Date().toISOString() };

  if (data.client && !STATE.clients.some(c => c.name === data.client)) {
    STATE.clients.push({ name: data.client, location: data.homeTrack || '', notes: '' });
    saveClients();
    renderClientSelect();
  }

  try {
    await logNewCustomer(payload);
    toast('Client saved ✓');
  } catch (_) {
    toast('Saved locally — Sheets offline', false);
  }
  saveLocalClient(data.client);
  loadClientDatalist();
  e.target.reset();
}

// ── Form: New Project ─────────────────────────────────────────
async function submitNewProject(e) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const client = (data.client || '').trim();
  const name   = (data.project || '').trim();

  // A project's client must exist — register it if it doesn't yet
  if (client && !STATE.clients.some(c => c.name === client)) {
    STATE.clients.push({ name: client, location: '', notes: '' });
    saveClients();
    saveLocalClient(client);
    renderClientSelect();
  }

  if (!createProject(client, name, data.description)) return;

  try {
    await logNewProject({ ...data, client, project: name, loggedBy: STATE.currentUser, timestamp: new Date().toISOString() });
    toast('Project saved ✓');
  } catch (_) {
    toast('Saved locally — Sheets offline', false);
  }

  // If this project belongs to the active client, select it
  if (client === STATE.currentClient) {
    renderProjectSelect();
    setProject(name);
    document.getElementById('currentProject').value = name;
  }
  loadProjectDatalist();
  e.target.reset();
}

// ── Dashboard ─────────────────────────────────────────────────
function refreshDashboard() {
  if (!STATE.currentClient) {
    toast('Select a client to see dashboard', true);
    return;
  }
  document.getElementById('dashClientBadge').textContent =
    STATE.currentClient + (STATE.currentProject ? ` / ${STATE.currentProject}` : '');

  const client  = STATE.currentClient;
  const entries = STATE.localEntries.filter(e => e.client === client);
  const workRows = entries.filter(e => e.type === 'work');
  const expRows  = entries.filter(e => e.type === 'expense');
  const invRows  = entries.filter(e => e.type === 'invoice');

  const billable = [...workRows, ...expRows];
  const revenue  = billable.reduce((s, e) => s + (e.amount || 0), 0);
  const invoiced = invRows.reduce((s, e) => s + (e.amount || 0), 0);
  const ops      = [...new Set(billable.map(e => e.loggedBy).filter(Boolean))];

  const paid    = billable.filter(e => e.paymentStatus === 'PAID').reduce((s, e) => s + (e.amount || 0), 0);
  const pending = billable.filter(e => e.paymentStatus !== 'PAID').reduce((s, e) => s + (e.amount || 0), 0);
  const splitEl = document.getElementById('dash_rev_split');
  if (splitEl) {
    splitEl.innerHTML = billable.length === 0 ? '' :
      pending > 0
        ? `<span class="split-paid">✓ $${paid.toFixed(2)}</span><span class="split-pend">⏳ $${pending.toFixed(2)}</span>`
        : `<span class="split-paid">✓ ALL PAID</span>`;
  }

  document.getElementById('dash_tw').textContent   = workRows.length || '0';
  document.getElementById('dash_pw').textContent   = expRows.length  || '0';
  document.getElementById('dash_rev').textContent  = `$${revenue.toFixed(2)}`;
  document.getElementById('dash_inv').textContent  = `$${invoiced.toFixed(2)}`;
  document.getElementById('dash_paid').textContent = `$${paid.toFixed(2)}`;
  document.getElementById('dash_who').textContent  = ops.join(', ') || '—';

  const outEl = document.getElementById('dash_out');
  outEl.textContent = `$${pending.toFixed(2)}`;
  outEl.className   = `dash-value${pending > 0 ? ' red' : ' green'}`;

  // Add export buttons to dashboard
  const exportContainer = document.createElement('div');
  exportContainer.className = 'dashboard-export';
  exportContainer.innerHTML = `
    <button class="btn-secondary" onclick="exportData('csv')">📥 Export CSV</button>
    <button class="btn-secondary" onclick="exportData('json')">📥 Export JSON</button>
  `;
  
  // Insert export buttons after the dashboard content
  const dashboardContent = document.querySelector('.dashboard-content');
  if (dashboardContent) {
    dashboardContent.appendChild(exportContainer);
  }

  renderProjectBreakdown(client, entries);
}

// ── Per-project breakdown ─────────────────────────────────────
function renderProjectBreakdown(client, entries) {
  const listEl = document.getElementById('projectBreakdownList');
  if (!listEl) return;

  const projNames = [...new Set([
    ...STATE.projects.filter(p => p.client === client).map(p => p.name),
    ...entries.map(e => e.project).filter(Boolean),
  ])];

  if (projNames.length === 0) {
    listEl.innerHTML = '<p class="detail-empty">[ NO PROJECTS FOR THIS CLIENT ]</p>';
    return;
  }

  listEl.innerHTML = projNames.sort().map(pname => {
    const pEntries  = entries.filter(e => e.project === pname);
    const billable  = pEntries.filter(e => e.type === 'work' || e.type === 'expense');
    const revenue   = billable.reduce((s, e) => s + (e.amount || 0), 0);
    const invoiced  = pEntries.filter(e => e.type === 'invoice').reduce((s, e) => s + (e.amount || 0), 0);
    const paid      = billable.filter(e => e.paymentStatus === 'PAID').reduce((s, e) => s + (e.amount || 0), 0);
    const pending   = billable.filter(e => e.paymentStatus !== 'PAID').reduce((s, e) => s + (e.amount || 0), 0);
    return `
      <div class="detail-row">
        <div class="detail-main">
          <span class="detail-org">${pname}</span>
          <span class="detail-info">${billable.length} billable · invoiced $${invoiced.toFixed(2)}</span>
        </div>
        <div class="detail-meta">
          <span class="detail-amount">$${revenue.toFixed(2)}</span>
          <span class="detail-status ${pending > 0 ? 'status-pending' : 'status-paid'}">
            ${pending > 0 ? `OUT $${pending.toFixed(2)}` : 'ALL PAID'}
          </span>
          <span class="detail-by">paid $${paid.toFixed(2)}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Dashboard detail drill-down ───────────────────────────────
function showDashDetail(type) {
  const panel    = document.getElementById('dashDetail');
  const titleEl  = document.getElementById('dashDetailTitle');
  const listEl   = document.getElementById('dashDetailList');

  // Toggle off if already showing this type
  if (panel.dataset.active === type && panel.style.display !== 'none') {
    closeDashDetail();
    return;
  }

  if (!STATE.currentClient) { toast('Select a client first', true); return; }
  const client  = STATE.currentClient;
  const entries = STATE.localEntries.filter(e => e.client === client);

  const configs = {
    work:    { label: 'WORK ENTRIES',     rows: entries.filter(e => e.type === 'work') },
    expense: { label: 'EXPENSE ENTRIES',  rows: entries.filter(e => e.type === 'expense') },
    revenue: { label: 'BILLABLE ENTRIES', rows: entries.filter(e => e.type === 'work' || e.type === 'expense') },
    invoice: { label: 'INVOICES LOGGED',  rows: entries.filter(e => e.type === 'invoice') },
  };

  const { label, rows } = configs[type] || { label: type, rows: [] };
  const sorted = [...rows].sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  titleEl.textContent = `[ ${label} — ${sorted.length} RECORD${sorted.length !== 1 ? 'S' : ''} ]`;
  listEl.innerHTML = sorted.length === 0
    ? '<p class="detail-empty">[ NO RECORDS FOR THIS CLIENT ]</p>'
    : sorted.map(r => buildDetailRow(r, type)).join('');

  // Mark active card
  document.querySelectorAll('.dash-card[data-detail]').forEach(c => c.classList.remove('active-detail'));
  document.querySelector(`.dash-card[data-detail="${type}"]`)?.classList.add('active-detail');

  panel.dataset.active = type;
  panel.style.display  = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeDashDetail() {
  const panel = document.getElementById('dashDetail');
  panel.style.display  = 'none';
  panel.dataset.active = '';
  document.querySelectorAll('.dash-card[data-detail]').forEach(c => c.classList.remove('active-detail'));
}

function buildDetailRow(e, type) {
  const dt      = e.savedAt ? new Date(e.savedAt) : null;
  const time    = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
  const date    = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })    : '—';
  const amt     = `$${(e.amount || 0).toFixed(2)}`;
  const paid    = e.paymentStatus === 'PAID';
  const savedAt = e.savedAt || '';
  const project = e.project || '—';

  const status = e.paymentStatus
    ? `<span class="detail-status ${paid ? 'status-paid' : 'status-pending'} clickable-status"
         onclick="togglePaymentStatus(this.closest('.detail-row').dataset.savedAt)"
         title="Tap to toggle paid / pending">${e.paymentStatus}</span>`
    : '';

  const delBtn  = `<button class="detail-del" onclick="deleteEntry(this.closest('.detail-row').dataset.savedAt)" title="Delete entry">✕</button>`;

  const metaBase = `
    <span class="detail-by">${e.loggedBy || '—'}</span>
    <span class="detail-time">${date} ${time}</span>
    ${delBtn}`;

  if (type === 'work') return `
    <div class="detail-row" data-saved-at="${savedAt}">
      <div class="detail-main">
        <span class="detail-org">${project}</span>
        <span class="detail-info">${e.serviceName || 'Work'}${e.description ? ' — ' + e.description : ''}</span>
      </div>
      <div class="detail-meta">
        <span class="detail-amount">${amt}</span>
        ${status}${metaBase}
      </div>
    </div>`;

  if (type === 'expense') return `
    <div class="detail-row" data-saved-at="${savedAt}">
      <div class="detail-main">
        <span class="detail-org">${project}</span>
        <span class="detail-info">${e.category || 'Expense'}${e.description ? ' — ' + e.description : ''}</span>
      </div>
      <div class="detail-meta">
        <span class="detail-amount">${amt}</span>
        ${status}${metaBase}
      </div>
    </div>`;

  if (type === 'revenue') {
    const tag  = e.type === 'work' ? 'WK' : 'EX';
    const info = e.type === 'work' ? (e.serviceName || 'Work') : (e.category || 'Expense');
    return `
    <div class="detail-row" data-saved-at="${savedAt}">
      <div class="detail-main">
        <span class="detail-type-tag">${tag}</span>
        <span class="detail-org">${project}</span>
        <span class="detail-info">${info}</span>
      </div>
      <div class="detail-meta">
        <span class="detail-amount">${amt}</span>
        ${status}${metaBase}
      </div>
    </div>`;
  }

  if (type === 'invoice') return `
    <div class="detail-row" data-saved-at="${savedAt}">
      <div class="detail-main">
        <span class="detail-inv-num">${e.invoiceNumber || '—'}</span>
        <span class="detail-org">${project}</span>
      </div>
      <div class="detail-meta">
        <span class="detail-amount">${amt}</span>
        ${metaBase}
      </div>
    </div>`;

  return '';
}

// ── Entry actions (delete / toggle payment status) ─────────────
function deleteEntry(savedAt) {
  if (!savedAt) return;
  STATE.localEntries = STATE.localEntries.filter(e => e.savedAt !== savedAt);
  localStorage.setItem('ap_local_entries', JSON.stringify(STATE.localEntries));
  const active = document.getElementById('dashDetail').dataset.active;
  if (active) showDashDetail(active);
  refreshDashboard();
  toast('Entry deleted');
}

function togglePaymentStatus(savedAt) {
  if (!savedAt) return;
  const entry = STATE.localEntries.find(e => e.savedAt === savedAt);
  if (!entry || !entry.paymentStatus) return;
  entry.paymentStatus = entry.paymentStatus === 'PAID' ? 'PENDING' : 'PAID';
  localStorage.setItem('ap_local_entries', JSON.stringify(STATE.localEntries));
  const active = document.getElementById('dashDetail').dataset.active;
  if (active) showDashDetail(active);
  refreshDashboard();
  toast(`Status → ${entry.paymentStatus}`);
}

// ── Invoice Builder: Dual Mode ────────────────────────────────
function setInvoiceMode(mode) {
  const isClient = mode === 'client';
  document.getElementById('modeManual').classList.toggle('active', !isClient);
  document.getElementById('modeEvent').classList.toggle('active', isClient);
  document.getElementById('eventModePanel').style.display = isClient ? 'block' : 'none';

  if (isClient) {
    if (!STATE.currentClient) { toast('Select a client first to use Client Mode', true); return; }
    // Offer every project under the current client
    const sel = document.getElementById('inv_eventorg');
    const projNames = STATE.projects
      .filter(p => p.client === STATE.currentClient)
      .map(p => p.name)
      .sort();
    sel.innerHTML = '<option value="">— Select Project —</option>' +
      projNames.map(n => `<option value="${n}">${n}</option>`).join('');
    document.getElementById('eventEntriesSummary').innerHTML = '';
  }
}

function loadEventEntries(project) {
  if (!project) return;
  if (!STATE.currentClient) { toast('Select a client first', true); return; }

  const client  = STATE.currentClient;
  const entries = STATE.localEntries.filter(e =>
    e.client === client && e.project === project && (e.type === 'work' || e.type === 'expense')
  );

  if (entries.length === 0) {
    document.getElementById('eventEntriesSummary').innerHTML =
      '<p class="entries-none">[ NO WORK OR EXPENSE ENTRIES FOUND FOR THIS PROJECT ]</p>';
    toast('No entries found for this project', true);
    return;
  }

  // Pre-fill bill-to + project fields
  document.getElementById('inv_org').value   = client;
  document.getElementById('inv_event').value = project;

  // Clear existing line items and rebuild from local entries
  document.getElementById('lineItemsList').innerHTML = '';

  const workEntries = entries.filter(e => e.type === 'work');
  const expEntries  = entries.filter(e => e.type === 'expense');

  workEntries.forEach(e => {
    const desc = e.serviceName === 'Hourly'
      ? `${e.serviceName} — ${e.description || 'Work'}`
      : (e.description || e.serviceName || 'Work');
    const qty  = e.serviceName === 'Hourly' ? (e.quantity || 1) : 1;
    const unit = e.serviceName === 'Hourly' ? (e.rate || 0) : (e.amount || 0);
    addLineItem(desc, qty, unit);
  });
  expEntries.forEach(e => {
    addLineItem(`${e.category || 'Expense'}${e.description ? ' — ' + e.description : ''}`, 1, e.amount || 0);
  });

  const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
  document.getElementById('eventEntriesSummary').innerHTML = `
    <div class="entries-summary-box">
      <span>⚡ ${workEntries.length} work + ${expEntries.length} expense entries loaded</span>
      <span class="entries-total">$${total.toFixed(2)}</span>
    </div>`;

  toast(`${entries.length} entries loaded for ${project}`);
}

// ── CSV Export ────────────────────────────────────────────────
function exportEventCSV() {
  if (!STATE.currentClient) { toast('Select a client first', true); return; }

  const client  = STATE.currentClient;
  const entries = STATE.localEntries.filter(e => e.client === client);
  if (entries.length === 0) { toast('No entries to export', true); return; }

  const typeLabel = { work: 'Work', expense: 'Expense', cost: 'Business Cost', invoice: 'Invoice' };
  const headers   = ['Type', 'Date', 'Time', 'Client', 'Project', 'Service / Item', 'Amount (USD)', 'Payment Status', 'Logged By', 'Invoice #'];

  const rows = [...entries]
    .sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0))
    .map(e => {
      const dt   = e.savedAt ? new Date(e.savedAt) : null;
      const date = dt ? dt.toLocaleDateString('en-US') : '';
      const time = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      const item = e.serviceName || e.category || '';
      return [
        typeLabel[e.type] || e.type,
        date,
        time,
        e.client        || '',
        e.project       || '',
        item,
        (e.amount || 0).toFixed(2),
        e.paymentStatus || '',
        e.loggedBy      || '',
        e.invoiceNumber || '',
      ];
    });

  const escape     = v => `"${String(v).replace(/"/g, '""')}"`;
  const csvContent = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');

  const blob    = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `AP_${client.replace(/[\s/\\*?[\]:]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  toast(`CSV exported — ${entries.length} entries`);
}

// ── Menu status line ──────────────────────────────────────────
function updateMenuStatus() {
  const el = document.getElementById('menuStatusLine');
  if (!el) return;
  const u = STATE.currentUser;
  const c = STATE.currentClient;
  const p = STATE.currentProject;
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  if (u && c && p) {
    el.textContent = `[ OPERATOR: ${u.toUpperCase()} // ${c.toUpperCase()} / ${p.toUpperCase()} // ${now} ]`;
  } else if (u && c) {
    el.textContent = `[ OPERATOR: ${u.toUpperCase()} // CLIENT: ${c.toUpperCase()} // NO PROJECT ]`;
  } else if (u) {
    el.textContent = `[ OPERATOR: ${u.toUpperCase()} // NO CLIENT SELECTED ]`;
  } else {
    el.textContent = `[ SELECT OPERATOR, CLIENT AND PROJECT TO BEGIN // ${now} ]`;
  }

  const apLine = document.getElementById('addProjectClientLine');
  if (apLine) {
    apLine.textContent = c
      ? `New project under client: ${c}`
      : 'Select a client first (top right) to add a project.';
  }
}

// ── Init ──────────────────────────────────────────────────────
(function init() {
  // Display version from config (single source of truth)
  const vBadge  = document.getElementById('versionBadge');
  const vFooter = document.getElementById('footerVersion');
  const vMenu   = document.getElementById('menuVersion');
  if (vBadge)  vBadge.textContent  = AP.version;
  if (vFooter) vFooter.textContent = AP.version;
  if (vMenu)   vMenu.textContent   = AP.version;

  // Restore user selector
  const userSel = document.getElementById('currentUser');
  if (STATE.currentUser) userSel.value = STATE.currentUser;

  // Restore clients + projects + selectors
  renderClientSelect();
  renderProjectSelect();
  updateAccountBadges();
  updateContactBadges();
  updateMenuStatus();

  // Tick clock on menu
  setInterval(updateMenuStatus, 10000);

  // Load datalists (non-blocking)
  loadClientDatalist();
  loadProjectDatalist();
})();

// ── Data Export ───────────────────────────────────────────────
function exportData(format) {
  if (!STATE.currentClient) {
    toast('Select a client to export data', true);
    return;
  }

  const client = STATE.currentClient;
  const entries = STATE.localEntries.filter(e => e.client === client);
  
  if (entries.length === 0) {
    toast('No data to export for this client', true);
    return;
  }

  if (format === 'csv') {
    // CSV Export
    const headers = ['Type', 'Date', 'Client', 'Project', 'Service/Category', 'Amount', 'Description', 'Logged By', 'Payment Status'];
    const rows = entries.map(entry => {
      const date = new Date(entry.savedAt || entry.timestamp);
      const dateStr = date.toISOString().split('T')[0];
      
      let serviceCategory = '';
      if (entry.type === 'work') {
        serviceCategory = entry.serviceName || 'Work';
      } else if (entry.type === 'expense') {
        serviceCategory = entry.category || 'Expense';
      } else if (entry.type === 'invoice') {
        serviceCategory = 'Invoice';
      } else {
        serviceCategory = entry.type;
      }
      
      return [
        entry.type,
        dateStr,
        entry.client || '',
        entry.project || '',
        serviceCategory,
        entry.amount || 0,
        entry.description || '',
        entry.loggedBy || '',
        entry.paymentStatus || ''
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(field => 
          String(field).includes(',') || String(field).includes('"') || String(field).includes('\n') 
            ? `"${String(field).replace(/"/g, '""')}"` 
            : String(field)
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `AP_Ops_${client}_${new Date().toISOString().split('T')[0]}.csv`;
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast(`Exported ${entries.length} entries to CSV`, false);
  } else if (format === 'json') {
    // JSON Export
    const exportData = {
      client: client,
      exportedAt: new Date().toISOString(),
      version: AP.version,
      entries: entries.map(entry => ({
        ...entry,
        // Ensure date is ISO string
        savedAt: entry.savedAt || entry.timestamp || new Date().toISOString()
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `AP_Ops_${client}_${new Date().toISOString().split('T')[0]}.json`;
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast(`Exported ${entries.length} entries to JSON`, false);
  }
}
