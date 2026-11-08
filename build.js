#!/usr/bin/env node

/**
 * YouTube Donation Currency Converter - Build Script
 * Builds production packages for Chrome/Chromium and Firefox with zero dependencies.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CHROME_DIR = path.join(DIST_DIR, 'chrome');
const FIREFOX_DIR = path.join(DIST_DIR, 'firefox');

const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const version = manifest.version || '1.0.0';

console.log(`\n🚀 Building YouTube Donation Currency Converter v${version}...\n`);

// Clean dist folder
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(CHROME_DIR, { recursive: true });
fs.mkdirSync(FIREFOX_DIR, { recursive: true });

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Files and folders to bundle
const itemsToCopy = ['icons', 'src'];

for (const item of itemsToCopy) {
  const srcPath = path.join(ROOT_DIR, item);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, path.join(CHROME_DIR, item));
    copyRecursive(srcPath, path.join(FIREFOX_DIR, item));
  }
}

// 1. Chrome Manifest
const chromeManifest = JSON.parse(JSON.stringify(manifest));
// Remove Firefox-specific gecko ID for clean Chrome package
delete chromeManifest.browser_specific_settings;
fs.writeFileSync(
  path.join(CHROME_DIR, 'manifest.json'),
  JSON.stringify(chromeManifest, null, 2)
);
console.log('  ✔ Created Chrome manifest: dist/chrome/manifest.json');

// 2. Firefox Manifest
// Firefox supports both background.scripts (MV2 & MV3) and background.service_worker (121+)
// Using background.scripts ensures broad compatibility with older Firefox releases too.
const firefoxManifest = JSON.parse(JSON.stringify(manifest));
firefoxManifest.background = {
  scripts: ['src/background/background.js']
};
fs.writeFileSync(
  path.join(FIREFOX_DIR, 'manifest.json'),
  JSON.stringify(firefoxManifest, null, 2)
);
console.log('  ✔ Created Firefox manifest: dist/firefox/manifest.json');

// 3. Create Zip archives using Python standard library
function createZip(sourceDir, zipName) {
  const zipPath = path.join(DIST_DIR, zipName);
  const cmd = `python3 -c "import zipfile, os, sys; z_path, s_dir = sys.argv[1], sys.argv[2]; z = zipfile.ZipFile(z_path, 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), s_dir)) for r, d, files in os.walk(s_dir) for f in files]; z.close()" "${zipPath}" "${sourceDir}"`;
  execSync(cmd);
  const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
  console.log(`  📦 Generated archive: ${zipName} (${sizeKb} KB)`);
}

createZip(CHROME_DIR, `yt-donation-converter-chrome-v${version}.zip`);
createZip(FIREFOX_DIR, `yt-donation-converter-firefox-v${version}.zip`);

console.log('\n✨ Build complete! Output located in dist/\n');
