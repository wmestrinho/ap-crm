/**
 * AP CRM | Absolutely Plausible — Config
 * Update SHEETS_SCRIPT_URL after deploying Google Apps Script.
 */

const AP = {
  // ── Version (single source of truth) ────────────────────────
  version: 'v1.6.0',

  business: {
    name:    'Absolutely Plausible',
    abbr:    'AP',
    phone:   '',
    email:   'info@absolutelyplausible.com',
    address: 'Orlando, FL',
    tagline: 'Customer Relationship Management',
    instagram: '@absolutelyplausible',
  },

  // ── Google Apps Script Web App URL ──────────────────────────
  // Shared with AP Ops (same backend, same Google Sheet)
  SHEETS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzT2qCIlQYv8BArw6OGlqWsRrdMQsCjFobUBf7rSdzmwFzJnoMPO0-JhC5TIfmxihMq/exec',

  // ── Team members (user attribution) ───────
  team: ['Luiz', 'Bebeco', 'Samuel'],

  // ── Opportunity Stages ─────────────────────────────────────
  opportunityStages: [
    'Prospecting',
    'Qualification',
    'Needs Analysis',
    'Value Proposition',
    'Id. Decision Makers',
    'Perception Analysis',
    'Proposal/Price Quote',
    'Negotiation/Review',
    'Closed Won',
    'Closed Lost'
  ],

  // ── Activity Types ─────────────────────────────────────────
  activityTypes: [
    'Call',
    'Meeting',
    'Email',
    'Task',
    'Other'
  ],

  // ── Lead Status ─────────────────────────────────────────────
  leadStatus: [
    'New',
    'Attempted Contact',
    'Open',
    'Qualified',
    'Unqualified',
    'Converted'
  ],

  // ── Templates (example) ─────────────────────────────────────
  templates: [
    {
      name: 'Initial Contact',
      description: 'First outreach to a new lead',
      activity: [
        { type: 'Call', subject: 'Introduction call', description: 'Introduce our services' }
      ]
    }
  ]
};

// ── App state (in-memory, persisted to localStorage) ───────────
const STATE = {
  currentUser:    localStorage.getItem('ap_user')             || '',
  currentAccount: localStorage.getItem('ap_account')          || '',
  currentContact: localStorage.getItem('ap_contact')          || '',
  currentOpportunity: localStorage.getItem('ap_opportunity')  || '',
  currentLead:    localStorage.getItem('ap_lead')             || '',

  accounts:       JSON.parse(localStorage.getItem('ap_accounts')       || '[]'),
  contacts:       JSON.parse(localStorage.getItem('ap_contacts')       || '[]'),
  leads:          JSON.parse(localStorage.getItem('ap_leads')          || '[]'),
  opportunities:  JSON.parse(localStorage.getItem('ap_opportunities')  || '[]'),
  activities:     JSON.parse(localStorage.getItem('ap_activities')     || '[]'),
};

function setUser(val) {
  STATE.currentUser = val;
  localStorage.setItem('ap_user', val);
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function setAccount(val) {
  STATE.currentAccount = val;
  localStorage.setItem('ap_account', val);
  // Selecting an account may affect related contacts/opportunities
  if (typeof renderContactSelect === 'function') renderContactSelect();
  if (typeof renderOpportunitySelect === 'function') renderOpportunitySelect();
  updateAccountBadges();
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function setContact(val) {
  STATE.currentContact = val;
  localStorage.setItem('ap_contact', val);
  updateContactBadges();
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function setOpportunity(val) {
  STATE.currentOpportunity = val;
  localStorage.setItem('ap_opportunity', val);
  updateOpportunityBadges();
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function setLead(val) {
  STATE.currentLead = val;
  localStorage.setItem('ap_lead', val);
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function updateAccountBadges() {
  const label = STATE.currentAccount
    ? STATE.currentAccount + (STATE.currentContact ? ` / ${STATE.currentContact}` : '')
    : 'No account selected';
  document.querySelectorAll('.event-badge').forEach(el => {
    if (el.dataset.static === 'true') return;
    el.textContent = label;
  });
  const sel = document.getElementById('opp_account');
  if (sel && !sel.value) sel.value = STATE.currentAccount;
}

function updateContactBadges() {
  const label = STATE.currentContact
    ? STATE.currentContact + (STATE.currentAccount ? ` @ ${STATE.currentAccount}` : '')
    : 'No contact selected';
  document.querySelectorAll('.event-badge').forEach(el => {
    if (el.dataset.static === 'true') return;
    el.textContent = label;
  });
}

function updateOpportunityBadges() {
  const label = STATE.currentOpportunity
    ? STATE.currentOpportunity + (STATE.currentAccount ? ` (${STATE.currentAccount})` : '')
    : 'No opportunity selected';
  document.querySelectorAll('.event-badge').forEach(el => {
    if (el.dataset.static === 'true') return;
    el.textContent = label;
  });
}

function saveAccounts() {
  localStorage.setItem('ap_accounts', JSON.stringify(STATE.accounts));
}

function saveContacts() {
  localStorage.setItem('ap_contacts', JSON.stringify(STATE.contacts));
}

function saveLeads() {
  localStorage.setItem('ap_leads', JSON.stringify(STATE.leads));
}

function saveOpportunities() {
  localStorage.setItem('ap_opportunities', JSON.stringify(STATE.opportunities));
}

function saveActivities() {
  localStorage.setItem('ap_activities', JSON.stringify(STATE.activities));
}

function saveLocalActivity(activity) {
  STATE.activities.push({ ...activity, savedAt: new Date().toISOString() });
  localStorage.setItem('ap_activities', JSON.stringify(STATE.activities));
}

function saveLocalAccount(account) {
  if (account && !STATE.accounts.some(a => a.name === account.name)) {
    STATE.accounts.push(account);
    localStorage.setItem('ap_accounts', JSON.stringify(STATE.accounts));
  }
}

function saveLocalContact(contact) {
  if (contact && !STATE.contacts.some(c => c.name === contact.name)) {
    STATE.contacts.push(contact);
    localStorage.setItem('ap_contacts', JSON.stringify(STATE.contacts));
  }
}

function saveLocalLead(lead) {
  if (lead && !STATE.leads.some(l => l.name === lead.name)) {
    STATE.leads.push(lead);
    localStorage.setItem('ap_leads', JSON.stringify(STATE.leads));
  }
}

function saveLocalOpportunity(opportunity) {
  if (opportunity && !STATE.opportunities.some(o => o.name === opportunity.name)) {
    STATE.opportunities.push(opportunity);
    localStorage.setItem('ap_opportunities', JSON.stringify(STATE.opportunities));
  }
}
