import React, { useEffect } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import StackNavigator from './src/navigation/StackNavigator';
import Toast from 'react-native-toast-message';
import { getMessaging, onMessage, onNotificationOpenedApp, getInitialNotification } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import { UserProvider } from './src/context/UserContext';

export const navigationRef = createNavigationContainerRef();

// Web build: show a readable tab title ("Urgent Requests · Blood Bridge App") instead of route ids.
const APP_TITLE = 'Blood Bridge App';
const HIDDEN_TITLES = ['SplashScreen', 'OnboardingScreen', 'BottomTabs', 'HomeScreen'];
const documentTitle = {
  formatter: (_options: unknown, route?: { name?: string }) => {
    const name = route?.name;
    if (!name || HIDDEN_TITLES.includes(name)) return APP_TITLE;
    const label = name.replace(/Screen$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
    return `${label} · ${APP_TITLE}`;
  },
};

const App = () => {
  useEffect(() => {
    const messagingInstance = getMessaging(getApp());

    // ── Foreground notification listener ──────────────────────────────────────
    const unsubFg = onMessage(messagingInstance, async (remoteMessage: any) => {
      const data = remoteMessage.data || {};
      const title = remoteMessage.notification?.title || 'BloodBridge';
      const body = remoteMessage.notification?.body || '';
      // Show as a toast when app is in foreground
      Toast.show({ type: 'info', text1: title, text2: body, visibilityTime: 5000 });
    });

    // ── Background/quit tap handler ───────────────────────────────────────────
    onNotificationOpenedApp(messagingInstance, (remoteMessage: any) => {
      handleNotificationNavigation(remoteMessage.data);
    });

    // ── App launched from a notification (quit state) ─────────────────────────
    getInitialNotification(messagingInstance).then((remoteMessage: any) => {
      if (remoteMessage) {
        // Small delay to wait for navigation to be ready
        setTimeout(() => handleNotificationNavigation(remoteMessage.data), 1000);
      }
    });

    return unsubFg;
  }, []);

  const handleNotificationNavigation = (data: any) => {
    if (!data || !navigationRef.isReady()) return;

    const type = data.type;
    if (type === 'sos') {
      navigationRef.navigate('UrgentRequestsScreen' as never);
    } else if (type === 'message' && data.otherUserId) {
      navigationRef.navigate('MessageScreen' as never, {
        otherUserId: data.otherUserId,
        name: data.otherUserName || 'User',
        initials: data.otherUserInitials || 'U',
      } as never);
    } else if (type === 'contact_request' || type === 'contact_approved') {
      navigationRef.navigate('NotificationScreen' as never);
    }
  };

  return (
    <SafeAreaProvider>
      <UserProvider>
        <NavigationContainer ref={navigationRef} documentTitle={documentTitle}>
          <StackNavigator />
        </NavigationContainer>
      </UserProvider>
      <Toast />
    </SafeAreaProvider>
  )
}

export default App