// Must be the first import — react-native-gesture-handler (a peer dep of
// @react-navigation/drawer, used by the role-based side menu) requires this
// on Android/iOS to install its native event handlers correctly.
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';

import App from './App';

// specs/003-forgot-password-otp-reset (revised) and
// specs/014-msg91-sms-otp-mobile-verification's pushes both now carry a
// visible `notification`, which FCM auto-displays itself while
// backgrounded/killed — neither needs a custom background message handler
// registered here anymore (each screen/notification file's own foreground
// `onMessage` listener, registered in App.tsx, covers the only case FCM
// doesn't auto-display: the app already in the foreground).

AppRegistry.registerComponent('main', () => App);
