/**
 * CodeForge AI — Editor Detector & Insertion Engine
 * ---------------------------------------------------
 * This script is injected into the MAIN world so it has direct
 * access to page-level JavaScript globals (window.monaco,
 * window.ace, CodeMirror instances, etc.).
 *
 * It exposes two functions on `window.__CODEFORGE__`:
 *   • detectEditorInstance()     → { type, instance }
 *   • performCodeInsertion(type, code, metadata) → boolean
 */

(function () {
  'use strict';

  /* Prevent double-injection */
  if (window.__CODEFORGE__) return;

  // ─── Detection helpers ──────────────────────────────────────

  /**
   * Try to locate a Monaco editor instance.
   * Monaco stores models globally; we grab the first active editor.
   */
  function _detectMonaco() {
    try {
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors && editors.length > 0) {
          return { type: 'monaco', instance: editors[0] };
        }
        /* Fallback: try getModels and create a dummy ref */
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          return { type: 'monaco-model', instance: models[0] };
        }
      }
    } catch (_) { /* silent */ }
    return null;
  }

  /**
   * Try to locate an Ace editor instance.
   * Ace typically attaches the editor object to the container DOM node.
   */
  function _detectAce() {
    try {
      if (window.ace) {
        /* ace.edit() without args may throw; look for env.editor */
        const aceContainers = document.querySelectorAll('.ace_editor');
        for (const el of aceContainers) {
          if (el.env && el.env.editor) {
            return { type: 'ace', instance: el.env.editor };
          }
        }
      }
    } catch (_) { /* silent */ }
    return null;
  }

  /**
   * Try to locate a CodeMirror 6 (CM6) editor view.
   * CM6 stores the view on the DOM node as `cmView.view`.
   */
  function _detectCodeMirror6() {
    try {
      const cmElements = document.querySelectorAll('.cm-editor');
      for (const el of cmElements) {
        if (el.cmView && el.cmView.view) {
          return { type: 'codemirror6', instance: el.cmView.view };
        }
      }
    } catch (_) { /* silent */ }
    return null;
  }

  /**
   * Try to locate a CodeMirror 5 (CM5) instance.
   * CM5 attaches `.CodeMirror` on the wrapping div.
   */
  function _detectCodeMirror5() {
    try {
      const cmElements = document.querySelectorAll('.CodeMirror');
      for (const el of cmElements) {
        if (el.CodeMirror) {
          return { type: 'codemirror5', instance: el.CodeMirror };
        }
      }
    } catch (_) { /* silent */ }
    return null;
  }

  /**
   * Fallback: find any visible textarea or contenteditable element
   * that looks like a code input area.
   */
  function _detectGenericTextarea() {
    try {
      /* Prefer textareas with code-related attributes */
      const candidates = document.querySelectorAll(
        'textarea[class*="code"], textarea[id*="code"], textarea[name*="code"], ' +
        'textarea[class*="editor"], textarea[id*="editor"], ' +
        'div[contenteditable="true"][class*="editor"], ' +
        'div[contenteditable="true"][role="textbox"]'
      );

      for (const el of candidates) {
        if (_isVisible(el)) {
          return { type: 'textarea', instance: el };
        }
      }

      /* Last resort: any visible textarea */
      const allTextareas = document.querySelectorAll('textarea');
      for (const el of allTextareas) {
        if (_isVisible(el)) {
          return { type: 'textarea', instance: el };
        }
      }

      /* Very last resort: any contenteditable */
      const editables = document.querySelectorAll('[contenteditable="true"]');
      for (const el of editables) {
        if (_isVisible(el)) {
          return { type: 'contenteditable', instance: el };
        }
      }
    } catch (_) { /* silent */ }
    return null;
  }

  function _isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
  }

  // ─── Main detection orchestrator ───────────────────────────

  function detectEditorInstance() {
    return (
      _detectMonaco()       ||
      _detectAce()          ||
      _detectCodeMirror6()  ||
      _detectCodeMirror5()  ||
      _detectGenericTextarea()  ||
      null
    );
  }

  // ─── Insertion engine ──────────────────────────────────────

  /**
   * Insert `code` into the detected editor.
   *
   * @param {string} type      — One of the type strings returned by detect.
   * @param {string} code      — The raw code string to insert.
   * @param {object} metadata  — Optional context (language, replaceAll flag, etc.).
   * @returns {boolean}        — true if insertion succeeded.
   */
  function performCodeInsertion(type, code, metadata = {}) {
    const replaceAll = metadata.replaceAll !== false; // default: replace

    try {
      switch (type) {
        // ── Monaco ──────────────────────────────
        case 'monaco': {
          const editor = metadata._instance || detectEditorInstance()?.instance;
          if (!editor) return false;
          const model = editor.getModel();
          if (!model) return false;
          const fullRange = model.getFullModelRange();
          if (replaceAll) {
            editor.executeEdits('codeforge', [{
              range: fullRange,
              text: code,
              forceMoveMarkers: true,
            }]);
          } else {
            const position = editor.getPosition();
            editor.executeEdits('codeforge', [{
              range: new window.monaco.Range(
                position.lineNumber, position.column,
                position.lineNumber, position.column
              ),
              text: code,
              forceMoveMarkers: true,
            }]);
          }
          return true;
        }

        case 'monaco-model': {
          const model = metadata._instance || detectEditorInstance()?.instance;
          if (!model) return false;
          model.setValue(code);
          return true;
        }

        // ── Ace ─────────────────────────────────
        case 'ace': {
          const editor = metadata._instance || detectEditorInstance()?.instance;
          if (!editor) return false;
          if (replaceAll) {
            editor.setValue(code, -1);
          } else {
            editor.insert(code);
          }
          return true;
        }

        // ── CodeMirror 6 ────────────────────────
        case 'codemirror6': {
          const view = metadata._instance || detectEditorInstance()?.instance;
          if (!view) return false;
          const transaction = view.state.update({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: code,
            },
          });
          view.dispatch(transaction);
          return true;
        }

        // ── CodeMirror 5 ────────────────────────
        case 'codemirror5': {
          const cm = metadata._instance || detectEditorInstance()?.instance;
          if (!cm) return false;
          if (replaceAll) {
            cm.setValue(code);
          } else {
            cm.replaceSelection(code);
          }
          return true;
        }

        // ── Textarea ────────────────────────────
        case 'textarea': {
          const el = metadata._instance || detectEditorInstance()?.instance;
          if (!el) return false;
          /* Trigger React / Vue controlled-input compatibility */
          const nativeInputValueSetter =
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeInputValueSetter.call(el, code);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // ── ContentEditable ─────────────────────
        case 'contenteditable': {
          const el = metadata._instance || detectEditorInstance()?.instance;
          if (!el) return false;
          el.innerText = code;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }

        default:
          console.warn('[CodeForge] Unknown editor type:', type);
          return false;
      }
    } catch (err) {
      console.error('[CodeForge] Insertion failed:', err);
      return false;
    }
  }

  // ─── Public API ────────────────────────────────────────────

  window.__CODEFORGE__ = Object.freeze({
    detectEditorInstance,
    performCodeInsertion,
  });

  console.log('[CodeForge AI] Editor detector loaded in MAIN world.');
})();
