/**
 * specs/017-ui-refresh T005.
 *
 * Declares the font asset directory for `react-native-asset`, which copies
 * everything under it into android/app/src/main/assets/fonts/.
 *
 * IMPORTANT (research R7): Android resolves a bundled face by ASSET FILE
 * NAME, not by PostScript name, and ReactFontManager collapses any numeric
 * weight >= 700 onto a "_bold" filename suffix. We therefore ship one
 * static instance per weight and never set a numeric fontWeight anywhere
 * (FR-007a) — a bundled family plus fontWeight 700 looks for
 * "<family>_bold.ttf", does not find it, and silently renders the system
 * font with no error at compile or build time.
 *
 * Expected files in assets/fonts/:
 *   BricolageGrotesque-ExtraBold.ttf
 *   Inter-Medium.ttf  Inter-SemiBold.ttf  Inter-Bold.ttf  Inter-ExtraBold.ttf
 */
module.exports = {
  project: {
    android: {},
  },
  assets: ['./assets/fonts'],
};
