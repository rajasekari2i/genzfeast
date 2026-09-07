import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Lets code outside the component tree (the order-ready notification
 * tap-handler, specs/009 FR-007/User Story 3) navigate without needing a
 * `navigation` prop — attached to `<NavigationContainer ref={navigationRef}>`
 * in App.tsx.
 */
export const navigationRef = createNavigationContainerRef();
