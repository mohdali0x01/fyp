/* ─── htmx-helpers.js ───────────────────────────────────────────────────────
   Small vanilla JS utilities for the AidLedger HTMX frontend.
   No frameworks. No build step. Just works.
─────────────────────────────────────────────────────────────────────────── */

// ── Toast System ──────────────────────────────────────────────────────────────
const Toast = (() => {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function show(message, type = 'info', duration = 4000) {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success'
      ? '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : type === 'error'
      ? '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = icon + '<span>' + message + '</span>';
    c.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return { show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error'), info: (m) => show(m, 'info') };
})();


// ── Password visibility toggle ────────────────────────────────────────────────
function togglePassword(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input || !btn) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  // swap icon using Tailwind's hidden class
  const eyeOpen  = btn.querySelector('.eye-open');
  const eyeClose = btn.querySelector('.eye-close');
  if (eyeOpen)  eyeOpen.classList.toggle('hidden', isHidden);
  if (eyeClose) eyeClose.classList.toggle('hidden', !isHidden);
}


// ── Sidebar toggle (Mobile & Desktop) ─────────────────────────────────────────
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  const m = document.querySelector('.main-content');
  if (!s) return;

  const isMobile = window.innerWidth < 1024;

  if (isMobile) {
    const open = s.classList.contains('translate-x-0');
    s.classList.toggle('translate-x-0', !open);
    s.classList.toggle('-translate-x-full', open);
    if (o) o.classList.toggle('hidden', open);
  } else {
    // Desktop: collapse width
    const collapsed = s.classList.toggle('collapsed');
    if (m) m.classList.toggle('expanded', collapsed);
  }
}


// ── Copy to clipboard ─────────────────────────────────────────────────────────
function copyToClipboard(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    Toast.success('Copied to clipboard!');
    const btn = document.getElementById(btnId);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    }
  }).catch(() => Toast.error('Failed to copy'));
}


// ── HTMX event handlers ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Auto-dismiss flash messages
  document.querySelectorAll('.flash-auto-dismiss').forEach(el => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s ease';
      setTimeout(() => el.remove(), 500);
    }, 5000);
  });

  // Active sidebar link highlighting
  const current = window.location.pathname;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Exact match is always active
    let isActive = (current === href);
    
    // For nested paths (e.g. /admin/registrations/123 should highlight /admin/registrations)
    // but /dashboard/status should NOT highlight /dashboard
    if (!isActive && href !== '/' && href !== '/dashboard' && href !== '/admin' && href !== '/sbp' && href !== '/bank' && href !== '/audit' && href !== '/vendor') {
      if (current.startsWith(href + '/')) {
        isActive = true;
      }
    }
    
    if (isActive) {
      link.classList.add('active');
    }
  });
});

// HTMX: show toast on success response with HX-Toast header
document.addEventListener('htmx:afterRequest', (evt) => {
  const headers = evt.detail.xhr.getAllResponseHeaders();
  const toastType    = evt.detail.xhr.getResponseHeader('HX-Toast-Type') || 'info';
  const toastMessage = evt.detail.xhr.getResponseHeader('HX-Toast');
  if (toastMessage) {
    Toast.show(toastMessage, toastType);
  }
});

// HTMX: show loading spinner on btn during request
document.addEventListener('htmx:beforeRequest', (evt) => {
  const trigger = evt.detail.elt;
  if (trigger.tagName === 'FORM') {
    const btn = trigger.querySelector('[type="submit"]');
    if (btn) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing...';
      btn.disabled = true;
    }
  }
});

document.addEventListener('htmx:afterRequest', (evt) => {
  const trigger = evt.detail.elt;
  if (trigger.tagName === 'FORM') {
    const btn = trigger.querySelector('[type="submit"]');
    if (btn && btn.dataset.originalText) {
      btn.innerHTML  = btn.dataset.originalText;
      btn.disabled   = false;
    }
  }
});

// HTMX: clear form errors on new input
document.addEventListener('htmx:beforeRequest', (evt) => {
  const form = evt.detail.elt.closest('form') || evt.detail.elt;
  if (form) {
    const errorDiv = form.querySelector('#form-error');
    if (errorDiv) errorDiv.innerHTML = '';
  }
});

// HTMX: allow swapping on non-200 responses (4xx codes)
document.addEventListener('htmx:beforeSwap', (evt) => {
  if (evt.detail.xhr.status === 401 || evt.detail.xhr.status === 422 || evt.detail.xhr.status === 409 || evt.detail.xhr.status === 400 || evt.detail.xhr.status === 503) {
    evt.detail.shouldSwap = true;
    evt.detail.isError = false; // prevents htmx:error logging for these handled cases
  }
});
