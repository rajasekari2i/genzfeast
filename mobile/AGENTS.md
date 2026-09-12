# Bare React Native — no Expo

This app was migrated off Expo to the plain React Native CLI (see
`android/`, `ios/`, `index.ts`). Do not reintroduce `expo` or any `expo-*`
package — use the native/community RN equivalent instead (e.g.
`react-native-image-picker`, `react-native-keychain`, `react-native-config`).

`@react-native-firebase/*` (FCM) is still used for password-reset and
order-pickup push delivery — don't remove it. `specs/014-msg91-sms-otp-mobile-verification`
added SMS (MSG91) as a SECOND, narrower channel used only for
registration-time mobile-number verification; it does not replace FCM.
