/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import messaging, { setBackgroundMessageHandler } from '@react-native-firebase/messaging';

// ── FCM Background / Quit-state message handler ─────────────────────────────
// This MUST be registered before AppRegistry.registerComponent
setBackgroundMessageHandler(messaging(), async remoteMessage => {
  // When app is in background/quit, FCM delivers the notification automatically.
  // We only need this handler for data-only messages — notification messages
  // are shown by the OS automatically.
  console.log('[FCM] Background message received:', remoteMessage.messageId);
});

AppRegistry.registerComponent(appName, () => App);
