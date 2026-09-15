import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist');
const assetsDir = path.join(distDir, 'assets');
const distSwPath = path.join(distDir, 'sw.js');

try {
  if (!fs.existsSync(distDir) || !fs.existsSync(distSwPath)) {
    console.warn('[inject-sw-assets] dist or dist/sw.js not found. Skipping.');
    process.exit(0);
  }

  let assetFiles = [];
  if (fs.existsSync(assetsDir)) {
    assetFiles = fs.readdirSync(assetsDir)
      .filter(file => !file.endsWith('.map'))
      .map(file => `/assets/${file}`);
  }

  console.log(`[inject-sw-assets] Discovered ${assetFiles.length} Vite bundle assets.`);

  let swContent = fs.readFileSync(distSwPath, 'utf8');

  // Replace placeholder or existing BUILD_ASSETS array
  const replacement = `const BUILD_ASSETS = ${JSON.stringify(assetFiles, null, 2)};`;
  
  if (swContent.includes('const BUILD_ASSETS = [];') || swContent.includes('const BUILD_ASSETS = [/* INJECTED_AT_BUILD */];')) {
    swContent = swContent.replace(/const BUILD_ASSETS\s*=\s*\[[\s\S]*?\];/, replacement);
  } else if (/const BUILD_ASSETS\s*=\s*\[[\s\S]*?\];/.test(swContent)) {
    swContent = swContent.replace(/const BUILD_ASSETS\s*=\s*\[[\s\S]*?\];/, replacement);
  } else {
    // If not found, prepend to file
    swContent = `${replacement}\n${swContent}`;
  }

  fs.writeFileSync(distSwPath, swContent, 'utf8');
  console.log('[inject-sw-assets] Successfully injected bundle assets into dist/sw.js');
} catch (err) {
  console.error('[inject-sw-assets] Error injecting assets into sw.js:', err);
  // Do not fail the build if script fails
}
