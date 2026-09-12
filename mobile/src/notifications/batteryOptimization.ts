import { NativeModules, Platform } from 'react-native';

/**
 * Thin wrapper around the native `BatteryOptimizationModule`
 * (android/app/src/main/java/com/genzfeast/mobile/BatteryOptimizationModule.kt).
 * Android-only concept — no-op on iOS. See that file's doc comment for the
 * accepted Play Store risk this trades off against reliable FCM delivery.
 */
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const module = NativeModules.BatteryOptimizationModule as
    | { requestIgnoreBatteryOptimizations: () => Promise<void> }
    | undefined;
  await module?.requestIgnoreBatteryOptimizations();
}
