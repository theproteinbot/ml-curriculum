// ===== STATE =====
const STORAGE_KEY = 'ml-curriculum-progress';
const NOTES_KEY = 'ml-curriculum-notes';
const SYNC_KEY = 'ml-curriculum-sync';
const GIST_FILENAME = 'ml-curriculum-data.json';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; }
  catch { return {}; }
}
function saveNotes(data) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(data));
}
function loadSyncConfig() {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; }
  catch { return {}; }
}
function saveSyncConfig(data) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(data));
}

// ===== GIST SYNC =====
const Sync = {
  _syncing: false,
  _debounceTimer: null,

  isConfigured() {
    const cfg = loadSyncConfig();
    return !!(cfg.token && cfg.gistId);
  },

  async setup(token) {
    // Validate the token by fetching user info
    const res = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) throw new Error('Invalid token');
    const user = await res.json();

    // Check if a gist already exists
    let gistId = null;
    const gistsRes = await fetch('https://api.github.com/gists?per_page=100', {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' }
    });
    if (gistsRes.ok) {
      const gists = await gistsRes.json();
      const existing = gists.find(g => g.files && g.files[GIST_FILENAME]);
      if (existing) gistId = existing.id;
    }

    // Create a new gist if none found
    if (!gistId) {
      const data = {
        description: 'ML Curriculum - Notes & Progress Sync',
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: JSON.stringify({
              version: 1,
              lastSync: new Date().toISOString(),
              progress: loadProgress(),
              notes: loadNotes()
            }, null, 2)
          }
        }
      };
      const createRes = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!createRes.ok) throw new Error('Failed to create gist');
      const gist = await createRes.json();
      gistId = gist.id;
    }

    saveSyncConfig({ token, gistId, user: user.login });
    return { user: user.login, gistId, isNew: !gistId };
  },

  async push() {
    const cfg = loadSyncConfig();
    if (!cfg.token || !cfg.gistId) return;

    const data = {
      version: 1,
      lastSync: new Date().toISOString(),
      progress: loadProgress(),
      notes: loadNotes()
    };

    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${cfg.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } }
      })
    });
    if (!res.ok) throw new Error('Failed to push to gist');
    return data.lastSync;
  },

  async pull() {
    const cfg = loadSyncConfig();
    if (!cfg.token || !cfg.gistId) return null;

    const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      headers: { 'Authorization': `token ${cfg.token}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) throw new Error('Failed to fetch gist');
    const gist = await res.json();
    const file = gist.files[GIST_FILENAME];
    if (!file) throw new Error('Sync file not found in gist');

    const data = JSON.parse(file.content);

    // Merge progress (remote wins)
    if (data.progress) {
      const local = loadProgress();
      saveProgress({ ...local, ...data.progress });
    }

    // Merge notes (keep longer version)
    if (data.notes) {
      const local = loadNotes();
      const merged = { ...local };
      for (const [key, val] of Object.entries(data.notes)) {
        if (!merged[key] || val.length > merged[key].length) {
          merged[key] = val;
        }
      }
      saveNotes(merged);
    }

    return data.lastSync;
  },

  // Debounced auto-push: waits 3s after last change before syncing
  schedulePush() {
    if (!this.isConfigured()) return;
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.push().then(() => {
        updateSyncStatus('Synced');
      }).catch(() => {
        updateSyncStatus('Sync failed');
      });
    }, 3000);
  },

  disconnect() {
    localStorage.removeItem(SYNC_KEY);
  }
};

function updateSyncStatus(text) {
  const el = document.getElementById('syncStatus');
  if (el) {
    el.textContent = text;
    if (text === 'Synced') {
      el.className = 'sync-status synced';
    } else if (text.includes('fail')) {
      el.className = 'sync-status error';
    } else {
      el.className = 'sync-status syncing';
    }
    // Reset after a few seconds
    if (text === 'Synced' || text.includes('fail')) {
      setTimeout(() => {
        if (el.textContent === text) {
          el.textContent = Sync.isConfigured() ? 'Auto-sync on' : '';
          el.className = 'sync-status';
        }
      }, 3000);
    }
  }
  // Also update notes meta labels
  document.querySelectorAll('.notes-meta').forEach(m => {
    if (text === 'Synced') {
      m.textContent = 'Synced to Gist';
      setTimeout(() => { m.textContent = Sync.isConfigured() ? 'Auto-synced' : 'Auto-saved locally'; }, 2000);
    }
  });
}

function initSync() {
  const cfg = loadSyncConfig();
  const setupPanel = document.getElementById('syncSetup');
  const connectedPanel = document.getElementById('syncConnected');
  const tokenInput = document.getElementById('syncToken');
  const connectBtn = document.getElementById('syncConnectBtn');
  const disconnectBtn = document.getElementById('syncDisconnectBtn');
  const pullBtn = document.getElementById('syncPullBtn');
  const pushBtn = document.getElementById('syncPushBtn');
  const syncUser = document.getElementById('syncUser');

  if (!setupPanel) return;

  function showState() {
    if (Sync.isConfigured()) {
      const c = loadSyncConfig();
      setupPanel.style.display = 'none';
      connectedPanel.style.display = 'block';
      if (syncUser) syncUser.textContent = c.user || 'connected';
      // Update all notes-meta labels
      document.querySelectorAll('.notes-meta').forEach(m => { m.textContent = 'Auto-synced'; });
    } else {
      setupPanel.style.display = 'block';
      connectedPanel.style.display = 'none';
      document.querySelectorAll('.notes-meta').forEach(m => { m.textContent = 'Auto-saved locally'; });
    }
  }

  showState();

  // Connect
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const token = tokenInput.value.trim();
      if (!token) return;
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';
      try {
        const result = await Sync.setup(token);
        tokenInput.value = '';
        showState();
        // Pull remote data to merge
        await Sync.pull();
        reloadUI();
        // Then push merged state
        await Sync.push();
        updateSyncStatus('Synced');
      } catch (err) {
        alert('Failed to connect: ' + err.message);
      }
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    });
  }

  // Disconnect
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      if (confirm('Disconnect sync? Your notes stay on this device but will no longer sync.')) {
        Sync.disconnect();
        showState();
        updateSyncStatus('');
      }
    });
  }

  // Manual pull
  if (pullBtn) {
    pullBtn.addEventListener('click', async () => {
      pullBtn.disabled = true;
      updateSyncStatus('Pulling...');
      try {
        await Sync.pull();
        reloadUI();
        updateSyncStatus('Synced');
      } catch (err) {
        updateSyncStatus('Pull failed');
      }
      pullBtn.disabled = false;
    });
  }

  // Manual push
  if (pushBtn) {
    pushBtn.addEventListener('click', async () => {
      pushBtn.disabled = true;
      updateSyncStatus('Pushing...');
      try {
        await Sync.push();
        updateSyncStatus('Synced');
      } catch (err) {
        updateSyncStatus('Push failed');
      }
      pushBtn.disabled = false;
    });
  }

  // Auto-pull on page load if configured
  if (Sync.isConfigured()) {
    Sync.pull().then(() => {
      reloadUI();
      updateSyncStatus('Synced');
    }).catch(() => {
      updateSyncStatus('Offline');
    });
  }
}

// Reload all UI from localStorage
function reloadUI() {
  const progress = loadProgress();
  document.querySelectorAll('.item-check').forEach(cb => {
    const item = cb.closest('[data-id]');
    if (!item) return;
    cb.checked = !!progress[item.dataset.id];
  });
  const notes = loadNotes();
  document.querySelectorAll('.notes-textarea').forEach(ta => {
    const key = ta.dataset.note;
    if (key) ta.value = notes[key] || '';
  });
  updateProgress();
}

// ===== CHECKBOX PERSISTENCE =====
function initCheckboxes() {
  const progress = loadProgress();
  const checkboxes = document.querySelectorAll('.item-check');

  checkboxes.forEach(cb => {
    const item = cb.closest('[data-id]');
    if (!item) return;
    const id = item.dataset.id;

    if (progress[id]) cb.checked = true;

    cb.addEventListener('change', () => {
      const prog = loadProgress();
      if (cb.checked) {
        prog[id] = true;
      } else {
        delete prog[id];
      }
      saveProgress(prog);
      updateProgress();
      Sync.schedulePush();
    });
  });
}

// ===== PROGRESS BAR =====
function updateProgress() {
  const total = document.querySelectorAll('[data-id]').length;
  const checked = document.querySelectorAll('.item-check:checked').length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const fill = document.getElementById('progressFill');
  const percent = document.getElementById('progressPercent');
  const stats = document.getElementById('progressStats');
  const mini = document.getElementById('progressMini');

  if (fill) fill.style.width = pct + '%';
  if (percent) percent.textContent = pct + '%';
  if (stats) stats.textContent = `${checked} / ${total} items`;
  if (mini) mini.textContent = pct + '%';
}

// ===== NAVIGATION =====
function initNav() {
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      scrollToSection(target);
      closeMobileMenu();
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[data-section="${id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, {
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0
  });

  sections.forEach(s => observer.observe(s));
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = window.innerWidth <= 768 ? 70 : 20;
  const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}
window.scrollToSection = scrollToSection;

// ===== MOBILE MENU =====
function initMobileMenu() {
  const btn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (btn) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', closeMobileMenu);
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ===== COLLAPSIBLE =====
function toggleCollapsible(el) {
  const group = el.closest('.collapsible');
  if (group) group.classList.toggle('open');
}
window.toggleCollapsible = toggleCollapsible;

// ===== RESET =====
function initReset() {
  const btn = document.getElementById('resetBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (confirm('Reset all progress and notes? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(NOTES_KEY);
      document.querySelectorAll('.item-check').forEach(cb => cb.checked = false);
      document.querySelectorAll('.notes-textarea').forEach(ta => ta.value = '');
      updateProgress();
      Sync.schedulePush();
    }
  });
}

// ===== KEYBOARD SHORTCUTS =====
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });
}

// ===== NOTES =====
function initNotes() {
  const notes = loadNotes();
  const textareas = document.querySelectorAll('.notes-textarea');

  textareas.forEach(ta => {
    const key = ta.dataset.note;
    if (!key) return;

    if (notes[key]) ta.value = notes[key];

    if (notes[key] && ta.closest('.notes-section')) {
      ta.closest('.notes-section').classList.add('open');
    }

    let saveTimeout;
    ta.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const n = loadNotes();
        if (ta.value.trim()) {
          n[key] = ta.value;
        } else {
          delete n[key];
        }
        saveNotes(n);
        const meta = ta.parentElement.querySelector('.notes-meta');
        if (meta) {
          meta.textContent = 'Saved';
          setTimeout(() => {
            meta.textContent = Sync.isConfigured() ? 'Auto-synced' : 'Auto-saved locally';
          }, 1500);
        }
        Sync.schedulePush();
      }, 500);
    });
  });
}

function toggleNotes(el) {
  const section = el.closest('.notes-section');
  if (section) {
    section.classList.toggle('open');
    if (section.classList.contains('open')) {
      const ta = section.querySelector('.notes-textarea');
      if (ta) setTimeout(() => ta.focus(), 300);
    }
  }
}
window.toggleNotes = toggleNotes;

// ===== EXPORT / IMPORT =====
function initExportImport() {
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        progress: loadProgress(),
        notes: loadNotes()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ml-curriculum-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.progress) {
            saveProgress({ ...loadProgress(), ...data.progress });
          }
          if (data.notes) {
            const merged = { ...loadNotes() };
            for (const [key, val] of Object.entries(data.notes)) {
              if (!merged[key] || val.length > merged[key].length) {
                merged[key] = val;
              }
            }
            saveNotes(merged);
          }
          reloadUI();
          Sync.schedulePush();
          alert('Notes and progress imported successfully!');
        } catch {
          alert('Invalid file format.');
        }
        importFile.value = '';
      };
      reader.readAsText(file);
    });
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initCheckboxes();
  updateProgress();
  initNav();
  initMobileMenu();
  initReset();
  initKeyboard();
  initNotes();
  initExportImport();
  initSync();

  document.querySelectorAll('.collapsible').forEach(group => {
    const hasChecked = group.querySelector('.item-check:checked');
    if (hasChecked) group.classList.add('open');
  });
});
