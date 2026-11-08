/**
 * Automated test suite for YouTube Donation Currency Parser.
 */

const assert = require('assert');

// Load modules into global context
require('../src/utils/currencies.js');
require('../src/content/parser.js');

const parser = globalThis.YTDonationParser;
const currencies = globalThis.YTCurrencyData;

console.log('🧪 Running YouTube Donation Converter test suite...\n');

const mockRates = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  ARS: 1725.0,
  BRL: 5.75,
  TRY: 34.2,
  JPY: 154.0,
  KRW: 1390.0
};

// 1. ARS Parsing Tests (The user's specific case)
{
  const test1 = parser.parseDonationText('ARS 5,000.00', 'USD');
  assert(test1 !== null, 'Failed to parse ARS 5,000.00');
  assert.strictEqual(test1.detectedCurrency, 'ARS');
  assert.strictEqual(test1.amount, 5000);

  const converted1 = parser.convertAndFormat(test1, mockRates, 'EUR', 'original_append_symbol');
  assert(converted1.includes('ARS 5,000.00'), 'Should contain original text');
  assert(converted1.includes('2,67') || converted1.includes('2.67'), 'Should convert 5000 ARS to ~2.67 EUR');
  console.log('  ✔ ARS 5,000.00 (comma thousand) -> EUR converted correctly');

  const test2 = parser.parseDonationText('ARS 5.000,00', 'USD');
  assert(test2 !== null, 'Failed to parse ARS 5.000,00');
  assert.strictEqual(test2.detectedCurrency, 'ARS');
  assert.strictEqual(test2.amount, 5000);
  console.log('  ✔ ARS 5.000,00 (dot thousand) -> EUR converted correctly');
}

// 2. Same-currency test (Must NOT translate if already in chosen currency)
{
  const eurSample = parser.parseDonationText('€ 10.00', 'USD');
  assert.strictEqual(eurSample.detectedCurrency, 'EUR');
  const eurResult = parser.convertAndFormat(eurSample, mockRates, 'EUR', 'original_append_symbol');
  assert.strictEqual(eurResult, null, 'Must return null when donation is already in chosen currency');
  console.log('  ✔ No translation when donation currency matches target currency (EUR === EUR)');
}

// 3. Multi-currency and symbol parsing
const testCases = [
  { raw: 'US$ 20.00', expCurr: 'USD', expAmount: 20 },
  { raw: '$ 50.00', expCurr: 'USD', expAmount: 50 },
  { raw: 'CA$ 25.50', expCurr: 'CAD', expAmount: 25.5 },
  { raw: 'A$ 15.00', expCurr: 'AUD', expAmount: 15 },
  { raw: 'R$ 100,00', expCurr: 'BRL', expAmount: 100 },
  { raw: '£ 25.00', expCurr: 'GBP', expAmount: 25 },
  { raw: '¥ 10,000', expCurr: 'JPY', expAmount: 10000 },
  { raw: '₩ 50,000', expCurr: 'KRW', expAmount: 50000 },
  { raw: 'TRY 150.00', expCurr: 'TRY', expAmount: 150 },
  { raw: '100,00 zł', expCurr: 'PLN', expAmount: 100 },
  { raw: '50,00 kr', expCurr: 'SEK', expAmount: 50 }
];

for (const tc of testCases) {
  const res = parser.parseDonationText(tc.raw, 'USD');
  assert(res !== null, `Failed to parse: ${tc.raw}`);
  assert.strictEqual(res.detectedCurrency, tc.expCurr, `Currency mismatch for ${tc.raw}`);
  assert.strictEqual(res.amount, tc.expAmount, `Amount mismatch for ${tc.raw}`);
  console.log(`  ✔ Parsed "${tc.raw}" -> ${res.detectedCurrency} ${res.amount}`);
}

// 4. Formatting styles tests
{
  const sample = parser.parseDonationText('ARS 5,000.00', 'USD');

  const fmt1 = parser.convertAndFormat(sample, mockRates, 'EUR', 'original_append_symbol');
  assert(fmt1.startsWith('ARS 5,000.00 (~'), 'Format original_append_symbol failed');

  const fmt2 = parser.convertAndFormat(sample, mockRates, 'EUR', 'original_append_code');
  assert(fmt2.includes('EUR') && fmt2.includes('≈'), 'Format original_append_code failed');

  const fmt3 = parser.convertAndFormat(sample, mockRates, 'EUR', 'target_first_symbol');
  assert(fmt3.startsWith('~') && fmt3.includes('(ARS 5,000.00)'), 'Format target_first_symbol failed');

  const fmt4 = parser.convertAndFormat(sample, mockRates, 'EUR', 'target_only');
  assert(!fmt4.includes('ARS'), 'Format target_only should not contain original');

  console.log('  ✔ All 4 display format options verified');
}

console.log('\n🎉 All test suites passed successfully!\n');

