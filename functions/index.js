const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function: Triggered when a new notification document is created
 * in /notifications/{userId}/items/{itemId}.
 * Reads the recipient's FCM token from /users/{userId} and sends a push.
 */
exports.sendPushOnNotification = onDocumentCreated(
  'notifications/{userId}/items/{itemId}',
  async (event) => {
    const userId = event.params.userId;
    const data = event.data?.data();

    if (!data) return null;

    try {
      // Get recipient's FCM token (users doc id = uid)
      const userDocRef = admin.firestore().collection('users').doc(userId);
      const userSnap = await userDocRef.get();

      if (!userSnap.exists) {
        console.log(`No user doc found for uid: ${userId}`);
        return null;
      }

      const userDoc = userSnap.data();
      const fcmToken = userDoc.fcmToken;

      if (!fcmToken) {
        console.log(`No FCM token for user: ${userId}`);
        return null;
      }

      // Build notification payload
      const message = {
        token: fcmToken,
        notification: {
          title: data.title || 'BloodBridge',
          body: data.body || '',
        },
        data: {
          type: data.type || 'sos',
          fromUserId: data.fromUserId || '',
          fromUserName: data.fromUserName || '',
          otherUserId: data.otherUserId || '',
          otherUserName: data.otherUserName || '',
          otherUserInitials: data.otherUserInitials || '',
          relatedId: data.relatedId || '',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'blood_bridge_default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
      };

      await admin.messaging().send(message);
      console.log(`Push sent to user ${userId} for type: ${data.type}`);
    } catch (err) {
      console.error('sendPushOnNotification error:', err);
    }

    return null;
  },
);
