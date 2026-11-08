# YouTube Donation Currency Converter

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](manifest.json)
[![Chrome & Firefox Compatible](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox%20%7C%20Edge%20%7C%20Brave-orange.svg)](#installation)
[![Tests Passing](https://img.shields.io/badge/tests-passing-brightgreen.svg)](test/test-parser.js)

A lightweight, open-source browser extension for **Chromium** (Chrome, Brave, Edge, Opera) and **Firefox** that automatically converts YouTube Live Chat Super Chats and Super Stickers in foreign currencies (such as `ARS`, `BRL`, `TRY`, `JPY`, `KRW`) to your preferred local currency (`EUR`, `USD`, etc.) in real time.

---

## The Problem It Solves

Ever been watching a live stream and seen a donation like `ARS 5,000.00` or `100,00 zł`, wondering how much that actually is in Euro or USD?

```text
Before:  ARS 5,000.00
After:   ARS 5,000.00 (~€2.67)
```

This extension automatically converts foreign amounts right inside YouTube Live Chat, keeping the original amount visible while showing you the exact equivalent in your chosen currency!

---

## Features

- **Real-Time Live Chat Conversion**: Instantly converts Super Chats, Super Stickers, and top ticker bar items as they appear in the stream or during stream replays.
- **Dual Display (Original + Converted)**: Keeps the original amount intact and appends the converted amount (e.g. `ARS 5,000.00 (~€2.67)`).
- **Smart Same-Currency Skip**: If a donation is already in your chosen currency (e.g. `€10.00` when your target is `EUR`), it remains untouched.
- **Flexible Source Currency Modes**:
  - **Automatic Mode**: Converts all foreign currencies different from your target currency.
  - **Whitelist Filter Mode**: Only convert specific currencies you pick (e.g., only convert `ARS`, `TRY`, `BRL`).
- **4 Customizable Display Formats**:
  1. `Original (~Symbol)`: `ARS 5,000.00 (~€2.67)` *(Default)*
  2. `Original (≈ Code)`: `ARS 5,000.00 (≈ 2.67 EUR)`
  3. `~Symbol (Original)`: `~€2.67 (ARS 5,000.00)`
  4. `Target Only`: `~€2.67` *(Hover tooltip reveals original)*
- **Ambiguous `$` Symbol Disambiguation**: Configure what standalone `$` represents (defaults to `USD`, configurable to `CAD`, `AUD`, `NZD`, `SGD`, etc.).
- **Zero Setup & Free Daily Rates**: Powered by free daily rates (160+ world currencies via Open Exchange Rates API) with 24-hour smart caching in browser storage and offline support. No API keys needed!
- **Instant Tab Reactivity**: Changing options in the extension popup immediately updates all existing donations in open YouTube tabs without needing a page refresh.
- **Privacy-First**: No analytics, no tracking, zero third-party dependencies.

---

## Installation

### 1. Chromium Browsers (Google Chrome, Brave, Microsoft Edge, Opera)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Ulyxx3/yt-donation-converter-.git
   ```
2. Open your browser and navigate to:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `yt-donation-converter` folder (or `dist/chrome`).
5. Open any YouTube live stream with Super Chats active!

---

### 2. Mozilla Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**.
3. Select `manifest.json` in the root repository folder (or inside `dist/firefox/manifest.json` after running `npm run build`).
4. Pin the extension icon to your toolbar to configure your preferred currency.

---

## Configuration & Popup Options

Click the extension icon in your browser toolbar to open the settings panel:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Enable / Disable** | Master toggle to turn conversion on or off. | `On` |
| **Convert Donations To** | Your target currency (e.g. `EUR`, `USD`, `GBP`, `CAD`, `JPY`...). | `EUR` |
| **Convert From** | Choose between converting all foreign currencies or only selected ones. | `All foreign` |
| **Display Format** | How the converted amount is styled in chat. | `Original (~Symbol)` |
| **`$` Fallback Currency** | Which currency to assume when chat displays just `$`. | `USD` |
| **Sync Rates** | Check rate cache age or force update fresh exchange rates. | Daily auto |

---

## Development & Building

The project is built with zero external runtime dependencies using standard WebExtension APIs.

### Run Tests
```bash
npm test
```

### Build Distribution Packages (.zip)
```bash
npm run build
```
This will build and package:
- `dist/chrome/` & `dist/yt-donation-converter-chrome-v1.0.0.zip`
- `dist/firefox/` & `dist/yt-donation-converter-firefox-v1.0.0.zip`

---

## Project Structure

```text
yt-donation-converter/
├── .github/workflows/          # GitHub Actions CI for tests & releases
│   └── build-release.yml
├── dist/                       # Packaged extension artifacts (Chrome & Firefox)
├── icons/                      # Extension icons (16, 32, 48, 128 px)
├── src/
│   ├── background/
│   │   └── background.js       # Service worker: fetches & caches daily rates
│   ├── content/
│   │   ├── content.js          # Live Chat MutationObserver & DOM injector
│   │   ├── content.css         # Styling for converted currency annotations
│   │   └── parser.js           # Multi-currency & number parsing engine
│   ├── popup/
│   │   ├── popup.html          # Extension options UI
│   │   ├── popup.css           # Modern YouTube dark/light theme styling
│   │   └── popup.js            # Settings controller & live preview
│   └── utils/
│       └── currencies.js       # ISO-4217 database & symbol dictionary
├── test/
│   └── test-parser.js          # Unit tests for currency parser & formats
├── build.js                    # Cross-browser build & pack script
├── manifest.json               # Universal Manifest V3 specification
├── package.json
└── README.md
```

---

## Supported Currencies

Supports **160+ world currencies**, including:
`ARS`, `USD`, `EUR`, `GBP`, `JPY`, `CAD`, `AUD`, `BRL`, `MXN`, `TRY`, `INR`, `KRW`, `CHF`, `PLN`, `SEK`, `NOK`, `DKK`, `PHP`, `CLP`, `COP`, `PEN`, `TWD`, `HKD`, `SGD`, `NZD`, `THB`, `IDR`, `VND`, `MYR`, `HUF`, `CZK`, `ILS`, `ZAR`, `SAR`, `AED`, `UAH`, and many more.

---

## Contributing

Contributions, bug reports, and suggestions are welcome!
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## License

Distributed under the GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE) for details.
