// Soft-accent lookups — specs/017-ui-refresh FR-003a, research R4.
//
// The 61 distinct colours measured across the redesign canvas collapse into
// seven families, each a {soft, strong} pair. The same pair appears in three
// different roles, which is why it is defined once and looked up here rather
// than restated per consumer:
//
//   1. Status badges        soft background + strong label + dot
//   2. Icon tiles           soft background + strong glyph
//   3. Product image tints  soft background, rotated across the menu
//
// Screens MUST NOT import `accents` directly — go through statusColors.ts for
// status, or the helpers below (contract O3).
import { accents, type AccentName, type AccentPair } from './tokens';

export type { AccentName, AccentPair };
export { accents };

/**
 * The tint rotation for product-image placeholders. Deliberately a subset:
 * `red` is reserved for failure states and would read as an error on a dish,
 * and `blue` is back-of-house chrome.
 */
const TINT_ROTATION: AccentName[] = ['tangerine', 'sun', 'mint', 'violet', 'neutral'];

/**
 * Picks a stable tint for a product.
 *
 * Deterministic by id so a dish keeps the same placeholder colour between
 * renders and between sessions — a rotation by list index would reshuffle
 * every time the menu is filtered or a sold-out item is hidden.
 */
export function productTint(productId: string): string {
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) >>> 0;
  }
  return accents[TINT_ROTATION[hash % TINT_ROTATION.length]].soft;
}

/** Icon-tile colours for a named family. */
export function tile(name: AccentName): { backgroundColor: string; color: string } {
  return { backgroundColor: accents[name].soft, color: accents[name].strong };
}

export default accents;
