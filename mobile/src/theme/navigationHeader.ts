import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from './tokens';

// React Navigation's native header is a native view, not a NativeWind
// className target — it needs actual color values, so these read directly
// from tokens.ts rather than duplicating hex literals per navigator.

/** Auth (Login/Register) + Student App: the platform's standard orange header. */
export const primaryHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.surface,
  headerTitleStyle: { fontWeight: '700' },
};

/**
 * System Admin Portal + Tenant Admin & Staff App: the admin-tier header —
 * the darker primary-variant (Deep Navy). specs/013's original FR-010 asked
 * for this to be System-Admin-exclusive so a platform-wide screen never
 * looked identical to a single-company one; on explicit request this is now
 * shared by both admin surfaces instead, so Company Admin gets the same
 * navy header System Admin already had (both are still visually distinct
 * from Student's/the shared Profile screen's orange).
 */
export const secondaryHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.primaryVariant },
  headerTintColor: colors.surface,
  headerTitleStyle: { fontWeight: '700' },
};
