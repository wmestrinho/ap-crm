/**
 * AP CRM app logic
 * v1.7.0: data layer on Cloudflare D1 (via Worker /api/*); localStorage is now an offline cache
 */

const EDIT_STATE = { entity: '', id: '' };

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast${isError ? ' error' : ''}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2600);
}

function go(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId)?.classList.add('active');
  if (viewId === 'dashboardView') refreshDashboard();
}

const normalize = (v) => (v || '').trim();
const key = (v) => normalize(v).toLowerCase();

function setOperatorFilter(val) {
  localStorage.setItem('ap_operator_filter', val || 'all');
  renderAll();
}
const getOperatorFilter = () => localStorage.getItem('ap_operator_filter') || 'all';
const byOwnerFilter = (row) => getOperatorFilter() !== 'mine' || row.owner === STATE.currentUser;

const getSearch = (viewKey) => key(document.getElementById(`${viewKey}Search`)?.value || '');
const getExtraFilter = (viewKey) => normalize(document.getElementById(`${viewKey}Filter`)?.value || 'all');

function byText(row, fields, q) {
  if (!q) return true;
  return fields.some(f => key(row[f]).includes(q));
}

function line(text, extraStyle = '') {
  return `<div style="padding:8px 0;border-bottom:1px solid var(--border);${extraStyle}">${text}</div>`;
}

function actions(entity, id) {
  const btn = (label, fn) => `<button class="btn-secondary" type="button" style="padding:2px 8px" onclick="${fn}">${label}</button>`;
  const quick = entity === 'opportunities' ? ` ${btn('NEXT STAGE', `moveOpportunityToNextStage('${id}')`)}` : '';
  const activity = entity === 'activities' ? ` ${btn('TOGGLE DONE', `toggleActivityStatus('${id}')`)}` : '';
  return `<span class="card-sub"> ${btn('EDIT', `editEntity('${entity}','${id}')`)} ${btn('DELETE', `deleteEntity('${entity}','${id}')`)}${quick}${activity}</span>`;
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
  const el = document.getElementById('menuStatusLine');
  if (!el) return;
  el.textContent = `[ USER: ${STATE.currentUser || 'NO_USER'} | ACCOUNT: ${STATE.currentAccount || 'NO_ACCOUNT'} | CONTACT: ${STATE.currentContact || 'NO_CONTACT'} ]`;
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
  const names = [...new Set(STATE.accounts.map(a => a.name).filter(Boolean))].sort();
  const current = document.getElementById('currentAccount');
  if (current) {
    current.innerHTML = '<option value="">NO_ACCOUNT</option>';
    names.forEach(name => {
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
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    if (selected && names.includes(selected)) sel.value = selected;
    if (!sel.value && STATE.currentAccount) sel.value = STATE.currentAccount;
  });
}

function renderContactSelect() {
  const sel = document.getElementById('currentContact');
  if (!sel) return;
  const names = STATE.contacts
    .filter(c => !STATE.currentAccount || c.account === STATE.currentAccount)
    .map(c => c.name)
    .filter(Boolean)
    .sort();
  sel.innerHTML = '<option value="">NO_CONTACT</option>';
  names.forEach(name => {
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

  const activitiesFilter = document.getElementById('activitiesFilter');
  if (activitiesFilter) activitiesFilter.innerHTML = '<option value="all">ALL_TYPES</option>' + AP.activityTypes.map(t => `<option value="${t}">${t}</option>`).join('');
}

function saveAll() {
  localStorage.setItem('ap_accounts', JSON.stringify(STATE.accounts));
  localStorage.setItem('ap_contacts', JSON.stringify(STATE.contacts));
  localStorage.setItem('ap_leads', JSON.stringify(STATE.leads));
  localStorage.setItem('ap_opportunities', JSON.stringify(STATE.opportunities));
  localStorage.setItem('ap_activities', JSON.stringify(STATE.activities));
}

function getFilteredRows(entity) {
  if (entity === 'leads') {
    const q = getSearch('leads');
    const statusFilter = getExtraFilter('leads');
    return STATE.leads.filter(byOwnerFilter)
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => byText(r, ['name', 'company', 'email', 'phone', 'notes', 'owner', 'status'], q));
  }
  if (entity === 'accounts') {
    const q = getSearch('accounts');
    return STATE.accounts.filter(byOwnerFilter)
      .filter(r => byText(r, ['name', 'industry', 'website', 'notes', 'owner'], q));
  }
  if (entity === 'contacts') {
    const q = getSearch('contacts');
    const accountFilter = getExtraFilter('contacts');
    return STATE.contacts.filter(byOwnerFilter)
      .filter(r => accountFilter === 'all' || r.account === accountFilter)
      .filter(r => byText(r, ['name', 'account', 'role', 'email', 'phone', 'owner'], q));
  }
  if (entity === 'opportunities') {
    const q = getSearch('opportunities');
    const stageFilter = getExtraFilter('opportunities');
    return STATE.opportunities.filter(byOwnerFilter)
      .filter(r => stageFilter === 'all' || r.stage === stageFilter)
      .filter(r => byText(r, ['name', 'account', 'stage', 'notes', 'owner'], q));
  }
  if (entity === 'activities') {
    const q = getSearch('activities');
    const typeFilter = getExtraFilter('activities');
    return STATE.activities.filter(byOwnerFilter)
      .filter(r => typeFilter === 'all' || r.type === typeFilter)
      .filter(r => byText(r, ['type', 'subject', 'relatedType', 'relatedName', 'notes', 'owner', 'status'], q));
  }
  return [];
}

function renderLeads() {
  const rows = getFilteredRows('leads');
  const box = document.getElementById('leadsList');
  if (!box) return;
  box.innerHTML = rows.length
    ? rows.slice().reverse().map(l => line(`<strong>${l.name}</strong> — ${l.status}${l.company ? ` · ${l.company}` : ''}<br><span class="card-sub">owner: ${l.owner || '-'}${l.email ? ` · ${l.email}` : ''}</span>${actions('leads', l.id)}`)).join('')
    : '<div class="card-sub">No leads found.</div>';
}

function renderAccounts() {
  const rows = getFilteredRows('accounts');
  const box = document.getElementById('accountsList');
  if (!box) return;
  box.innerHTML = rows.length
    ? rows.slice().reverse().map(a => line(`<strong>${a.name}</strong>${a.industry ? ` — ${a.industry}` : ''}<br><span class="card-sub">owner: ${a.owner || '-'}${a.website ? ` · ${a.website}` : ''}</span>${actions('accounts', a.id)}`)).join('')
    : '<div class="card-sub">No accounts found.</div>';
}

function renderContacts() {
  const rows = getFilteredRows('contacts');
  const box = document.getElementById('contactsList');
  if (!box) return;
  box.innerHTML = rows.length
    ? rows.slice().reverse().map(c => line(`<strong>${c.name}</strong>${c.role ? ` — ${c.role}` : ''}<br><span class="card-sub">${c.account || '-'} · owner: ${c.owner || '-'}${c.email ? ` · ${c.email}` : ''}</span>${actions('contacts', c.id)}`)).join('')
    : '<div class="card-sub">No contacts found.</div>';
}

function renderOpportunities() {
  const rows = getFilteredRows('opportunities');
  const box = document.getElementById('opportunitiesList');
  if (!box) return;
  box.innerHTML = rows.length
    ? rows.slice().reverse().map(o => line(`<strong>${o.name}</strong> — ${o.stage}<br><span class="card-sub">${o.account || '-'} · $${(o.value || 0).toFixed(2)} · owner: ${o.owner || '-'}</span>${actions('opportunities', o.id)}`)).join('')
    : '<div class="card-sub">No opportunities found.</div>';
}

function isOverdue(activity) {
  if (!activity.dueDate || activity.status === 'Done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(activity.dueDate) < today;
}

function renderActivities() {
  const rows = getFilteredRows('activities');
  const box = document.getElementById('activitiesList');
  if (!box) return;
  box.innerHTML = rows.length
    ? rows.slice().reverse().map(a => {
      const overdue = isOverdue(a);
      const statusMark = a.status === 'Done' ? '✅ DONE' : overdue ? '⚠ OVERDUE' : 'OPEN';
      const style = overdue ? 'background:rgba(192,71,58,0.10);' : '';
      return line(`<strong>${a.type}</strong> — ${a.subject}<br><span class="card-sub">${a.relatedType}: ${a.relatedName} · ${statusMark} · owner: ${a.owner || '-'}${a.dueDate ? ` · due: ${a.dueDate}` : ''}</span>${actions('activities', a.id)}`, style);
    }).join('')
    : '<div class="card-sub">No activities found.</div>';
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

  const totals = {};
  AP.opportunityStages.forEach(s => { totals[s] = { count: 0, value: 0 }; });
  opps.forEach(o => {
    if (!totals[o.stage]) totals[o.stage] = { count: 0, value: 0 };
    totals[o.stage].count += 1;
    totals[o.stage].value += (o.value || 0);
  });
  const box = document.getElementById('stageTotals');
  box.innerHTML = Object.entries(totals)
    .filter(([, v]) => v.count > 0)
    .map(([stage, v]) => line(`<strong>${stage}</strong> · ${v.count} · $${v.value.toFixed(2)}`))
    .join('') || '<div class="card-sub">No opportunities yet.</div>';
}

function labelForField(field) {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function closeEditModal() {
  document.getElementById('editModal')?.classList.remove('open');
}

function editEntity(entity, id) {
  const row = (STATE[entity] || []).find(r => r.id === id);
  if (!row) return;
  EDIT_STATE.entity = entity;
  EDIT_STATE.id = id;

  const title = document.getElementById('editModalTitle');
  const fields = document.getElementById('editModalFields');
  if (!title || !fields) return;
  title.textContent = `// Edit ${entity.slice(0, -1).toUpperCase()}`;

  const selectMap = { status: AP.leadStatus, stage: AP.opportunityStages, type: AP.activityTypes };
  if (entity === 'activities') selectMap.status = ['Open', 'Done'];

  fields.innerHTML = Object.keys(row)
    .filter(k => !['id', 'createdAt'].includes(k))
    .map(k => {
      const val = row[k] ?? '';
      if (selectMap[k]) {
        const options = selectMap[k].map(v => `<option value="${v}" ${v === val ? 'selected' : ''}>${v}</option>`).join('');
        return `<div class="form-group"><label>${labelForField(k)}</label><select name="${k}">${options}</select></div>`;
      }
      const inputType = k === 'value' ? 'number' : (k === 'email' ? 'email' : (k === 'closeDate' || k === 'dueDate' ? 'date' : 'text'));
      const step = k === 'value' ? ' step="0.01" min="0"' : '';
      return `<div class="form-group"><label>${labelForField(k)}</label><input name="${k}" type="${inputType}" value="${String(val).replace(/"/g, '&quot;')}"${step} /></div>`;
    }).join('');

  document.getElementById('editModal')?.classList.add('open');
}

function saveEditModal(e) {
  e.preventDefault();
  const row = (STATE[EDIT_STATE.entity] || []).find(r => r.id === EDIT_STATE.id);
  if (!row) return closeEditModal();
  const data = Object.fromEntries(new FormData(e.target).entries());
  Object.keys(data).forEach(k => {
    row[k] = k === 'value' ? Number(data[k] || 0) : normalize(data[k]);
  });
  if ('name' in row && !row.name) return toast('Name is required', true);
  if ('account' in row && !row.account) return toast('Account is required', true);

  saveAll();
  apiUpdate(EDIT_STATE.entity, EDIT_STATE.id, row).catch(() => toast('Saved locally — sync failed', true));
  renderAll();
  closeEditModal();
  toast('Updated ✓');
}

function dependencySummary(entity, id) {
  if (entity === 'accounts') {
    const row = STATE.accounts.find(r => r.id === id);
    if (!row) return '';
    const contacts = STATE.contacts.filter(c => c.account === row.name).length;
    const opps = STATE.opportunities.filter(o => o.account === row.name).length;
    const acts = STATE.activities.filter(a => a.relatedType === 'account' && a.relatedName === row.name).length;
    return `Deleting account '${row.name}' impacts: ${contacts} contact(s), ${opps} opportunity(s), ${acts} activity(s).`;
  }
  if (entity === 'contacts') {
    const row = STATE.contacts.find(r => r.id === id);
    if (!row) return '';
    const acts = STATE.activities.filter(a => a.relatedType === 'contact' && a.relatedName === row.name).length;
    return `Deleting contact '${row.name}' impacts: ${acts} related activity(s).`;
  }
  return 'Delete this record?';
}

function deleteEntity(entity, id) {
  const msg = dependencySummary(entity, id);
  if (!confirm(msg + '\n\nContinue?')) return;

  if (entity === 'accounts') {
    const account = STATE.accounts.find(r => r.id === id);
    if (account) {
      STATE.contacts = STATE.contacts.filter(c => c.account !== account.name);
      STATE.opportunities = STATE.opportunities.filter(o => o.account !== account.name);
      STATE.activities = STATE.activities.filter(a => !(a.relatedType === 'account' && a.relatedName === account.name));
      if (STATE.currentAccount === account.name) setAccount('');
    }
  }
  if (entity === 'contacts') {
    const contact = STATE.contacts.find(r => r.id === id);
    if (contact) {
      STATE.activities = STATE.activities.filter(a => !(a.relatedType === 'contact' && a.relatedName === contact.name));
      if (STATE.currentContact === contact.name) setContact('');
    }
  }

  STATE[entity] = (STATE[entity] || []).filter(r => r.id !== id);
  saveAll();
  apiDelete(entity, id).catch(() => toast('Deleted locally — sync failed', true));
  renderAll();
  toast('Deleted ✓');
}

function moveOpportunityToNextStage(id) {
  const row = STATE.opportunities.find(o => o.id === id);
  if (!row) return;
  const idx = AP.opportunityStages.indexOf(row.stage);
  if (idx < 0 || idx >= AP.opportunityStages.length - 1) return toast('Already at final stage');
  row.stage = AP.opportunityStages[idx + 1];
  saveAll();
  apiUpdate('opportunities', id, { stage: row.stage }).catch(() => toast('Saved locally — sync failed', true));
  renderAll();
  toast(`Moved to ${row.stage} ✓`);
}

function toggleActivityStatus(id) {
  const row = STATE.activities.find(a => a.id === id);
  if (!row) return;
  row.status = row.status === 'Done' ? 'Open' : 'Done';
  saveAll();
  apiUpdate('activities', id, { status: row.status }).catch(() => toast('Saved locally — sync failed', true));
  renderActivities();
  toast(`Activity ${row.status}`);
}

async function submitLead(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), name: normalize(fd.name), company: normalize(fd.company), email: normalize(fd.email), phone: normalize(fd.phone), status: normalize(fd.status) || 'New', notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.name) return toast('Lead name is required', true);
  STATE.leads.push(row); saveAll(); try { await apiCreate('leads', row); } catch (_) { toast('Saved locally — sync failed', true); }
  e.target.reset(); initPickers(); updateOwnerInputs(); renderLeads(); refreshDashboard(); toast('Lead saved ✓');
}

async function submitAccount(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), name: normalize(fd.name), industry: normalize(fd.industry), website: normalize(fd.website), notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.name) return toast('Account name is required', true);
  if (STATE.accounts.some(a => key(a.name) === key(row.name))) return toast('Account already exists', true);
  STATE.accounts.push(row); if (!STATE.currentAccount) setAccount(row.name); saveAll(); try { await apiCreate('accounts', row); } catch (_) { toast('Saved locally — sync failed', true); }
  e.target.reset(); updateOwnerInputs(); renderAll(); toast('Account saved ✓');
}

async function submitContact(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), account: normalize(fd.account), name: normalize(fd.name), role: normalize(fd.role), email: normalize(fd.email), phone: normalize(fd.phone), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.account || !row.name) return toast('Account and contact name are required', true);
  if (STATE.contacts.some(c => key(c.account) === key(row.account) && key(c.name) === key(row.name))) return toast('Contact already exists for this account', true);
  STATE.contacts.push(row); if (!STATE.currentContact) setContact(row.name); saveAll(); try { await apiCreate('contacts', row); } catch (_) { toast('Saved locally — sync failed', true); }
  e.target.reset(); updateOwnerInputs(); renderAll(); toast('Contact saved ✓');
}

async function submitOpportunity(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), account: normalize(fd.account), name: normalize(fd.name), stage: normalize(fd.stage) || 'Prospecting', value: Number(fd.value || 0), closeDate: normalize(fd.closeDate), notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.account || !row.name) return toast('Account and opportunity are required', true);
  STATE.opportunities.push(row); saveAll(); try { await apiCreate('opportunities', row); } catch (_) { toast('Saved locally — sync failed', true); }
  e.target.reset(); initPickers(); updateOwnerInputs(); renderAll(); toast('Opportunity saved ✓');
}

async function submitActivity(e) {
  e.preventDefault();
  if (!STATE.currentUser) return toast('Select operator first', true);
  const fd = Object.fromEntries(new FormData(e.target).entries());
  const row = { id: crypto.randomUUID(), type: normalize(fd.type), subject: normalize(fd.subject), relatedType: normalize(fd.relatedType), relatedName: normalize(fd.relatedName), dueDate: normalize(fd.dueDate), status: normalize(fd.status) || 'Open', notes: normalize(fd.notes), owner: STATE.currentUser, createdAt: new Date().toISOString() };
  if (!row.type || !row.subject || !row.relatedName) return toast('Type, subject and related name are required', true);
  STATE.activities.push(row); saveAll(); try { await apiCreate('activities', row); } catch (_) { toast('Saved locally — sync failed', true); }
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
  downloadJSON(payload, `ap-crm-backup-${new Date().toISOString().slice(0, 10)}.json`);
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

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

function downloadText(text, filename, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(obj, filename) {
  downloadText(JSON.stringify(obj, null, 2), filename, 'application/json');
}

function exportEntityCSV(entity) {
  const rows = getFilteredRows(entity);
  if (!rows.length) return toast('No rows to export', true);
  downloadText(toCSV(rows), `ap-crm-${entity}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  toast(`Exported ${rows.length} ${entity} row(s) ✓`);
}

// Hydrate from D1 (the source of truth). Remote rows win on id conflict;
// any local-only rows that never synced are retained as a safety net.
async function refreshFromDB(announce = true) {
  try {
    const res = await apiGetAll();
    if (!res?.ok) { if (announce) toast('Refresh failed', true); return; }

    const mergeById = (localRows, remoteRows) => {
      const map = new Map();
      localRows.forEach(r => { if (r.id) map.set(r.id, r); });
      remoteRows.forEach(r => map.set(r.id, r)); // remote authoritative
      return [...map.values()];
    };

    STATE.accounts = mergeById(STATE.accounts, res.accounts || []);
    STATE.contacts = mergeById(STATE.contacts, res.contacts || []);
    STATE.leads = mergeById(STATE.leads, res.leads || []);
    STATE.opportunities = mergeById(STATE.opportunities, res.opportunities || []);
    STATE.activities = mergeById(STATE.activities, res.activities || []);

    saveAll();
    renderAll();
    if (announce) toast('Refreshed from database ✓');
  } catch {
    if (announce) toast('Database unavailable — showing cached data', true);
  }
}

function renderAll() {
  renderAccountSelect();
  renderContactSelect();

  const contactsFilter = document.getElementById('contactsFilter');
  if (contactsFilter) {
    const selected = contactsFilter.value || 'all';
    contactsFilter.innerHTML = '<option value="all">ALL_ACCOUNTS</option>' + [...new Set(STATE.accounts.map(a => a.name))].map(a => `<option value="${a}">${a}</option>`).join('');
    if ([...contactsFilter.options].some(o => o.value === selected)) contactsFilter.value = selected;
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
  refreshFromDB(false); // hydrate from D1; falls back to cached localStorage if offline
}

document.addEventListener('DOMContentLoaded', init);
