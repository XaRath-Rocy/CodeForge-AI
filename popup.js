/**
 * CodeForge AI — Popup Controller  (v3 — Forge Lumina Final)
 * ─────────────────────────────────────────────────────────────
 * New in v3:
 *  · Custom select display sync (model dot + label update)
 *  · Info sheet open / close for About + Credits
 *  · Backdrop click closes sheet
 *  · Pulse ring injected on forge button
 */

(function () {
  'use strict';

  /* ── DOM refs ──────────────────────────────────────────── */
  const modelSelect    = document.getElementById('model-select');
  const languageSelect = document.getElementById('language-select');
  const instructionsEl = document.getElementById('instructions');
  const charCounter    = document.getElementById('char-counter');
  const forgeBtn       = document.getElementById('btn');
  const statusInner    = document.getElementById('status-bar-inner');
  const forgeProgress  = document.getElementById('forge-progress');
  const connectionDot  = document.getElementById('connection-dot');

  /* Custom select display elements */
  const modelDot       = document.getElementById('model-dot');
  const modelValue     = document.getElementById('model-value');
  const languageValue  = document.getElementById('language-value');

  /* Info sheet */
  const infoSheet      = document.getElementById('info-sheet');
  const infoBackdrop   = document.getElementById('info-backdrop');
  const infoSheetTitle = document.getElementById('info-sheet-title');
  const infoCloseBtn   = document.getElementById('info-sheet-close');
  const contentAbout   = document.getElementById('content-about');
  const contentCredits = document.getElementById('content-credits');
  const btnAbout       = document.getElementById('btn-about');
  const btnCredits     = document.getElementById('btn-credits');

  const MAX_CHARS  = 2000;
  const NEAR_LIMIT = 1600;

  /* Model color map for the dot indicator */
  const MODEL_COLORS = {
    'llama-3.3-70b-instruct':     'llama-3.3-70b-instruct',
    'llama-3.1-70b-instruct':     'llama-3.1-70b-instruct',
    'llama-3.1-8b-instruct':      'llama-3.1-8b-instruct',
    'llama-3.2-3b-instruct':      'llama-3.2-3b-instruct',
    'llama-3.2-1b-instruct':      'llama-3.2-1b-instruct',
    'phi-4-mini-instruct':        'phi-4-mini-instruct',
    'gemma-2-2b-it':              'gemma-2-2b-it',
    'mixtral-8x7b-instruct-v0.1': 'mixtral-8x7b-instruct-v0.1',
  };

  /* ─────────────────────────────────────────────────────────
     DROPDOWN POPULATION + CUSTOM DISPLAY SYNC
  ────────────────────────────────────────────────────────── */
  function populateSelect(selectEl, items) {
    const frag = document.createDocumentFragment();
    items.forEach(({ id, label }) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      frag.appendChild(opt);
    });
    selectEl.appendChild(frag);
  }

  populateSelect(modelSelect, CONFIG.MODELS);
  populateSelect(languageSelect, CONFIG.LANGUAGES);

  /* Sync display after population */
  syncModelDisplay();
  syncLanguageDisplay();

  /* Live sync on change */
  modelSelect.addEventListener('change', syncModelDisplay);
  languageSelect.addEventListener('change', syncLanguageDisplay);

  /* ── Custom select dropdown integration ────────────────── */
  let activeDropdownPanel = null;
  let activeDropdownTrigger = null;

  function closeDropdown() {
    if (activeDropdownPanel) {
      activeDropdownPanel.classList.remove('open');
      const panelToRemove = activeDropdownPanel;
      setTimeout(() => panelToRemove.remove(), 200);
      activeDropdownPanel = null;
    }
    if (activeDropdownTrigger) {
      activeDropdownTrigger.setAttribute('aria-expanded', 'false');
      activeDropdownTrigger = null;
    }
  }

  function setupCustomDropdown(triggerId, selectId, items, hasSearch = false) {
    const triggerEl = document.getElementById(triggerId);
    const selectEl = document.getElementById(selectId);
    if (!triggerEl || !selectEl) return;

    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();

      const isOpen = triggerEl.getAttribute('aria-expanded') === 'true';
      closeDropdown();

      if (isOpen) return;

      triggerEl.setAttribute('aria-expanded', 'true');

      const panel = document.createElement('div');
      panel.className = 'csel-dropdown-panel open';

      // Position the panel
      const rect = triggerEl.getBoundingClientRect();
      panel.style.top = `${rect.bottom + 4}px`;
      panel.style.left = `${rect.left}px`;
      panel.style.width = `${rect.width}px`;

      const optionsList = document.createElement('div');
      optionsList.className = 'csel-options-list';

      if (hasSearch) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'csel-search-container';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'csel-search-input';
        searchInput.placeholder = selectId.includes('model') ? 'Search model...' : 'Search language...';
        searchInput.autocomplete = 'off';

        searchInput.addEventListener('click', (se) => se.stopPropagation());

        searchContainer.appendChild(searchInput);
        panel.appendChild(searchContainer);

        searchInput.addEventListener('input', (se) => {
          const query = se.target.value.toLowerCase().trim();
          const options = optionsList.querySelectorAll('.csel-option');
          let visibleCount = 0;

          options.forEach((opt) => {
            const labelText = opt.querySelector('.csel-option-label').textContent.toLowerCase();
            const descText = opt.querySelector('.csel-option-desc')?.textContent.toLowerCase() || '';
            if (labelText.includes(query) || descText.includes(query)) {
              opt.style.display = 'flex';
              visibleCount++;
            } else {
              opt.style.display = 'none';
            }
          });

          let noResultsEl = optionsList.querySelector('.csel-no-results');
          if (visibleCount === 0) {
            if (!noResultsEl) {
              noResultsEl = document.createElement('div');
              noResultsEl.className = 'csel-no-results';
              noResultsEl.textContent = 'No matching options';
              optionsList.appendChild(noResultsEl);
            }
          } else {
            if (noResultsEl) {
              noResultsEl.remove();
            }
          }
        });

        // Focus after panel is in the document
        setTimeout(() => searchInput.focus(), 50);
      }

      items.forEach((item) => {
        const opt = document.createElement('div');
        opt.className = 'csel-option';
        if (selectEl.value === item.id) {
          opt.classList.add('csel-selected');
        }

        const body = document.createElement('div');
        body.className = 'csel-option-body';

        const label = document.createElement('span');
        label.className = 'csel-option-label';
        label.textContent = item.label;
        body.appendChild(label);

        if (item.desc) {
          const desc = document.createElement('span');
          desc.className = 'csel-option-desc';
          desc.textContent = item.desc;
          body.appendChild(desc);
        }

        opt.appendChild(body);

        // Checkmark SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'csel-option-check');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '3');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        svg.appendChild(polyline);
        opt.appendChild(svg);

        opt.addEventListener('click', (optEvent) => {
          optEvent.stopPropagation();
          selectEl.value = item.id;
          selectEl.dispatchEvent(new Event('change'));
          closeDropdown();
        });

        optionsList.appendChild(opt);
      });

      panel.appendChild(optionsList);

      document.body.appendChild(panel);
      activeDropdownPanel = panel;
      activeDropdownTrigger = triggerEl;
    });
  }

  // Handle clicking outside to close
  document.addEventListener('click', (e) => {
    if (activeDropdownPanel && !activeDropdownPanel.contains(e.target) && e.target !== activeDropdownTrigger) {
      closeDropdown();
    }
  });

  // Close dropdown on window resize or scroll
  window.addEventListener('resize', closeDropdown);
  window.addEventListener('scroll', closeDropdown);

  // Setup the dropdowns
  setupCustomDropdown('model-trigger', 'model-select', CONFIG.MODELS);
  setupCustomDropdown('language-trigger', 'language-select', CONFIG.LANGUAGES, true);

  function syncModelDisplay() {
    const selected = modelSelect.options[modelSelect.selectedIndex];
    if (!selected) return;
    modelValue.textContent = selected.textContent;
    const modelId = MODEL_COLORS[selected.value] || null;
    if (modelId) {
      modelDot.setAttribute('data-model', modelId);
    } else {
      modelDot.removeAttribute('data-model');
    }
  }

  function syncLanguageDisplay() {
    const selected = languageSelect.options[languageSelect.selectedIndex];
    if (selected) languageValue.textContent = selected.textContent;
  }

  /* ─────────────────────────────────────────────────────────
     CHARACTER COUNTER
  ────────────────────────────────────────────────────────── */
  function updateCharCounter() {
    const len = instructionsEl.value.length;
    charCounter.textContent = `${len} / ${MAX_CHARS}`;
    charCounter.classList.toggle('near-limit', len >= NEAR_LIMIT && len < MAX_CHARS);
    charCounter.classList.toggle('at-limit',   len >= MAX_CHARS);
  }
  instructionsEl.addEventListener('input', updateCharCounter);

  /* ─────────────────────────────────────────────────────────
     CHIP QUICK-PROMPTS
  ────────────────────────────────────────────────────────── */
  document.querySelectorAll('.chip[data-prompt]').forEach((chip) => {
    chip.addEventListener('click', () => {
      instructionsEl.value = chip.getAttribute('data-prompt');
      updateCharCounter();
      instructionsEl.focus();

      chip.classList.add('chip--active');
      chip.style.animation = 'chipPulse 0.4s ease';
      setTimeout(() => {
        chip.classList.remove('chip--active');
        chip.style.animation = '';
      }, 450);
    });
  });

  /* ─────────────────────────────────────────────────────────
     INFO SHEET — open / close
  ────────────────────────────────────────────────────────── */
  let currentSheet = null; /* 'about' | 'credits' */

  function openSheet(type) {
    currentSheet = type;

    /* Set title & show correct content pane */
    if (type === 'about') {
      infoSheetTitle.textContent = 'About CodeForge AI';
      contentAbout.style.display   = 'flex';
      contentCredits.style.display = 'none';
    } else {
      infoSheetTitle.textContent = 'Credits';
      contentAbout.style.display   = 'none';
      contentCredits.style.display = 'flex';
    }

    infoSheet.classList.add('open');
    infoSheet.setAttribute('aria-hidden', 'false');
    infoBackdrop.classList.add('active');
    infoCloseBtn.focus();
  }

  function closeSheet() {
    currentSheet = null;
    infoSheet.classList.remove('open');
    infoSheet.setAttribute('aria-hidden', 'true');
    infoBackdrop.classList.remove('active');
  }

  btnAbout.addEventListener('click',   () => openSheet('about'));
  btnCredits.addEventListener('click', () => openSheet('credits'));
  infoCloseBtn.addEventListener('click', closeSheet);
  infoBackdrop.addEventListener('click', closeSheet);

  /* Close on Escape */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (currentSheet) closeSheet();
      closeDropdown();
    }
  });

  /* ─────────────────────────────────────────────────────────
     STATUS BAR
  ────────────────────────────────────────────────────────── */
  function setStatus(text, type) {
    statusInner.className = 'status-bar-inner';
    if (type) statusInner.classList.add(type);

    if (type === 'working') {
      statusInner.innerHTML =
        _esc(text) +
        `<span class="status-dots" aria-hidden="true">
           <span></span><span></span><span></span>
         </span>`;
    } else {
      statusInner.textContent = text;
    }
    _fadeIn(statusInner);
  }

  function clearStatus() {
    statusInner.className = 'status-bar-inner';
    statusInner.textContent = '';
  }

  function _fadeIn(el) {
    el.style.opacity = '0'; el.style.transform = 'translateY(5px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      el.style.opacity    = '1'; el.style.transform = 'translateY(0)';
    });
  }

  function _esc(str) {
    const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  }

  /* ─────────────────────────────────────────────────────────
     CONNECTION DOT
  ────────────────────────────────────────────────────────── */
  function setDotState(state) {
    connectionDot.classList.remove('error', 'offline');
    if (state === 'error')   connectionDot.classList.add('error');
    if (state === 'offline') connectionDot.classList.add('offline');
  }

  /* ─────────────────────────────────────────────────────────
     BUTTON STATE
  ────────────────────────────────────────────────────────── */
  function setLoading(on) {
    if (forgeBtn) forgeBtn.disabled = on;
    const iconSlot = forgeBtn ? forgeBtn.querySelector('.forge-btn-icon') : null;
    const textSlot = forgeBtn ? forgeBtn.querySelector('.forge-btn-text') : null;

    if (on) {
      if (iconSlot) iconSlot.innerHTML = '<div class="spinner"></div>';
      if (textSlot) textSlot.textContent = 'Forging…';
      if (forgeProgress) forgeProgress.classList.add('active');
    } else {
      if (iconSlot) {
        iconSlot.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
          </svg>`;
      }
      if (textSlot) textSlot.textContent = 'Forge System Code';
      if (forgeProgress) forgeProgress.classList.remove('active');
    }
  }

  /* Inject the idle pulse ring inside button */
  const pulseRing = document.createElement('span');
  pulseRing.className = 'pulse-ring';
  pulseRing.setAttribute('aria-hidden', 'true');
  if (forgeBtn) forgeBtn.appendChild(pulseRing);

  /* ─────────────────────────────────────────────────────────
     VALIDATION SHAKE
  ────────────────────────────────────────────────────────── */
  function shakeElement(el) {
    el.style.animation = 'none'; void el.offsetWidth;
    el.style.animation = 'shake 0.45s ease';
    setTimeout(() => { el.style.animation = ''; }, 500);
  }

  /* ─────────────────────────────────────────────────────────
     SUCCESS FLASH
  ────────────────────────────────────────────────────────── */
  function flashSuccess() {
    const panel = document.getElementById('panel');
    const flash = document.createElement('div');
    Object.assign(flash.style, {
      position: 'absolute', inset: '0', zIndex: '100', pointerEvents: 'none',
      borderRadius: 'inherit',
      background: 'radial-gradient(ellipse at 50% 80%, rgba(20,209,255,0.09) 0%, transparent 65%)',
      opacity: '1', transition: 'opacity 0.9s ease',
    });
    panel.appendChild(flash);
    requestAnimationFrame(() => { setTimeout(() => { flash.style.opacity = '0'; }, 80); });
    setTimeout(() => flash.remove(), 1050);
  }

  /* ─────────────────────────────────────────────────────────
     FORGE BUTTON — click handler
  ────────────────────────────────────────────────────────── */
  forgeBtn.addEventListener('click', async () => {
    const instructions = instructionsEl.value.trim();
    if (!instructions) {
      setStatus('⚠ Please enter generation instructions.', 'error');
      instructionsEl.focus();
      shakeElement(document.querySelector('.glass-card'));
      return;
    }

    const model    = modelSelect.value;
    const language = languageSelect.value;

    setLoading(true);
    setStatus('Connecting to server', 'working');
    setDotState('ok');

    let pageUrl = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      pageUrl = tab?.url ?? '';
    } catch (_) { /* non-critical */ }

    chrome.runtime.sendMessage(
      { action: 'FORGE_CODE', payload: { model, language, instructions, pageUrl } },
      (response) => {
        setLoading(false);

        if (chrome.runtime.lastError) {
          setStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
          setDotState('error'); return;
        }
        if (!response) {
          setStatus('No response from background worker.', 'error');
          setDotState('offline'); return;
        }
        if (!response.success) {
          setStatus(response.error || 'Generation failed.', 'error');
          setDotState('error'); return;
        }

        setDotState('ok');
        if (response.inserted) {
          setStatus('✓ Code generated & inserted into editor', 'success');
          flashSuccess();
        } else {
          setStatus('✓ Code ready — no editor found on page', 'success');
          console.info('[CodeForge AI] Generated code:\n', response.code);
        }
      }
    );
  });

  /* ─────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────── */
  updateCharCounter();
  clearStatus();

  // Perform initial health check to backend
  setDotState('offline'); // start as offline/checking
  chrome.runtime.sendMessage({ action: 'CHECK_BACKEND' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      setDotState('offline');
      setStatus('⚠ Server offline. Please run the backend server.', 'error');
    } else {
      setDotState('ok');
      clearStatus();
    }
  });

})();
