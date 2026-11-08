/**
 * YouTube Donation Currency Converter - Popup Script
 * Handles settings UI, currency selection, preview, and broadcasting updates.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const YTCurrencyData = window.YTCurrencyData || {};
  const YTDonationParser = window.YTDonationParser || {};
  const { CURRENCY_LIST = [] } = YTCurrencyData;

  // DOM Elements
  const toggleEnabled = document.getElementById('toggle-enabled');
  const selectTargetCurrency = document.getElementById('select-target-currency');
  const selectDisplayFormat = document.getElementById('select-display-format');
  const selectDollarFallback = document.getElementById('select-dollar-fallback');
  const radioModeAll = document.querySelector('input[name="conversion-mode"][value="all"]');
  const radioModeWhitelist = document.querySelector('input[name="conversion-mode"][value="whitelist"]');
  const whitelistContainer = document.getElementById('whitelist-container');
  const whitelistSearch = document.getElementById('whitelist-search');
  const whitelistTags = document.getElementById('whitelist-tags');
  const previewText = document.getElementById('preview-text');
  const ratesStatusText = document.getElementById('rates-status-text');
  const btnRefreshRates = document.getElementById('btn-refresh-rates');

  let currentSettings = {
    enabled: true,
    targetCurrency: 'EUR',
    formatOption: 'original_append_symbol',
    fallbackDollar: 'USD',
    conversionMode: 'all',
    whitelist: ['ARS', 'BRL', 'TRY', 'MXN', 'JPY', 'INR', 'CLP', 'COP']
  };

  let exchangeRates = null;

  /**
   * Cross-browser storage helpers
   */
  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function storageSet(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  }

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, resolve);
    });
  }

  /**
   * Populates the target currency dropdown.
   */
  function populateTargetCurrencySelect() {
    selectTargetCurrency.innerHTML = '';

    const popularGroup = document.createElement('optgroup');
    popularGroup.label = 'Popular Currencies';

    const otherGroup = document.createElement('optgroup');
    otherGroup.label = 'All Currencies';

    CURRENCY_LIST.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} — ${c.name} (${c.symbol})`;

      if (c.popular) {
        popularGroup.appendChild(opt);
      } else {
        otherGroup.appendChild(opt);
      }
    });

    selectTargetCurrency.appendChild(popularGroup);
    selectTargetCurrency.appendChild(otherGroup);
  }

  /**
   * Renders the whitelist tags list.
   */
  function renderWhitelistTags(filterText = '') {
    whitelistTags.innerHTML = '';
    const filter = filterText.trim().toLowerCase();

    const allowed = new Set(currentSettings.whitelist || []);

    CURRENCY_LIST.forEach((c) => {
      if (filter) {
        const matchesCode = c.code.toLowerCase().includes(filter);
        const matchesName = c.name.toLowerCase().includes(filter);
        if (!matchesCode && !matchesName) return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-btn' + (allowed.has(c.code) ? ' active' : '');
      btn.textContent = `${c.code}`;
      btn.title = `${c.name} (${c.symbol})`;

      btn.addEventListener('click', async () => {
        if (allowed.has(c.code)) {
          allowed.delete(c.code);
        } else {
          allowed.add(c.code);
        }
        currentSettings.whitelist = Array.from(allowed);
        renderWhitelistTags(whitelistSearch.value);
        await saveSettings();
      });

      whitelistTags.appendChild(btn);
    });
  }

  /**
   * Updates live preview with sample donation (ARS 5,000.00).
   */
  function updatePreview() {
    if (!currentSettings.enabled) {
      previewText.textContent = 'Extension disabled';
      previewText.style.color = '#888';
      return;
    }

    previewText.style.color = '#2ba640';

    if (!exchangeRates) {
      previewText.textContent = 'ARS 5,000.00 (loading rates...)';
      return;
    }

    const sample = YTDonationParser.parseDonationText('ARS 5,000.00', currentSettings.fallbackDollar);
    if (!sample) {
      previewText.textContent = 'ARS 5,000.00';
      return;
    }

    const formatted = YTDonationParser.convertAndFormat(
      sample,
      exchangeRates,
      currentSettings.targetCurrency,
      currentSettings.formatOption
    );

    previewText.textContent = formatted || 'ARS 5,000.00';
  }

  /**
   * Saves settings to storage and broadcasts to tabs.
   */
  async function saveSettings() {
    await storageSet({ settings: currentSettings });
    updatePreview();
    sendMessage({ type: 'BROADCAST_SETTINGS' });
  }

  /**
   * Updates rates status label.
   */
  function updateRatesStatus(ratesData) {
    if (!ratesData || !ratesData.timestamp) {
      ratesStatusText.textContent = 'Rates: Not available';
      return;
    }

    const diffMinutes = Math.floor((Date.now() - ratesData.timestamp) / (60 * 1000));
    if (diffMinutes < 2) {
      ratesStatusText.textContent = 'Rates: Just updated';
    } else if (diffMinutes < 60) {
      ratesStatusText.textContent = `Rates: ${diffMinutes}m ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      ratesStatusText.textContent = `Rates: ${diffHours}h ago`;
    }
  }

  // --- Initialize UI from storage ---
  populateTargetCurrencySelect();

  const data = await storageGet(['settings', 'exchangeRates']);

  if (data.settings) {
    currentSettings = { ...currentSettings, ...data.settings };
  }

  if (data.exchangeRates && data.exchangeRates.rates) {
    exchangeRates = data.exchangeRates.rates;
    updateRatesStatus(data.exchangeRates);
  } else {
    // Request initial rates
    const fresh = await sendMessage({ type: 'GET_RATES' });
    if (fresh && fresh.rates) {
      exchangeRates = fresh.rates;
      updateRatesStatus(fresh);
    }
  }

  // Set form controls to match loaded settings
  toggleEnabled.checked = currentSettings.enabled !== false;
  selectTargetCurrency.value = currentSettings.targetCurrency || 'EUR';
  selectDisplayFormat.value = currentSettings.formatOption || 'original_append_symbol';
  selectDollarFallback.value = currentSettings.fallbackDollar || 'USD';

  if (currentSettings.conversionMode === 'whitelist') {
    radioModeWhitelist.checked = true;
    whitelistContainer.classList.remove('hidden');
  } else {
    radioModeAll.checked = true;
    whitelistContainer.classList.add('hidden');
  }

  renderWhitelistTags();
  updatePreview();

  // --- Event Listeners ---

  toggleEnabled.addEventListener('change', async () => {
    currentSettings.enabled = toggleEnabled.checked;
    await saveSettings();
  });

  selectTargetCurrency.addEventListener('change', async () => {
    currentSettings.targetCurrency = selectTargetCurrency.value;
    await saveSettings();
  });

  selectDisplayFormat.addEventListener('change', async () => {
    currentSettings.formatOption = selectDisplayFormat.value;
    await saveSettings();
  });

  selectDollarFallback.addEventListener('change', async () => {
    currentSettings.fallbackDollar = selectDollarFallback.value;
    await saveSettings();
  });

  radioModeAll.addEventListener('change', async () => {
    if (radioModeAll.checked) {
      currentSettings.conversionMode = 'all';
      whitelistContainer.classList.add('hidden');
      await saveSettings();
    }
  });

  radioModeWhitelist.addEventListener('change', async () => {
    if (radioModeWhitelist.checked) {
      currentSettings.conversionMode = 'whitelist';
      whitelistContainer.classList.remove('hidden');
      renderWhitelistTags(whitelistSearch.value);
      await saveSettings();
    }
  });

  whitelistSearch.addEventListener('input', () => {
    renderWhitelistTags(whitelistSearch.value);
  });

  btnRefreshRates.addEventListener('click', async () => {
    btnRefreshRates.disabled = true;
    btnRefreshRates.textContent = 'Updating...';

    const fresh = await sendMessage({ type: 'FORCE_REFRESH_RATES' });
    if (fresh && fresh.rates) {
      exchangeRates = fresh.rates;
      updateRatesStatus(fresh);
      updatePreview();
    }

    btnRefreshRates.disabled = false;
    btnRefreshRates.innerHTML = '<span class="btn-icon">🔄</span> Sync Rates';
  });
});

