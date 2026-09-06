import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from './tokens';

// React Navigation's native header is a native view, not a NativeWind
// className target — it needs actual color values, so these read directly
// from tokens.ts rather than duplicating hex literals per navigator.

/** Student App + Tenant Admin & Staff App: the platform's standard header. */
export const primaryHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.surface,
  headerTitleStyle: { fontWeight: '700' },
};

/**
 * System Admin Portal: a visibly distinct header treatment (FR-010) — the
 * darker primary-variant, matching PlatformScopeHeader's own fill — so a
 * platform-wide screen never looks identical to a single-company one.
 */
export const platformScopeHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.primaryVariant },
  headerTintColor: colors.surface,
  headerTitleStyle: { fontWeight: '700' },
};
