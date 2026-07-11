/**
 * CodeForge AI — Service Worker (Background Script)
 * ----------------------------------------------------
 * Secure middleware between the popup UI and the remote server.
 *
 * Responsibilities:
 *  1. Receive generation payloads from popup.js via chrome.runtime messages.
 *  2. Forward them to the centralized backend (no local API keys).
 *  3. Inject editorDetector.js into the MAIN world, then execute
 *     code insertion via a follow-up MAIN-world script.
 *  4. Enforce runtime locking to prevent duplicate rapid-fire requests.
 */

/* ── Import shared config ────────────────────────────── */
importScripts('config.js');

/* ── Runtime lock ────────────────────────────────────── */
let isGenerating = false;

/* ── Message router ──────────────────────────────────── */
chrome.runtime.onMessage.addListener((request, message, sender, sendResponse) => {
  if (request.action === 'FORGE_CODE') {

    // Asynchronous flow handle karne ke liye return true mandatory hai
    handleForgeRequest(request)
      .then((res) => {
        // Safe send: Check karein ki channel open hai ya nahi
        try { sendResponse({ success: true, data: res }); } catch (e) { }
      })
      .catch((err) => {
        try { sendResponse({ success: false, error: err.message }); } catch (e) { }
      });

    return true; // Channel open rakhta hai
  }
  if (message.action === 'FORGE_CODE') {
    handleForgeRequest(message.payload, sendResponse);
    return true; // keep the message channel open for async response
  }

  if (message.action === 'CHECK_BACKEND') {
    checkBackendStatus().then(sendResponse);
    return true; // async
  }

  if (message.action === 'PING') {
    sendResponse({ status: 'ok' });
    return false;
  }
});

async function checkBackendStatus() {
  try {
    const healthUrl = CONFIG.SERVER_API_URL.replace(/\/v1\/forge$/, '/health');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    return { success: response.ok };
  } catch (err) {
    console.warn('[CodeForge BG] Backend health check failed:', err.message);
    return { success: false };
  }
}

/* ── Core handler ────────────────────────────────────── */
async function handleForgeRequest(payload, sendResponse) {
  /* ── 1. Acquire lock ─────────────────────────────── */
  if (isGenerating) {
    sendResponse({
      success: false,
      error: 'A generation request is already in progress. Please wait.',
    });
    return;
  }

  isGenerating = true;

  try {
    /* ── 2. Fetch from server ────────────────────────── */
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    const response = await fetch(CONFIG.SERVER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: payload.model,
        language: payload.language,
        instructions: payload.instructions,
        url: payload.pageUrl || '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server responded with ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (!data || typeof data.code !== 'string' || data.code.trim().length === 0) {
      throw new Error('Server returned an empty or malformed code payload.');
    }

    /* ── 3. Inject code into the active tab ──────────── */
    const insertionResult = await injectAndInsertCode(data.code, payload.language);

    sendResponse({
      success: insertionResult,
      code: data.code,
      inserted: insertionResult,
    });

  } catch (err) {
    console.error('[CodeForge BG] Forge error:', err);
    sendResponse({
      success: false,
      error: err.message || 'An unexpected error occurred.',
    });

  } finally {
    isGenerating = false;
  }
}

/* ── MAIN-world injection pipeline ───────────────────── */

/**
 * 1. Inject `editorDetector.js` into the MAIN world (idempotent).
 * 2. Run a follow-up MAIN-world script that calls the detection +
 *    insertion helpers exposed on `window.__CODEFORGE__`.
 *
 * @param {string} code     — The generated code string.
 * @param {string} language — Target language id (informational).
 * @returns {Promise<boolean>} — Whether insertion succeeded.
 */
async function injectAndInsertCode(code, language) {
  try {
    /* Resolve the active tab */
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      console.warn('[CodeForge BG] No active tab found.');
      return false;
    }

    /* Step 1 — Inject editorDetector.js in MAIN world */
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['utils/editorDetector.js'],
      world: 'MAIN',
    });

    /* Step 2 — Execute insertion via MAIN world function call */
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: _mainWorldInsert,
      args: [code, language],
    });

    /* The function returns a boolean from the MAIN world */
    if (results && results[0] && results[0].result === true) {
      return true;
    }

    return false;

  } catch (err) {
    console.error('[CodeForge BG] Injection error:', err);
    return false;
  }
}

/**
 * This function is serialised and executed inside the MAIN world.
 * It has access to `window.__CODEFORGE__` which was loaded in the
 * previous injection step.
 *
 * @param {string} code
 * @param {string} language
 * @returns {boolean}
 */
function _mainWorldInsert(code, language) {
  try {
    if (!window.__CODEFORGE__) {
      console.error('[CodeForge] Editor detector not loaded.');
      return false;
    }

    const detected = window.__CODEFORGE__.detectEditorInstance();
    if (!detected) {
      console.warn('[CodeForge] No supported editor detected on this page.');
      return false;
    }

    return window.__CODEFORGE__.performCodeInsertion(
      detected.type,
      code,
      { _instance: detected.instance, language, replaceAll: true }
    );

  } catch (err) {
    console.error('[CodeForge] MAIN world insertion error:', err);
    return false;
  }
}
