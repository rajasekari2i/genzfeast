/** @type {import('tailwindcss').Config} */
//
// specs/017-ui-refresh (supersedes specs/013-blue-theme-visual-design).
//
// Values are REQUIRED from src/theme/tokens.raw.js, not restated here. The
// previous revision hand-duplicated them with no check that the two agreed;
// at this feature's size that would be ~21 colours, 7 accent families, 12
// radii and 15 text styles maintained twice (research R9). theme/tokens.spec
// asserts the two stay equal.
//
// TWO THINGS HERE ARE LOAD-BEARING AND EASY TO UNDO BY ACCIDENT:
//
// 1. The seven legacy class names (text-h1, text-h2, text-body,
//    text-body-bold, text-price, text-caption, text-button) are KEPT and
//    remapped. NativeWind drops an unknown class SILENTLY — no compile
//    error, no build error, no runtime warning — so deleting one would
//    unstyle its call sites invisibly. Keeping the names is what reduces the
//    typography migration from 154 call sites to zero (research R11).
//
// 2. NO text utility sets fontWeight (FR-007a). Android resolves a bundled
//    face by asset FILE NAME and collapses any numeric weight >= 700 onto a
//    "_bold" suffix, so a bundled family plus fontWeight 700 silently
//    renders the system font. Weight is carried by the family name alone,
//    which is why the text utilities below are emitted by a plugin: Tailwind's
//    fontSize tuple can carry lineHeight/letterSpacing/fontWeight but NOT
//    fontFamily, so a plain theme.extend.fontSize could never attach a face.
const plugin = require('tailwindcss/plugin');
const t = require('./src/theme/tokens.raw.js');

/** camelCase token key -> kebab-case Tailwind colour key. */
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/** Flatten the core palette plus every accent family into Tailwind colour keys. */
function buildColors() {
  const out = {};
  for (const [name, value] of Object.entries(t.colors)) out[kebab(name)] = value;
  for (const [family, pair] of Object.entries(t.accents)) {
    for (const [role, value] of Object.entries(pair)) out[`${family}-${role}`] = value;
  }
  return out;
}

/**
 * One utility per text style, carrying family + size + line-height +
 * tracking together. Emitted as a plugin because fontSize tuples cannot
 * carry fontFamily; without this every text node would need a second
 * `font-*` class (~154 extra edits).
 *
 * Also emits the seven legacy aliases, so existing screens keep working
 * untouched.
 */
const textStyles = plugin(({ addUtilities }) => {
  const utilities = {};
  const emit = (className, style) => {
    utilities[`.${className}`] = {
      fontFamily: style.fontFamily,
      fontSize: `${style.fontSize}px`,
      lineHeight: `${style.lineHeight}px`,
      letterSpacing: `${style.letterSpacing}px`,
      // fontWeight is deliberately absent — see the header note.
    };
  };

  for (const [name, style] of Object.entries(t.typography)) {
    emit(`text-${kebab(name)}`, style);
  }
  for (const [alias, target] of Object.entries(t.legacyTypographyAliases)) {
    emit(`text-${alias}`, t.typography[target]);
  }
  addUtilities(utilities);
});

module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: buildColors(),
      // fontSize is intentionally NOT extended — the plugin above owns every
      // text-* style utility so that family and size always travel together.
      // Escape hatch only, if the plugin route ever has to be abandoned:
      fontFamily: {
        display: [t.typography.display.fontFamily],
        body: [t.typography.body.fontFamily],
        'body-semi': [t.typography.label.fontFamily],
        'body-bold': [t.typography.bodyBold.fontFamily],
      },
      // spacing feeds padding/margin AND the h-/w- scales, so the named
      // control heights live here too: h-touch (44, the accessibility
      // floor), h-field (48), h-control (52). A component never writes a
      // raw size (contract O1).
      spacing: {
        ...Object.fromEntries(Object.entries(t.spacing).map(([k, v]) => [k, `${v}px`])),
        ...Object.fromEntries(Object.entries(t.size).map(([k, v]) => [k, `${v}px`])),
      },
      borderRadius: Object.fromEntries(
        Object.entries(t.radius).map(([k, v]) => [k, `${v}px`]),
      ),
    },
  },
  plugins: [textStyles],
};
