import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { images } from '../../../assets/png/images';
import Toast from 'react-native-toast-message';
import { useUser } from '../../../context/UserContext';
import {
  getNotificationsCollection,
  getUsersCollection,
  getChatsCollection,
  collection,
  doc,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDocs,
  db,
} from '../../../config/firebase';

/**
 * ─── DATA MODEL ────────────────────────────────────────────────────────────────
 *
 * /chats/{chatId}                    ← conversation metadata doc
 *   participants: [uid1, uid2]
 *   lastMessage:  string
 *   lastMessageAt: Timestamp
 *   lastSenderId: string
 *
 * /chats/{chatId}/messages/{msgId}   ← individual messages subcollection
 *   senderId: string
 *   text: string
 *   createdAt: Timestamp
 *
 * chatId = [uid1, uid2].sort().join('_')
 * This is deterministic — both users derive the SAME chatId independently.
 * Querying the subcollection only needs orderBy('createdAt') — no composite index!
 */

interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'other';
  createdAt: Date | null;
}

// Derive a stable, shared chat ID from two user UIDs
function getChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

const MessageScreen = ({ route, navigation }: any) => {
  const { name, initials, otherUserId } = route.params || {};
  const { authUser } = useUser();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [chatList, setChatList] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const flatListRef = useRef<FlatList>(null);

  // ─── Real-time listener on the shared messages subcollection ────────────────
  useEffect(() => {
    if (!authUser?.uid || !otherUserId) {
      setLoading(false);
      return;
    }

    const chatId = getChatId(authUser.uid, otherUserId);
    const msgsRef = collection(db, 'chats', chatId, 'messages');
    const msgsQuery = query(msgsRef, orderBy('createdAt', 'asc'));

    // ─── Mark as read immediately when entering the chat ───────────────────────
    const markAsRead = async () => {
      try {
        const chatDocRef = doc(db, 'chats', chatId);
        await setDoc(chatDocRef, {
          readStatus: {
            [authUser.uid]: true
          }
        }, { merge: true });
      } catch (e) {
        console.log('[MessageScreen] markAsRead error:', e);
      }
    };
    markAsRead();

    const unsubscribe = onSnapshot(
      msgsQuery,
      (snap: any) => {
        if (!snap) {
          setLoading(false);
          return;
        }

        const items: ChatMessage[] = snap.docs.map((d: any) => {
          const data = d.data() as any;
          return {
            id: d.id,
            text: data.text || '',
            sender: data.senderId === authUser.uid ? 'me' : 'other',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });

        setChatList(items);
        setLoading(false);

        // Auto-scroll to newest message
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      },
      (err: any) => {
        console.log('[MessageScreen] snapshot error:', err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [authUser, otherUserId]);

  // ─── Send a message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = message.trim();
    if (!authUser?.uid || !otherUserId || !trimmed || sending) return;
    if (trimmed.length > 500) {
      Toast.show({ type: 'error', text1: 'Too long', text2: 'Messages cannot exceed 500 characters.' });
      return;
    }

    setSending(true);
    setMessage(''); // clear input immediately for snappier UX

    const chatId = getChatId(authUser.uid, otherUserId);
    const now = serverTimestamp();
    const chatDocRef = doc(db, 'chats', chatId);
    const msgsRef = collection(db, 'chats', chatId, 'messages');

    try {
      // Create / update the conversation first: the security rules check that the sender
      // is a participant of this chat before a message can be added.
      await setDoc(
        chatDocRef,
        {
          participants: [authUser.uid, otherUserId].sort(),
          lastMessage: trimmed,
          lastMessageAt: now,
          lastSenderId: authUser.uid,
          readStatus: {
            [otherUserId]: false, // Mark as unread for the recipient
            [authUser.uid]: true,  // Mark as read for me
          }
        },
        { merge: true },
      );

      // Write the message to the subcollection
      await addDoc(msgsRef, {
        senderId: authUser.uid,
        text: trimmed,
        createdAt: now,
      });

      // ── Send in-app notification to recipient ─────────────────────────
      try {
        // Get current user's name for notification
        const senderQuery = query(getUsersCollection(), where('uid', '==', authUser.uid), limit(1));
        const senderSnap = await getDocs(senderQuery);
        const senderData = senderSnap.docs[0]?.data() as any;
        const senderName = senderData?.fullName || 'User';
        const senderInitials = senderName.split(' ').filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

        await addDoc(getNotificationsCollection(otherUserId), {
          type: 'message',
          title: `New message from ${senderName}`,
          body: trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed,
          fromUserId: authUser.uid,
          fromUserName: senderName,
          otherUserId: authUser.uid,
          otherUserName: senderName,
          otherUserInitials: senderInitials,
          relatedId: chatId,
          isRead: false,
          createdAt: serverTimestamp(),
        });
      } catch (notifErr) {
        console.log('[MessageScreen] notify error:', notifErr);
      }
    } catch (e) {
      console.log('[MessageScreen] send error:', e);
      // Restore message text on failure
      setMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender === 'me';
    return (
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.myMessage : styles.otherMessage,
        ]}>
        <Text
          style={[
            styles.messageText,
            { color: isMe ? COLORS.white : COLORS.gray900 },
          ]}>
          {item.text}
        </Text>
        {item.createdAt && (
          <Text
            style={[
              styles.timeText,
              { color: isMe ? COLORS.white + 'BB' : COLORS.slate500 },
            ]}>
            {formatTime(item.createdAt)}
          </Text>
        )}
      </View>
    );
  };

  // iOS: use KeyboardAvoidingView, Android: rely on windowSoftInputMode=adjustResize for consistent behavior
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}>
        <View style={styles.container}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}>
              <Image
                source={images.backarrow}
                resizeMode="contain"
                tintColor={COLORS.black}
                style={{ width: scale(28), height: verticalScale(28) }}
              />
            </TouchableOpacity>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || '?'}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {name || 'Chat'}
              </Text>
            </View>
          </View>

          {/* ── Messages ── */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={COLORS.red600} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={chatList}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              onLayout={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyEmoji}>👋</Text>
                  <Text style={styles.emptyText}>
                    No messages yet.{'\n'}Say hello to {name}!
                  </Text>
                </View>
              }
              contentContainerStyle={[
                styles.listContent,
                chatList.length === 0 && { flex: 1 },
              ]}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* ── Input bar ── */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.slate500}
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!message.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!message.trim() || sending}>
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Image
                  source={images.sendicon}
                  resizeMode="contain"
                  tintColor={COLORS.white}
                  style={{ width: scale(18), height: verticalScale(18) }}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Android
  return (
    <View style={[styles.container, { paddingTop: insets.top }]} >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Image
            source={images.backarrow}
            resizeMode="contain"
            tintColor={COLORS.black}
            style={{ width: scale(28), height: verticalScale(28) }}
          />
        </TouchableOpacity>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {name || 'Chat'}
          </Text>
        </View>
      </View>

      {/* ── Messages ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.red600} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={chatList}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          onLayout={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyEmoji}>👋</Text>
              <Text style={styles.emptyText}>
                No messages yet.{'\n'}Say hello to {name}!
              </Text>
            </View>
          }
          contentContainerStyle={[
            styles.listContent,
            chatList.length === 0 && { flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.slate500}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          {message.length > 400 && (
            <Text style={styles.charCount}>{message.length}/500</Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!message.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!message.trim() || sending}>
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Image
              source={images.sendicon}
              resizeMode="contain"
              tintColor={COLORS.white}
              style={{ width: scale(18), height: verticalScale(18) }}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MessageScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backBtn: {
    padding: scale(4),
  },
  avatar: {
    height: verticalScale(42),
    width: scale(42),
    borderRadius: scale(21),
    backgroundColor: COLORS.red100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: scale(15),
    color: COLORS.red600,
    fontFamily: karma.f700,
  },
  headerName: {
    fontSize: scale(15),
    fontFamily: karma.f700,
    color: COLORS.gray900,
  },
  // List
  listContent: {
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(100),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: verticalScale(8),
  },
  loadingText: {
    fontSize: scale(13),
    color: COLORS.slate500,
    fontFamily: karma.f400,
    marginTop: verticalScale(8),
  },
  emptyEmoji: {
    fontSize: scale(40),
    marginBottom: verticalScale(6),
  },
  emptyText: {
    fontSize: scale(14),
    color: COLORS.slate500,
    fontFamily: karma.f400,
    textAlign: 'center',
    lineHeight: verticalScale(22),
  },
  // Bubbles
  messageBubble: {
    maxWidth: '78%',
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(13),
    borderRadius: scale(16),
    marginBottom: verticalScale(6),
  },
  myMessage: {
    backgroundColor: COLORS.red600,
    alignSelf: 'flex-end',
    borderBottomRightRadius: scale(3),
  },
  otherMessage: {
    backgroundColor: COLORS.white,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: scale(3),
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  messageText: {
    fontSize: scale(14),
    fontFamily: karma.f500,
    lineHeight: verticalScale(20),
  },
  timeText: {
    fontSize: scale(10),
    fontFamily: karma.f400,
    marginTop: verticalScale(3),
    alignSelf: 'flex-end',
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray300,
  },
  textInput: {
    flex: 1,
    minHeight: verticalScale(42),
    maxHeight: verticalScale(110),
    backgroundColor: '#f5f5f5',
    borderRadius: scale(22),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    fontSize: scale(14),
    fontFamily: karma.f400,
    color: COLORS.gray900,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  charCount: {
    fontSize: scale(10),
    color: COLORS.slate400,
    textAlign: 'right',
    paddingRight: scale(4),
    marginTop: verticalScale(2),
  },
  sendBtn: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: scale(21),
    backgroundColor: COLORS.red600,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.red600,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.gray300,
    elevation: 0,
    shadowOpacity: 0,
  },
});
