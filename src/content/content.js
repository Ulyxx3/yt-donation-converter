/**
 * YouTube Donation Currency Converter - Content Script
 * Observes YouTube Live Chat DOM and injects converted currency amounts.
 */

(function () {
  'use strict';

  // Default settings
  let currentSettings = {
    enabled: true,
    targetCurrency: 'EUR',
    formatOption: 'original_append_symbol',
    fallbackDollar: 'USD',
    conversionMode: 'all', // 'all' or 'whitelist'
    whitelist: []
  };

  let exchangeRates = null;
  let observer = null;

  const SELECTORS = [
    'yt-live-chat-paid-message-renderer #purchase-amount',
    'yt-live-chat-paid-sticker-renderer #purchase-amount-chip',
    'yt-live-chat-paid-sticker-renderer #purchase-amount',
    'yt-live-chat-ticker-paid-message-item-renderer #text',
    'yt-live-chat-ticker-paid-sticker-item-renderer #price',
    'yt-live-chat-ticker-paid-sticker-item-renderer #text'
  ].join(', ');

  /**
   * Safe cross-browser storage getter.
   */
  function getStorage(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, resolve);
      } else if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        browser.storage.local.get(keys).then(resolve);
      } else {
        resolve({});
      }
    });
  }

  /**
   * Safe cross-browser message sender to background.
   */
  function sendMessage(msg) {
    return new Promise((resolve) => {
      try {
        const api = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : (typeof browser !== 'undefined' ? browser.runtime : null);
        if (api && api.sendMessage) {
          api.sendMessage(msg, (response) => {
            if (chrome.runtime.lastError) {
              // Benign error if background worker is spinning up
              resolve(null);
            } else {
              resolve(response);
            }
          });
        } else {
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Initializes settings and rates.
   */
  async function init() {
    const data = await getStorage(['settings', 'exchangeRates']);

    if (data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
    }

    if (data.exchangeRates && data.exchangeRates.rates) {
      exchangeRates = data.exchangeRates.rates;
    } else {
      // Request rates from background
      const res = await sendMessage({ type: 'GET_RATES' });
      if (res && res.rates) {
        exchangeRates = res.rates;
      }
    }

    // Process existing elements on page
    processAllElements();

    // Start observing DOM for newly added messages
    startObserver();

    // Listen for setting changes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
          if (changes.settings) {
            currentSettings = { ...currentSettings, ...changes.settings.newValue };
            processAllElements();
          }
          if (changes.exchangeRates) {
            exchangeRates = changes.exchangeRates.newValue?.rates || exchangeRates;
            processAllElements();
          }
        }
      });
    }

    // Listen for runtime messages (e.g. instant broadcast from popup)
    const runtime = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime : (typeof browser !== 'undefined' ? browser.runtime : null);
    if (runtime && runtime.onMessage) {
      runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.type === 'SETTINGS_UPDATED') {
          if (message.settings) currentSettings = { ...currentSettings, ...message.settings };
          if (message.rates) exchangeRates = message.rates;
          processAllElements();
          sendResponse({ status: 'ok' });
        }
      });
    }
  }

  /**
   * Processes a single donation DOM element.
   */
  function processElement(element) {
    if (!element) return;

    // Retrieve or store original text
    let originalText = element.dataset.ytOriginalAmount;
    if (!originalText) {
      originalText = element.textContent.trim();
      if (!originalText) return;
      element.dataset.ytOriginalAmount = originalText;
    }

    // If extension disabled or rates not ready, restore original text
    if (!currentSettings.enabled || !exchangeRates) {
      if (element.textContent !== originalText) {
        element.textContent = originalText;
      }
      return;
    }

    const parser = window.YTDonationParser;
    if (!parser) return;

    const parsed = parser.parseDonationText(originalText, currentSettings.fallbackDollar);
    if (!parsed) {
      // Not a recognized donation format, keep original
      return;
    }

    const srcCurrency = parsed.detectedCurrency.toUpperCase();
    const targetCurrency = currentSettings.targetCurrency.toUpperCase();

    // Rule: If already in target currency, do not translate!
    if (srcCurrency === targetCurrency) {
      if (element.textContent !== originalText) {
        element.textContent = originalText;
      }
      return;
    }

    // Whitelist filter rule
    if (currentSettings.conversionMode === 'whitelist') {
      const allowed = Array.isArray(currentSettings.whitelist) ? currentSettings.whitelist : [];
      if (!allowed.includes(srcCurrency)) {
        if (element.textContent !== originalText) {
          element.textContent = originalText;
        }
        return;
      }
    }

    const srcRate = exchangeRates[srcCurrency];
    const dstRate = exchangeRates[targetCurrency];
    if (!srcRate || !dstRate) {
      return;
    }

    const convertedAmount = (parsed.amount / srcRate) * dstRate;
    const isZeroDecimal = window.YTCurrencyData?.ZERO_DECIMAL_CURRENCIES?.has(targetCurrency);
    const fractionDigits = isZeroDecimal ? 0 : 2;

    const formattedTarget = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(convertedAmount);

    const formattedTargetCode = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(convertedAmount) + ' ' + targetCurrency;

    // Render safely using DOM nodes to prevent XSS
    renderConvertedAmount(element, parsed.originalText, formattedTarget, formattedTargetCode, srcCurrency, targetCurrency);
  }

  /**
   * Safely renders the converted value into the DOM element according to chosen format.
   */
  function renderConvertedAmount(element, originalText, formattedTarget, formattedTargetCode, srcCurrency, targetCurrency) {
    element.textContent = ''; // clear

    const format = currentSettings.formatOption || 'original_append_symbol';

    if (format === 'target_only') {
      const span = document.createElement('span');
      span.className = 'yt-donation-converted-only';
      span.textContent = `~${formattedTarget}`;
      span.title = `Original: ${originalText} (1 ${srcCurrency} ≈ ${(exchangeRates[targetCurrency] / exchangeRates[srcCurrency]).toFixed(4)} ${targetCurrency})`;
      element.appendChild(span);
      return;
    }

    if (format === 'target_first_symbol') {
      const targetSpan = document.createElement('span');
      targetSpan.className = 'yt-donation-converted';
      targetSpan.textContent = `~${formattedTarget}`;
      targetSpan.title = `Converted from ${originalText}`;

      const origSpan = document.createElement('span');
      origSpan.className = 'yt-donation-original';
      origSpan.textContent = ` (${originalText})`;

      element.appendChild(targetSpan);
      element.appendChild(origSpan);
      return;
    }

    // Default & Code formats (Append after original)
    const origSpan = document.createElement('span');
    origSpan.className = 'yt-donation-original';
    origSpan.textContent = originalText;

    const convSpan = document.createElement('span');
    convSpan.className = 'yt-donation-converted';
    convSpan.title = `Original: ${originalText} | 1 ${srcCurrency} ≈ ${(exchangeRates[targetCurrency] / exchangeRates[srcCurrency]).toFixed(4)} ${targetCurrency}`;

    if (format === 'original_append_code') {
      convSpan.textContent = ` (≈ ${formattedTargetCode})`;
    } else {
      // original_append_symbol (default)
      convSpan.textContent = ` (~${formattedTarget})`;
    }

    element.appendChild(origSpan);
    element.appendChild(convSpan);
  }

  /**
   * Queries and processes all donation elements currently in the DOM.
   */
  function processAllElements() {
    const elements = document.querySelectorAll(SELECTORS);
    elements.forEach(processElement);
  }

  /**
   * Observes live chat container for newly added messages.
   */
  function startObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      let needsScan = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if node itself matches or contains matching elements
              if (node.matches && node.matches(SELECTORS)) {
                processElement(node);
              } else if (node.querySelectorAll) {
                const targets = node.querySelectorAll(SELECTORS);
                if (targets.length > 0) {
                  targets.forEach(processElement);
                } else if (node.id === 'chat' || node.tagName.toLowerCase().includes('yt-live-chat')) {
                  needsScan = true;
                }
              }
            }
          }
        }
      }

      if (needsScan) {
        processAllElements();
      }
    });

    // Observe document body or root
    const targetNode = document.body || document.documentElement;
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

