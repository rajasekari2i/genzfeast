# Bare React Native — no Expo

This app was migrated off Expo to the plain React Native CLI (see
`android/`, `ios/`, `index.ts`). Do not reintroduce `expo` or any `expo-*`
package — use the native/community RN equivalent instead (e.g.
`react-native-image-picker`, `react-native-keychain`, `react-native-config`).

`@react-native-firebase/*` (FCM) is still used for password-reset and
order-pickup push delivery — don't remove it. `specs/014-msg91-sms-otp-mobile-verification`
added SMS (MSG91) as a SECOND, narrower channel used only for
registration-time mobile-number verification; it does not replace FCM.

# Release builds — never combine `clean` with `assembleRelease`

Run them as two separate Gradle invocations:

    npm run clean:android          # only when you actually need a clean
    npm run build:android:release  # ENVFILE=.env.production + assembleRelease

`./gradlew clean assembleRelease` in ONE invocation fails. `clean` deletes
every module's `build/`, including
`node_modules/react-native-reanimated/android/build/intermediates/prefab_package/release/prefab`,
and the app's `generate_cxx_metadata` task then feeds that now-missing path
to the prefab CLI, which dies with `invalid value for <package_path>:
directory "..." is not readable`. Splitting the invocations lets Reanimated's
prefab task regenerate the package before the app consumes it.

`ENVFILE` belongs on the *Gradle* command, not on `react-native bundle` —
react-native-config injects the values natively via `dotenv.gradle` into
`BuildConfig`, so the JS bundle itself carries no env values. Without it,
Gradle falls back to `.env` (localhost API, local company) and the APK is
useless in production.

Release signing reads `android/keystore.properties` (gitignored). If that
file is absent, `build.gradle` silently falls back to the **debug** keystore
— the build succeeds but Play rejects the artifact.
