// ===== STATE =====
const STORAGE_KEY = 'ml-curriculum-progress';
const NOTES_KEY = 'ml-curriculum-notes';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== CHECKBOX PERSISTENCE =====
function initCheckboxes() {
  const progress = loadProgress();
  const checkboxes = document.querySelectorAll('.item-check');

  checkboxes.forEach(cb => {
    const item = cb.closest('[data-id]');
    if (!item) return;
    const id = item.dataset.id;

    // Restore state
    if (progress[id]) {
      cb.checked = true;
    }

    // Listen for changes
    cb.addEventListener('change', () => {
      const prog = loadProgress();
      if (cb.checked) {
        prog[id] = true;
      } else {
        delete prog[id];
      }
      saveProgress(prog);
      updateProgress();
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

  // Click handler
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      scrollToSection(target);
      closeMobileMenu();
    });
  });

  // Scroll spy
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

// Make scrollToSection global for onclick handlers
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
    }
  });
}

// ===== KEYBOARD SHORTCUTS =====
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Escape to close mobile menu
    if (e.key === 'Escape') {
      closeMobileMenu();
    }
  });
}

// ===== NOTES =====
function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY)) || {};
  } catch {
    return {};
  }
}

function saveNotes(data) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(data));
}

function initNotes() {
  const notes = loadNotes();
  const textareas = document.querySelectorAll('.notes-textarea');

  textareas.forEach(ta => {
    const key = ta.dataset.note;
    if (!key) return;

    // Restore saved content
    if (notes[key]) ta.value = notes[key];

    // Auto-open notes sections that have content
    if (notes[key] && ta.closest('.notes-section')) {
      ta.closest('.notes-section').classList.add('open');
    }

    // Debounced auto-save
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
        // Update meta text
        const meta = ta.parentElement.querySelector('.notes-meta');
        if (meta) {
          meta.textContent = 'Saved';
          setTimeout(() => { meta.textContent = 'Auto-saved locally'; }, 1500);
        }
      }, 500);
    });
  });
}

function toggleNotes(el) {
  const section = el.closest('.notes-section');
  if (section) {
    section.classList.toggle('open');
    // Focus textarea when opening
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
            // Merge progress (imported wins on conflict)
            const current = loadProgress();
            const merged = { ...current, ...data.progress };
            saveProgress(merged);
          }

          if (data.notes) {
            // Merge notes: keep longer version on conflict
            const current = loadNotes();
            const merged = { ...current };
            for (const [key, val] of Object.entries(data.notes)) {
              if (!merged[key] || val.length > merged[key].length) {
                merged[key] = val;
              }
            }
            saveNotes(merged);
          }

          // Reload UI
          document.querySelectorAll('.item-check').forEach(cb => {
            const item = cb.closest('[data-id]');
            if (!item) return;
            cb.checked = !!loadProgress()[item.dataset.id];
          });
          document.querySelectorAll('.notes-textarea').forEach(ta => {
            const key = ta.dataset.note;
            if (key) ta.value = loadNotes()[key] || '';
          });
          updateProgress();
          alert('Notes and progress imported successfully!');
        } catch (err) {
          alert('Invalid file format. Please use a JSON file exported from this app.');
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

  // Open collapsible sections that have checked items
  document.querySelectorAll('.collapsible').forEach(group => {
    const hasChecked = group.querySelector('.item-check:checked');
    if (hasChecked) group.classList.add('open');
  });
});
