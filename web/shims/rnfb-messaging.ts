// Push notifications (FCM) are phone-only; on the web the in-app notification feed is used instead.
export const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 };
const noop = () => () => {};
export const getMessaging = () => ({});
export const onMessage = noop;
export const onNotificationOpenedApp = noop;
export const getInitialNotification = async () => null;
export const requestPermission = async () => AuthorizationStatus.DENIED;
export const getToken = async () => null;
export const setBackgroundMessageHandler = () => {};
const messaging = () => ({});
export default messaging;
