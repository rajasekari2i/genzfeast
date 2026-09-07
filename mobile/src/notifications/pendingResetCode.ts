import AsyncStorage from '@react-native-async-storage/async-storage';

// Bridges the FCM data-payload handlers (passwordResetBackgroundTask.ts,
// passwordResetForegroundListener.ts) to ForgotPasswordVerifyScreen — the
// screen has no direct connection to whichever handler fires, so the code
// is written here and read back on mount (specs/003 User Story 3).
const PENDING_CODE_KEY = 'genzfeast.pendingPasswordResetCode';

export async function storePendingResetCode(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_CODE_KEY, code);
}

/** Reads and clears the pending code in one call — it's single-use, like the code itself. */
export async function consumePendingResetCode(): Promise<string | null> {
  const code = await AsyncStorage.getItem(PENDING_CODE_KEY);
  if (code) {
    await AsyncStorage.removeItem(PENDING_CODE_KEY);
  }
  return code;
}
