#!/usr/bin/env node
/**
 * specs/017-ui-refresh — build-time guard for the bundled typefaces.
 *
 * research R7: Android resolves a bundled face by ASSET FILE NAME. A missing
 * file is NOT a build error — react-native-asset silently copies nothing and
 * ReactFontManager falls through to Typeface.create(name, style), i.e. the
 * system font. That failure is invisible at compile and build time, so this
 * script is the guard (spec Edge Cases: "A font file absent at build time
 * must fail the theme/fonts.spec gate").
 *
 * Run via `npm run fonts:verify`.
 */
const fs = require('fs');
const path = require('path');

const REQUIRED = [
  'BricolageGrotesque-ExtraBold.ttf',
  'Inter-Medium.ttf',
  'Inter-SemiBold.ttf',
  'Inter-Bold.ttf',
  'Inter-ExtraBold.ttf',
];

const SRC = path.join(__dirname, '..', 'assets', 'fonts');
const LINKED = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'fonts');

function check(dir, label) {
  if (!fs.existsSync(dir)) return { missing: REQUIRED, label, dir };
  const present = new Set(fs.readdirSync(dir));
  return { missing: REQUIRED.filter((f) => !present.has(f)), label, dir };
}

const results = [check(SRC, 'source'), check(LINKED, 'linked')];
let failed = false;

for (const r of results) {
  if (r.missing.length === 0) {
    console.log(`✓ ${r.label}: all ${REQUIRED.length} faces present in ${r.dir}`);
  } else {
    failed = true;
    console.error(`✗ ${r.label}: ${r.missing.length} missing in ${r.dir}`);
    r.missing.forEach((f) => console.error(`    - ${f}`));
  }
}

if (failed) {
  console.error('\nFonts are NOT bundled. Every heading would silently render in the');
  console.error('system font, with no compile or build error. See assets/fonts/README.md.');
  process.exit(1);
}
