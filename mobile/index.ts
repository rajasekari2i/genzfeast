// Must be the first import — react-native-gesture-handler (a peer dep of
// @react-navigation/drawer, used by the role-based side menu) requires this
// on Android/iOS to install its native event handlers correctly.
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';

import App from './App';
import { registerBackgroundResetCodeHandler } from './src/notifications/passwordResetPush';

// Must be registered here, outside the React tree — @react-native-firebase/messaging
// only invokes this while the app is backgrounded/killed if it's set at module
// scope before AppRegistry.registerComponent (specs/003-forgot-password-otp-reset
// User Story 3; the foreground case is registerForegroundResetCodeListener in App.tsx).
messaging().setBackgroundMessageHandler(registerBackgroundResetCodeHandler);

AppRegistry.registerComponent('main', () => App);
