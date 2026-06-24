/**
 * CodeForge AI — Content Script
 * --------------------------------
 * Runs in the ISOLATED world on matched pages.
 *
 * This script serves as a lightweight runtime confirmation observer.
 * Since the heavy lifting (editor detection & code insertion) happens
 * in the MAIN world via editorDetector.js, this script:
 *
 *  1. Confirms the content script has been injected successfully.
 *  2. Listens for optional runtime messages from the background for
 *     isolated-world tasks (e.g., DOM attribute reads, badge overlays).
 *  3. Provides a relay bridge if the background ever needs to
 *     coordinate with both worlds on the same page.
 */

(function () {
  'use strict';

  /* ── Injection confirmation ─────────────────────────── */
  console.log('[CodeForge AI] Content script loaded on:', window.location.href);

  /* ── Message listener (isolated world) ──────────────── */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    /* Health check from background or popup */
    if (message.action === 'CONTENT_PING') {
      sendResponse({
        status: 'alive',
        url: window.location.href,
        timestamp: Date.now(),
      });
      return false;
    }

    /* Read a DOM attribute value that might be needed before
       MAIN-world injection (edge case for some editors). */
    if (message.action === 'READ_DOM_ATTR') {
      try {
        const el = document.querySelector(message.selector);
        sendResponse({
          found: !!el,
          value: el ? el.getAttribute(message.attr) : null,
        });
      } catch (err) {
        sendResponse({ found: false, error: err.message });
      }
      return false;
    }

    /* Show a transient success / error toast overlay */
    if (message.action === 'SHOW_TOAST') {
      _showToast(message.text, message.type || 'success');
      sendResponse({ ok: true });
      return false;
    }
  });

  /* ── Toast overlay ──────────────────────────────────── */

  /**
   * Render a minimal floating notification on the host page.
   * Auto-dismisses after 3 seconds.
   *
   * @param {string} text
   * @param {'success'|'error'|'info'} type
   */
  function _showToast(text, type) {
    const TOAST_ID = '__codeforge-toast__';

    /* Remove existing toast if present */
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.textContent = text;

    const colors = {
      success: 'linear-gradient(135deg, #00c897, #00b4d8)',
      error: 'linear-gradient(135deg, #ff4e6a, #ff2d55)',
      info: 'linear-gradient(135deg, #5c7cfa, #845ef7)',
    };

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483647',
      padding: '12px 22px',
      borderRadius: '10px',
      background: colors[type] || colors.info,
      color: '#fff',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '0.3px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      opacity: '0',
      transform: 'translateY(12px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      pointerEvents: 'none',
    });

    document.body.appendChild(toast);

    /* Animate in */
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    /* Auto-dismiss */
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 350);
    }, 3000);
  }
})();
