/**
 * AP CRM app logic
 * Scope: Leads, Accounts, Contacts, Opportunities, Activities + Dashboard
 * v1.5.0: CRUD actions, backup/restore, search/filters
 */

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast${isError ? ' error' : ''}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

function go(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  if (viewId === 'dashboardView') refreshDashboard();
}

function normalize(value) { return (value || '').trim(); }
function key(value) { return normalize(value).toLowerCase(); }

function setOperatorFilter(val) {
  localStorage.setItem('ap_operator_filter', val || 'all');
  renderAll();
}
function getOperatorFilter() { return localStorage.getItem('ap_operator_filter') || 'all'; }

function byOwnerFilter(row) {
  const mode = getOperatorFilter();
  if (mode !== 'mine') return true;
  return row.owner === STATE.currentUser;
}

function getSearch(viewKey) {
  const el = document.getElementById(`${viewKey}Search`);
  return key(el?.value || '');
}

function getExtraFilter(viewKey) {
  const el = document.getElementById(`${viewKey}Filter`);
  return normalize(el?.value || 'all');
}

function byText(row, fields, q) {
  if (!q) return true;
  return fields.some(f => key(row[f]).includes(q));
}

function setUser(val) {
  STATE.currentUser = val || '';
  localStorage.setItem('ap_user', STATE.currentUser);
  updateOwnerInputs();
  updateMenuStatus();
  renderAll();
}

function setAccount(val) {
  STATE.currentAccount = val || '';
  localStorage.setItem('ap_account', STATE.currentAccount);
  renderContactSelect();
  updateMenuStatus();
}

function setContact(val) {
  STATE.currentContact = val || '';
  localStorage.setItem('ap_contact', STATE.currentContact);
  updateMenuStatus();
}

function updateOwnerInputs() {
  ['leadOwner', 'accountOwner', 'contactOwner', 'oppOwner', 'activityOwner'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = STATE.currentUser || '';
  });
}

function updateMenuStatus() {
  const status = document.getElementById('menuStatusLine');
  if (!status) return;
  const u = STATE.currentUser || 'NO_USER';
  const a = STATE.currentAccount || 'NO_ACCOUNT';
  const c = STATE.currentContact || 'NO_CONTACT';
  status.textContent = `[ USER: ${u} | ACCOUNT: ${a} | CONTACT: ${c} ]`;
}

function renderUserSelect() {
  const sel = document.getElementById('currentUser');
  if (!sel) return;
  sel.innerHTML = '<option value="">SELECT_USER</option>';
  AP.team.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === STATE.currentUser) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderAccountSelect() {
  const accountNames = [...new Set(STATE.accounts.map(a => a.name).filter(Boolean))].sort();

  const current = document.getElementById('currentAccount');
  if (current) {
    current.innerHTML = '<option value="">NO_ACCOUNT</option>';
    accountNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === STATE.currentAccount) opt.selected = true;
      current.appendChild(opt);
    });
  }

  [document.getElementById('contactAccount'), document.getElementById('oppAccount')].forEach(sel => {
    if (!sel) return;
    const selected = sel.value;
    sel.innerHTML = '<option value="">SELECT_ACCOUNT</option>';
    accountNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    if (selected && accountNames.includes(selected)) sel.value = selected;
    if (!sel.value && STATE.currentAccount) sel.value = STATE.currentAccount;
  });
}

function renderContactSelect() {
  const sel = document.getElementById('currentContact');
  if (!sel) return;
  const contacts = STATE.contacts
    .filter(c => !STATE.currentAccount || c.account === STATE.currentAccount)
    .map(c => c.name).filter(Boolean).sort();

  sel.innerHTML = '<option value="">NO_CONTACT</option>';
  contacts.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === STATE.currentContact) opt.selected = true;
    sel.appendChild(opt);
  });
}

function initPickers() {
  const leadStatus = document.getElementById('leadStatus');
  if (leadStatus) leadStatus.innerHTML = AP.leadStatus.map(s => `<option value="${s}">${s}</option>`).join('');

  const oppStage = document.getElementById('oppStage');
  if (oppStage) oppStage.innerHTML = AP.opportunityStages.map(s => `<option value="${s}">${s}</option>`).join('');

  const activityType = document.getElementById('activityType');
  if (activityType) activityType.innerHTML = AP.activityTypes.map(t => `<option value="${t}">${t}</option>`).join('');

  const leadsFilter = document.getElementById('leadsFilter');
  if (leadsFilter) leadsFilter.innerHTML = '<option value="all">ALL_STATUS</option>' + AP.leadStatus.map(s => `<option value="${s}">${s}</option>`).join('');

  const oppFilter = document.getElementById('opportunitiesFilter');
  if (oppFilter) oppFilter.innerHTML = '<option value="all">ALL_STAGES</option>' + AP.opportunityStages.map(s => `<option value="${s}">${s}</option>`).join('');
}

function saveAll() {
  localStorage.setItem('ap_accounts', JSON.stringify(STATE.accounts));
  localStorage.setItem('ap_contacts', JSON.stringify(STATE.contacts));
  localStorage.setItem('ap_leads', JSON.stringify(STATE.leads));
  localStorage.setItem('ap_opportunities', JSON.stringify(STATE.opportunities));
  localStorage.setItem('ap_activities', JSON.stringify(STATE.activities));
}

function line(text) { return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">${text}</div>`; }
function actions(entity, id) { return `<span class="card-sub"> <button class="btn-secondary" style="padding:2px 8px" onclick="editEntity('${entity}','${id}')">EDIT</button> <button class="btn-secondary" style="padding:2px 8px" onclick="deleteEntity('${entity}','${id}')">DELETE</button></span>`; }

function renderLeads() {
  const q = getSearch('leads');
  const statusFilter = getExtraFilter('leads');
  const rows = STATE.leads
    .filter(byOwnerFilter)
    .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
    .filter(r => byText(r, ['name', 'company', 'email', 'phone', 'notes', 'owner', 'status'], q));
  const box = document.getElementById('leadsList');
  if (!box) return;
  if (!rows.length) return box.innerHTML = '<div class="card-sub">No leads found.</div>';
  box.innerHTML = rows.slice().reverse().map(l => line(`<strong>${l.name}</strong> — ${l.status}${l.company ? ` · ${l.company}` : ''}<br><span class="card-sub">owner: ${l.owner || '-'}${l.email ? ` · ${l.email}` : ''}</span>${actions('leads', l.id)}`)).join('');
}

function renderAccounts() {
  const q = getSearch('accounts');
  const rows = STATE.accounts
    .filter(byOwnerFilter)
    .filter(r => byText(r, ['name', 'industry', 'website', 'notes', 'owner'], q));
  const box = document.getElementById('accountsList');
  if (!box) return;
  if (!rows.length) return box.innerHTML = '<div class="card-sub">No accounts found.</div>';
  box.innerHTML = rows.slice().reverse().map(a => line(`<strong>${a.name}</strong>${a.industry ? ` — ${a.industry}` : ''}<br><span class="card-sub">owner: ${a.owner || '-'}${a.website ? ` · ${a.website}` : ''}</span>${actions('accounts', a.id)}`)).join('');
}

function renderContacts() {
  const q = getSearch('contacts');
  const accountFilter = getExtraFilter('contacts');
  const rows = STATE.contacts
    .filter(byOwnerFilter)
    .filter(r => accountFilter === 'all' ? true : r.account === accountFilter)
    .filter(r => byText(r, ['name', 'account', 'role', 'email', 'phone', 'owner'], q));
  const box = document.getElementById('contactsList');
  if (!box) return;
  if (!rows.length) return box.innerHTML = '<div class="card-sub">No contacts found.</div>';
  box.innerHTML = rows.slice().reverse().map(c => line(`<strong>${c.name}</strong>${c.role ? ` — ${c.role}` : ''}<br><span class="card-sub">${c.account || '-'} · owner: ${c.owner || '-'}${c.email ? ` · ${c.email}` : ''}</span>${actions('contacts', c.id)}`)).join('');
}

function renderOpportunities() {
  const q = getSearch('opportunities');
  const stageFilter = getExtraFilter('opportunities');
  const rows = STATE.opportunities
    .filter(byOwnerFilter)
    .filter(r => stageFilter === 'all' ? true : r.stage === stageFilter)
    .filter(r => byText(r, ['name', 'account', 'stage', 'notes', 'owner'], q));
  const box = document.getElementById('opportunitiesList');
  if (!box) return;
  if (!rows.length) return box.innerHTML = '<div class="card-sub">No opportunities found.</div>';
  box.innerHTML = rows.slice().reverse().map(o => line(`<strong>${o.name}</strong> — ${o.stage}<br><span class="card-sub">${o.account || '-'} · $${(o.value || 0).toFixed(2)} · owner: ${o.owner || '-'}</span>${actions('opportunities', o.id)}`)).join('');
}

function renderActivities() {
  const q = getSearch('activities');
  const typeFilter = getExtraFilter('activities');
  const rows = STATE.activities
    .filter(byOwnerFilter)
    .filter(r => typeFilter === 'all' ? true : r.type === typeFilter)
    .filter(r => byText(r, ['type', 'subject', 'relatedType', 'relatedName', 'notes', 'owner'], q));
  const box = document.getElementById('activitiesList');
  if (!box) return;
  if (!rows.length) return box.innerHTML = '<div class="card-sub">No activities found.</div>';
  box.innerHTML = rows.slice().reverse().map(a => line(`<strong>${a.type}</strong> — ${a.subject}<br><span class="card-sub">${a.relatedType}: ${a.relatedName} · owner: ${a.owner || '-'}${a.dueDate ? ` · due: ${a.dueDate}` : ''}</span>${actions('activities', a.id)}`)).join('');
}

function refreshDashboard() {
  const leads = STATE.leads.filter(byOwnerFilter);
  const accounts = STATE.accounts.filter(byOwnerFilter);
  const contacts = STATE.contacts.filter(byOwnerFilter);
  const opps = STATE.opportunities.filter(byOwnerFilter);

  const openOpps = opps.filter(o => !['Closed Won', 'Closed Lost'].includes(o.stage));
  const openValue = openOpps.reduce((s, o) => s + (o.value || 0), 0);

  document.getElementById('dashLeads').textContent = String(leads.length);
  document.getElementById('dashAccounts').textContent = String(accounts.length);
  document.getElementById('dashContacts').textContent = String(contacts.length);
  document.getElementById('dashOpenOpps').textContent = String(openOpps.length);
  document.getElementById('dashOpenValue').textContent = `$${openValue.toFixed(2)}`;

  const stageTotals = {};
  AP.opportunityStages.forEach(s => { stageTotals[s] = { count: 0, value: 0 }; });
  opps.forEach(o => {
    if (!stageTotals[o.stage]) stageTotals[o.stage] = { count: 0, value: 0 };
    stageTotals[o.stage].count += 1;
    stageTotals[o.stage].value += (o.value || 0);
  });

  const box = document.getElementById('stageTotals');
  box.innerHTML = Object.entries(stageTotals)
    .filter(([, v]) => v.count > 0)
    .map(([stage, v]) => line(`<strong>${stage}</strong> · ${v.count} · $${v.value.toFixed(2)}`))
    .join('') || '<div class="card-sub">No opportunities yet.</div>';
}

function editEntity(entity, id) {
  const arr = STATE[entity];
  const row = arr.find(r => r.id === id);
  if (!row) return;
  const patch = {};
  Object.keys(row).forEach(k => {
    if (['id', 'createdAt'].includes(k)) return;
    const v = prompt(`Edit ${k}:`, row[k] ?? '');
    if (v === null) return;
    patch[k] = k === 'value' ? Number(v || 0) : normalize(v);
  });
  Object.assign(row, patch);
  saveAll();
  renderAll();
  toast('Updated ✓');
}

function deleteEntity(entity, id) {
  if (!confirm('Delete this record?')) return;
  STATE[entity] = STATE[entity].filter(r => r.id !== id);
  saveAll();
  renderAll();
  toast('Deleted ✓');
}

async function submitLead(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), name: normalize(fd.name), company: normalize(fd.company), email: normalize(fd.email), phone: normalize(fd.phone), status: normalize(fd.status) || 'New', notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.name) return toast('Lead name is required', true);
  STATE.leads.push(row); saveAll(); try { await syncLead(row); } catch (_) {}
  e.target.reset(); initPickers(); updateOwnerInputs(); renderLeads(); refreshDashboard(); toast('Lead saved ✓');
}

async function submitAccount(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), name: normalize(fd.name), industry: normalize(fd.industry), website: normalize(fd.website), notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.name) return toast('Account name is required', true);
  if (STATE.accounts.some(a => key(a.name) === key(row.name))) return toast('Account already exists', true);
  STATE.accounts.push(row); if (!STATE.currentAccount) setAccount(row.name); saveAll(); try { await syncAccount(row); } catch (_) {}
  e.target.reset(); updateOwnerInputs(); renderAccountSelect(); renderAccounts(); refreshDashboard(); renderContacts(); toast('Account saved ✓');
}

async function submitContact(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), account: normalize(fd.account), name: normalize(fd.name), role: normalize(fd.role), email: normalize(fd.email), phone: normalize(fd.phone), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.account || !row.name) return toast('Account and contact name are required', true);
  if (STATE.contacts.some(c => key(c.account) === key(row.account) && key(c.name) === key(row.name))) return toast('Contact already exists for this account', true);
  STATE.contacts.push(row); if (!STATE.currentContact) setContact(row.name); saveAll(); try { await syncContact(row); } catch (_) {}
  e.target.reset(); updateOwnerInputs(); renderContactSelect(); renderContacts(); refreshDashboard(); toast('Contact saved ✓');
}

async function submitOpportunity(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), account: normalize(fd.account), name: normalize(fd.name), stage: normalize(fd.stage) || 'Prospecting', value: Number(fd.value || 0), closeDate: normalize(fd.closeDate), notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.account || !row.name) return toast('Account and opportunity are required', true);
  STATE.opportunities.push(row); saveAll(); try { await syncOpportunity(row); } catch (_) {}
  e.target.reset(); initPickers(); updateOwnerInputs(); renderOpportunities(); refreshDashboard(); toast('Opportunity saved ✓');
}

async function submitActivity(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), type: normalize(fd.type), subject: normalize(fd.subject), relatedType: normalize(fd.relatedType), relatedName: normalize(fd.relatedName), dueDate: normalize(fd.dueDate), notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.type || !row.subject || !row.relatedName) return toast('Type, subject and related name are required', true);
  STATE.activities.push(row); saveAll(); try { await syncActivity(row); } catch (_) {}
  e.target.reset(); initPickers(); updateOwnerInputs(); renderActivities(); toast('Activity saved ✓');
}

function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: AP.version,
    state: {
      accounts: STATE.accounts,
      contacts: STATE.contacts,
      leads: STATE.leads,
      opportunities: STATE.opportunities,
      activities: STATE.activities
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ap-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exported ✓');
}

function triggerRestoreFile() { document.getElementById('restoreFileInput')?.click(); }

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      const s = parsed.state || parsed;
      if (!confirm('Restore backup and replace current local CRM data?')) return;
      STATE.accounts = Array.isArray(s.accounts) ? s.accounts : [];
      STATE.contacts = Array.isArray(s.contacts) ? s.contacts : [];
      STATE.leads = Array.isArray(s.leads) ? s.leads : [];
      STATE.opportunities = Array.isArray(s.opportunities) ? s.opportunities : [];
      STATE.activities = Array.isArray(s.activities) ? s.activities : [];
      saveAll();
      renderAll();
      toast('Backup restored ✓');
    } catch {
      toast('Invalid backup JSON', true);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function renderAll() {
  renderAccountSelect();
  renderContactSelect();

  const contactsFilter = document.getElementById('contactsFilter');
  if (contactsFilter) {
    const selected = contactsFilter.value || 'all';
    contactsFilter.innerHTML = '<option value="all">ALL_ACCOUNTS</option>' +
      [...new Set(STATE.accounts.map(a => a.name))].map(a => `<option value="${a}">${a}</option>`).join('');
    if ([...contactsFilter.options].some(o => o.value === selected)) contactsFilter.value = selected;
  }

  const activitiesFilter = document.getElementById('activitiesFilter');
  if (activitiesFilter && !activitiesFilter.dataset.init) {
    activitiesFilter.innerHTML = '<option value="all">ALL_TYPES</option>' + AP.activityTypes.map(t => `<option value="${t}">${t}</option>`).join('');
    activitiesFilter.dataset.init = '1';
  }

  renderLeads();
  renderAccounts();
  renderContacts();
  renderOpportunities();
  renderActivities();
  refreshDashboard();
}

function initVersion() {
  ['versionBadge', 'menuVersion', 'footerVersion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = AP.version;
  });
}

function init() {
  initVersion();
  renderUserSelect();
  initPickers();
  const filterSel = document.getElementById('operatorFilter');
  if (filterSel) filterSel.value = getOperatorFilter();
  renderAll();
  updateOwnerInputs();
  updateMenuStatus();
}

document.addEventListener('DOMContentLoaded', init);
