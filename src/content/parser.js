/**
 * YouTube Donation Currency Converter
 * Parser for YouTube live chat donation text.
 */

(function (root) {
  'use strict';

  const YTCurrencyData = root.YTCurrencyData || {};
  const { PREFIX_PATTERNS = [], SYMBOL_PATTERNS = [], ZERO_DECIMAL_CURRENCIES = new Set() } = YTCurrencyData;

  /**
   * Normalizes Unicode spaces and non-standard characters.
   */
  function normalizeString(str) {
    if (!str) return '';
    return str
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
      .trim();
  }

  /**
   * Robust number parser supporting both dot-decimal and comma-decimal formats,
   * thousands separators, and zero-decimal currencies.
   */
  function parseAmount(numStr, currencyCode) {
    let s = numStr.trim();
    if (!s) return null;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    const hasSpace = /\s/.test(s);
    const hasApos = s.includes("'");

    let clean = s;

    // Both comma and dot present: determine which is decimal by last position
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastDot > lastComma) {
        // e.g. 5,000.00
        clean = s.replace(/,/g, '').replace(/\s/g, '');
      } else {
        // e.g. 5.000,00
        clean = s.replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
      }
    } else if (hasApos && (hasDot || hasComma)) {
      // Swiss style 5'000.00
      clean = s.replace(/'/g, '').replace(/\s/g, '').replace(',', '.');
    } else if (hasSpace && (hasComma || hasDot)) {
      // 5 000,00 or 5 000.00
      const sep = hasComma ? ',' : '.';
      const parts = s.split(sep);
      clean = parts[0].replace(/\s/g, '') + '.' + parts[1];
    } else if (hasComma) {
      // Only comma: check if it represents decimal (1 or 2 digits after comma)
      if (/,\d{1,2}$/.test(s)) {
        clean = s.replace(',', '.');
      } else {
        // 3 digits after comma, e.g. 5,000
        clean = s.replace(/,/g, '');
      }
    } else if (hasDot) {
      // Only dot: check if it represents decimal
      if (/\.\d{1,2}$/.test(s)) {
        clean = s;
      } else {
        // e.g. 5.000 in Spanish/German or zero-decimal currency
        clean = s.replace(/\./g, '');
      }
    } else {
      clean = s.replace(/\s/g, '');
    }

    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }

  /**
   * Parses raw YouTube donation string into structured currency info.
   *
   * @param {string} rawText e.g. "ARS 5,000.00", "$10.00", "€ 5.00", "100 zł"
   * @param {string} fallbackDollarCurrency Currency code to use for ambiguous '$' (e.g. 'USD')
   * @returns {Object|null}
   */
  function parseDonationText(rawText, fallbackDollarCurrency = 'USD') {
    if (!rawText) return null;
    const original = normalizeString(rawText);
    let working = original;

    let detectedCurrency = null;

    // 1. Try matching multi-char prefixes / codes first (longest matches first)
    for (const item of PREFIX_PATTERNS) {
      const p = item.pattern;
      // Prefix match (case insensitive)
      const prefixRegex = new RegExp('^' + escapeRegExp(p) + '\\s*', 'i');
      if (prefixRegex.test(working)) {
        detectedCurrency = item.code;
        working = working.replace(prefixRegex, '');
        break;
      }
      // Suffix match
      const suffixRegex = new RegExp('\\s*' + escapeRegExp(p) + '$', 'i');
      if (suffixRegex.test(working)) {
        detectedCurrency = item.code;
        working = working.replace(suffixRegex, '');
        break;
      }
    }

    // 2. Try matching single symbols if not found yet
    if (!detectedCurrency) {
      for (const item of SYMBOL_PATTERNS) {
        const p = item.pattern;
        const prefixRegex = new RegExp('^' + escapeRegExp(p) + '\\s*', 'i');
        if (prefixRegex.test(working)) {
          detectedCurrency = item.code;
          working = working.replace(prefixRegex, '');
          break;
        }
        const suffixRegex = new RegExp('\\s*' + escapeRegExp(p) + '$', 'i');
        if (suffixRegex.test(working)) {
          detectedCurrency = item.code;
          working = working.replace(suffixRegex, '');
          break;
        }
      }
    }

    // 3. Check for standalone '$'
    if (!detectedCurrency) {
      if (working.startsWith('$')) {
        detectedCurrency = fallbackDollarCurrency;
        working = working.slice(1).trim();
      } else if (working.endsWith('$')) {
        detectedCurrency = fallbackDollarCurrency;
        working = working.slice(0, -1).trim();
      }
    }

    // 4. Fallback check for any 3-letter ISO code pattern in remaining string
    if (!detectedCurrency) {
      const isoMatch = working.match(/([A-Z]{3})/);
      if (isoMatch) {
        detectedCurrency = isoMatch[1].toUpperCase();
        working = working.replace(isoMatch[1], '').trim();
      }
    }

    if (!detectedCurrency) {
      return null;
    }

    // Extract amount
    const amount = parseAmount(working, detectedCurrency);
    if (amount === null || amount <= 0) {
      return null;
    }

    return {
      originalText: original,
      detectedCurrency,
      amount
    };
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Converts and formats the parsed donation into the target currency.
   *
   * @param {Object} parsed Parsed result from parseDonationText
   * @param {Object} rates Exchange rates dictionary (base USD or EUR)
   * @param {string} targetCurrency e.g. "EUR"
   * @param {string} formatOption e.g. "original_append_symbol", "original_append_code", "target_first_symbol", "target_only"
   * @returns {string|null} Formatted text or null if rates missing
   */
  function convertAndFormat(parsed, rates, targetCurrency = 'EUR', formatOption = 'original_append_symbol') {
    if (!parsed || !rates) return null;

    const src = parsed.detectedCurrency.toUpperCase();
    const dst = targetCurrency.toUpperCase();

    // If already in target currency, do not translate
    if (src === dst) {
      return null;
    }

    const srcRate = rates[src];
    const dstRate = rates[dst];

    if (!srcRate || !dstRate) {
      return null;
    }

    // Convert via cross-rate: amount / srcRate * dstRate
    const convertedAmount = (parsed.amount / srcRate) * dstRate;

    // Format target amount with native Intl.NumberFormat
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(dst);
    const fractionDigits = isZeroDecimal ? 0 : 2;

    const formattedTarget = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: dst,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(convertedAmount);

    const formattedTargetCode = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(convertedAmount) + ' ' + dst;

    switch (formatOption) {
      case 'original_append_code':
        return `${parsed.originalText} (≈ ${formattedTargetCode})`;
      case 'target_first_symbol':
        return `~${formattedTarget} (${parsed.originalText})`;
      case 'target_only':
        return `~${formattedTarget}`;
      case 'original_append_symbol':
      default:
        return `${parsed.originalText} (~${formattedTarget})`;
    }
  }

  root.YTDonationParser = {
    parseDonationText,
    parseAmount,
    convertAndFormat
  };
})(typeof window !== 'undefined' ? window : globalThis);

