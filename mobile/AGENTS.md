# Bare React Native — no Expo

This app was migrated off Expo to the plain React Native CLI (see
`android/`, `ios/`, `index.ts`). Do not reintroduce `expo` or any `expo-*`
package — use the native/community RN equivalent instead (e.g.
`@react-native-firebase/messaging` for push, `react-native-image-picker`,
`react-native-keychain`, `react-native-config`).
