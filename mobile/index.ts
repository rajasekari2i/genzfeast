// Must be the first import — react-native-gesture-handler (a peer dep of
// @react-navigation/drawer, used by the role-based side menu) requires this
// on Android/iOS to install its native event handlers correctly.
import type React from 'react';
import 'react-native-gesture-handler';
import { AppRegistry, LogBox } from 'react-native';

// @react-native-firebase v22 logs a deprecation warning for every
// namespaced call (getApp/onMessage/getToken/...). The app makes ~10 of
// them at startup, which is enough to raise LogBox's notification bar over
// the bottom of every screen and make the UI impossible to review on
// device. These are warnings about an SDK migration, not defects, so they
// are silenced rather than left to cover the layout. Remove this once the
// Firebase calls are moved to the modular API.
LogBox.ignoreLogs([
  // @react-native-firebase v22 logs this for every namespaced call
  // (getApp/onMessage/getToken/...); the app makes ~10 at startup.
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
  // The drawer and the admin/staff stack deliberately share route names
  // ("Dashboard", "Products", ...) so that drawer navigation lands on the
  // stack screen of the same name. Renaming either side would be a route
  // change, which this feature forbids (FR-028), so the advisory is
  // silenced rather than "fixed".
  'Found screens with the same name nested inside one another',
]);

// NOTE: this is a `require`, not an `import`, and that is load-bearing.
// ES imports are hoisted and evaluated before ANY statement in this
// module body, so `import App from './App'` would run App.tsx — and its
// Firebase calls — before the LogBox.ignoreLogs() call below, and the
// warnings would already be queued. Requiring it after the
// ignoreLogs() call above fixes the ordering.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require('./App').default as React.ComponentType;


// specs/003-forgot-password-otp-reset (revised) and
// specs/014-msg91-sms-otp-mobile-verification's pushes both now carry a
// visible `notification`, which FCM auto-displays itself while
// backgrounded/killed — neither needs a custom background message handler
// registered here anymore (each screen/notification file's own foreground
// `onMessage` listener, registered in App.tsx, covers the only case FCM
// doesn't auto-display: the app already in the foreground).

AppRegistry.registerComponent('main', () => App);
