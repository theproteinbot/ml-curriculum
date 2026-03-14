// ===== STATE =====
const STORAGE_KEY = 'ml-curriculum-progress';

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
    if (confirm('Reset all progress? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      document.querySelectorAll('.item-check').forEach(cb => cb.checked = false);
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initCheckboxes();
  updateProgress();
  initNav();
  initMobileMenu();
  initReset();
  initKeyboard();

  // Open collapsible sections that have checked items
  document.querySelectorAll('.collapsible').forEach(group => {
    const hasChecked = group.querySelector('.item-check:checked');
    if (hasChecked) group.classList.add('open');
  });
});
