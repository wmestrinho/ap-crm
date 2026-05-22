/**
 * AP Ops | Absolutely Plausible — Config
 * Update SHEETS_SCRIPT_URL after deploying Google Apps Script.
 */

const AP = {
  // ── Version (single source of truth) ────────────────────────
  version: 'v1.2.0 beta',

  business: {
    name:    'Absolutely Plausible',
    abbr:    'AP',
    phone:   '',
    email:   'info@absolutelyplausible.com',
    address: 'Orlando, FL',
    tagline: 'Operations & Invoicing',
    instagram: '@absolutelyplausible',
  },

  // ── Google Apps Script Web App URL ──────────────────────────
  // After deploying Apps Script, paste the URL here:
  SHEETS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzT2qCIlQYv8BArw6OGlqWsRrdMQsCjFobUBf7rSdzmwFzJnoMPO0-JhC5TIfmxihMq/exec',

  // ── Team members (operator attribution — "logged by") ───────
  team: ['Luiz', 'Bebeco', 'Samuel'],

  // ── Services ─────────────────────────────────────────────────
  // Common karting services with default rates (can be overridden per-entry)
  // Format: 'Service Name|default_rate' (rate used for Hourly, ignored for Custom)
  pricing: {
    'Alignment': 75.0,
    'Tuning': 65.0,
    'Brake Service': 85.0,
    'Engine Check': 90.0,
    'Tire Change': 40.0,
    'Fuel System Clean': 50.0,
    'Custom / Quoted': 0.0
  },

  // ── Templates ────────────────────────────────────────────────
  // Predefined work/expense bundles for common events or services
  // Each template can contain work and expense entries
  templates: [
    {
      name: 'Race Weekend Setup',
      description: 'Full kart preparation for a race weekend',
      work: [
        { serviceName: 'Engine Check', quantity: 1, rate: 90, description: 'Comprehensive engine inspection and tune-up' },
        { serviceName: 'Alignment', quantity: 1, rate: 75, description: 'Front and rear alignment' },
        { serviceName: 'Brake Service', quantity: 1, rate: 85, description: 'Pad replacement, rotor check, bleed' },
        { serviceName: 'Tire Change', quantity: 2, rate: 40, description: 'Mount and balance new slicks' }
      ],
      expenses: [
        { category: 'Materials', amount: 120, description: 'Two sets of slick tires' },
        { category: 'Materials', amount: 45, description: 'Brake pads and hardware' }
      ]
    },
    {
      name: 'Monthly Maintenance',
      description: 'Routine monthly kart upkeep',
      work: [
        { serviceName: 'Tuning', quantity: 1, rate: 65, description: 'Carburetor, clutch, chain adjustment' },
        { serviceName: 'Fuel System Clean', quantity: 1, rate: 50, description: 'Clean fuel lines, filter, tank' }
      ],
      expenses: [
        { category: 'Materials', amount: 30, description: 'New fuel filter and lines' }
      ]
    },
    {
      name: 'Track Day Support',
      description: 'On-track support and adjustments',
      work: [
        { serviceName: 'Tuning', quantity: 2, rate: 65, description: 'Between-session adjustments' },
        { serviceName: 'Engine Check', quantity: 1, rate: 90, description: 'Post-session inspection' }
      ],
      expenses: []
    }
  ]
};

// ── App state (in-memory, persisted to localStorage) ───────────
const STATE = {
  currentUser:    localStorage.getItem('ap_user')             || '',
  currentClient:  localStorage.getItem('ap_client')           || '',
  currentProject: localStorage.getItem('ap_project')          || '',
  clients:        JSON.parse(localStorage.getItem('ap_clients')        || '[]'),
  projects:       JSON.parse(localStorage.getItem('ap_projects')       || '[]'),
  localEntries:   JSON.parse(localStorage.getItem('ap_local_entries')  || '[]'),
  localClients:   JSON.parse(localStorage.getItem('ap_local_clients')  || '[]'),
};

function setUser(val) {
  STATE.currentUser = val;
  localStorage.setItem('ap_user', val);
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function setClient(val) {
  STATE.currentClient = val;
  localStorage.setItem('ap_client', val);
  // Selecting a client invalidates the current project unless it
  // still belongs to this client.
  const proj = STATE.projects.find(p => p.name === STATE.currentProject && p.client === val);
  if (!proj) setProject('');
  if (typeof renderProjectSelect === 'function') renderProjectSelect();
  updateClientBadges();
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function setProject(val) {
  STATE.currentProject = val;
  localStorage.setItem('ap_project', val);
  updateClientBadges();
  if (typeof updateMenuStatus === 'function') updateMenuStatus();
}

function updateClientBadges() {
  const label = STATE.currentClient
    ? STATE.currentClient + (STATE.currentProject ? ` / ${STATE.currentProject}` : '')
    : 'No client selected';
  document.querySelectorAll('.event-badge').forEach(el => {
    // Leave static info badges (e.g. invoice builder) untouched
    if (el.dataset.static === 'true') return;
    el.textContent = label;
  });
  const sel = document.getElementById('inv_event');
  if (sel && !sel.value) sel.value = STATE.currentProject;
}

function saveClients() {
  localStorage.setItem('ap_clients', JSON.stringify(STATE.clients));
}

function saveProjects() {
  localStorage.setItem('ap_projects', JSON.stringify(STATE.projects));
}

function saveLocalEntry(entry) {
  STATE.localEntries.push({ ...entry, savedAt: new Date().toISOString() });
  localStorage.setItem('ap_local_entries', JSON.stringify(STATE.localEntries));
}

function saveLocalClient(name) {
  if (name && !STATE.localClients.includes(name)) {
    STATE.localClients.push(name);
    localStorage.setItem('ap_local_clients', JSON.stringify(STATE.localClients));
  }
}
