/**
 * YouTube Donation Currency Converter - Background Service Worker
 * Fetches and caches daily exchange rates, provides them to content scripts and popup.
 */

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_SETTINGS = {
  enabled: true,
  targetCurrency: 'EUR',
  formatOption: 'original_append_symbol',
  fallbackDollar: 'USD',
  conversionMode: 'all',
  whitelist: []
};

/**
 * Cross-browser storage helper.
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

/**
 * Fetches fresh exchange rates from API.
 */
async function fetchExchangeRates() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (data && data.result === 'success' && data.rates) {
      const cacheData = {
        rates: data.rates,
        base: data.base_code || 'USD',
        timestamp: Date.now(),
        lastUpdatedUtc: data.time_last_update_utc || new Date().toUTCString()
      };
      await storageSet({ exchangeRates: cacheData });
      return cacheData;
    }
  } catch (err) {
    console.warn('[YT Donation Converter] Failed to fetch rates:', err);
  }
  return null;
}

/**
 * Gets cached rates or fetches if expired/missing.
 */
async function getOrUpdateRates(force = false) {
  const data = await storageGet(['exchangeRates']);
  const cached = data.exchangeRates;

  const isExpired = !cached || !cached.timestamp || Date.now() - cached.timestamp > CACHE_TTL_MS;

  if (force || isExpired) {
    const fresh = await fetchExchangeRates();
    if (fresh) return fresh;
  }

  return cached || null;
}

/**
 * Broadcasts updated settings and rates to all active YouTube tabs.
 */
async function broadcastToYouTubeTabs(payload) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {
        // Tab might not have content script active yet
      });
    }
  } catch (e) {
    // Ignore tab query errors
  }
}

// On Extension Installed or Updated
chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await storageGet(['settings']);
  if (!data.settings) {
    await storageSet({ settings: DEFAULT_SETTINGS });
  }

  // Pre-fetch rates
  await getOrUpdateRates();

  // Set up periodic alarm for daily rates update
  chrome.alarms.create('refresh_rates_daily', {
    periodInMinutes: 24 * 60
  });
});

// Periodic alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh_rates_daily') {
    await fetchExchangeRates();
  }
});

// Runtime message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'GET_RATES') {
    getOrUpdateRates(false).then((ratesData) => {
      sendResponse(ratesData);
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'FORCE_REFRESH_RATES') {
    fetchExchangeRates().then(async (freshRates) => {
      if (freshRates) {
        const data = await storageGet(['settings']);
        await broadcastToYouTubeTabs({
          type: 'SETTINGS_UPDATED',
          settings: data.settings || DEFAULT_SETTINGS,
          rates: freshRates.rates
        });
      }
      sendResponse(freshRates);
    });
    return true;
  }

  if (message.type === 'BROADCAST_SETTINGS') {
    storageGet(['settings', 'exchangeRates']).then((data) => {
      broadcastToYouTubeTabs({
        type: 'SETTINGS_UPDATED',
        settings: data.settings || DEFAULT_SETTINGS,
        rates: data.exchangeRates?.rates || null
      });
      sendResponse({ status: 'broadcasted' });
    });
    return true;
  }
});

