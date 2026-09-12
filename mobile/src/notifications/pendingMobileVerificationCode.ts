import AsyncStorage from '@react-native-async-storage/async-storage';

// Bridges mobileVerificationPush.ts's background handler to RegisterScreen
// — the screen has no direct connection to whichever handler fires, so the
// code is written here and read back (specs/014, mirrors pendingResetCode.ts).
// Unlike password-reset's single outstanding flow, a student can restart
// this flow for a *different* mobile number, so the pending value is scoped
// to the number it was sent for — consuming it for a different number
// returns null (and still clears the stale entry) rather than leaking a
// stale code across numbers.
const PENDING_CODE_KEY = 'genzfeast.pendingMobileVerificationCode';

export async function storePendingMobileVerificationCode(mobileNumber: string, code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_CODE_KEY, JSON.stringify({ mobileNumber, code }));
}

/** Reads and clears the pending code in one call — single-use, like the code itself. */
export async function consumePendingMobileVerificationCode(mobileNumber: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(PENDING_CODE_KEY);
  if (!raw) {
    return null;
  }
  await AsyncStorage.removeItem(PENDING_CODE_KEY);
  try {
    const parsed = JSON.parse(raw) as { mobileNumber?: string; code?: string };
    return parsed.mobileNumber === mobileNumber && typeof parsed.code === 'string' ? parsed.code : null;
  } catch {
    return null;
  }
}
