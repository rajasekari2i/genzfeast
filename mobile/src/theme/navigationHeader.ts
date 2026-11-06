import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, typography } from './tokens';

// React Navigation's native header is a native view, not a NativeWind
// className target — it needs real values, so these read from tokens.ts
// rather than restating hex literals per navigator.
//
// CRITICAL (FR-007a, research R7): headerTitleStyle must set `fontFamily`
// and MUST NOT set `fontWeight`. The previous revision set
// `fontWeight: '700'` here, which applies to EVERY stack header in the app;
// combined with a bundled family, Android would look for
// "<family>_bold.ttf", not find it, and silently render every screen title
// in the system font with no error at compile or build time.
const headerTitle = { fontFamily: typography.subtitleSm.fontFamily } as const;

/**
 * Student-facing surfaces: the cream ground, so the header reads as part of
 * the screen rather than a band of brand colour above it.
 */
export const primaryHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.espresso,
  headerTitleStyle: headerTitle,
};

/**
 * Back-of-house surfaces (Company Admin + Staff): navy chrome over the warm
 * grey ground. The app has two grounds, not one (research R1) — navy appears
 * only here, which is what visually separates counter work from the diner
 * experience.
 */
export const secondaryHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.primaryVariant },
  headerTintColor: colors.surface,
  headerTitleStyle: headerTitle,
};

/**
 * Auth stack. Deliberately distinct from both: commit c2b7b0c
 * ("match Login header to screen background, not brand orange") made the
 * Login header match its screen, and routing it at primaryHeaderOptions
 * would regress that. Same ground, no visible band.
 */
export const authHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.espresso,
  headerTitleStyle: headerTitle,
  headerShadowVisible: false,
};
