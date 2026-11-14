import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import MessageCard from '../../../components/MessageCard.tsx';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import InputField from '../../../components/InputField/index.tsx';
import { images } from '../../../assets/png/images.tsx';
import PrivacyNotice from '../../../components/PrivacyNotice/index.tsx';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUsersCollection, getChatsCollection, query, where, orderBy, onSnapshot, getDocs, db, collection } from '../../../config/firebase';
import { useUser } from '../../../context/UserContext';

/**
 * ─── DATA MODEL ────────────────────────────────────────────────────────────────
 * Reads from /chats collection (new subcollection architecture).
 * Each chat doc has: { participants, lastMessage, lastMessageAt, lastSenderId }
 * The chatId is [uid1, uid2].sort().join('_') — both users share the same doc.
 */

interface Conversation {
  id: string;           // chatId
  otherUserId: string;
  initials: string;
  name: string;
  bloodType?: string;
  lastMessage: string;
  time: string;
  unread: number;
}

export default function ChatScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { authUser } = useUser();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!authUser?.uid) {
      setLoading(false);
      return;
    }

    // ── Listen to /chats where current user is a participant ──────────────────────
    // This simple query does NOT need a composite Firestore index.
    const chatsQuery = query(
      getChatsCollection(),
      where('participants', 'array-contains', authUser.uid)
    );
    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snap: any) => {
        if (!snap || !snap.docs.length) {
          setConversations([]);
          setLoading(false);
          return;
        }

        try {
          // Collect all other-user UIDs
          const otherUids: string[] = [];
          snap.docs.forEach((d: any) => {
            const data = d.data() as any;
            const participants: string[] = data.participants || [];
            const otherId = participants.find((p: string) => p !== authUser.uid);
            if (otherId) otherUids.push(otherId);
          });

          // Batch-load user profiles
          const userProfiles: { [uid: string]: any } = {};
          if (otherUids.length) {
            // Firestore 'in' supports up to 10 values; chunk if needed
            const chunks: string[][] = [];
            for (let i = 0; i < otherUids.length; i += 10) {
              chunks.push(otherUids.slice(i, i + 10));
            }
            for (const chunk of chunks) {
              const usersSnap = await getDocs(query(getUsersCollection(), where('uid', 'in', chunk)));
              usersSnap.docs.forEach((u: any) => {
                const d = u.data() as any;
                if (d.uid) userProfiles[d.uid] = d;
              });
            }
          }

          // Build conversation list
          const convs: Conversation[] = snap.docs
            .map((d: any) => {
              const data = d.data() as any;
              const participants: string[] = data.participants || [];
              const otherId = participants.find((p: string) => p !== authUser.uid);
              if (!otherId) return null;

              const profile = userProfiles[otherId] || {};
              const fullName: string = profile.fullName || 'User';
              const initials =
                fullName
                  .split(' ')
                  .filter(Boolean)
                  .map((part: string) => part[0])
                  .join('')
                  .slice(0, 2) || 'U';

              const lastAt = data.lastMessageAt?.toDate
                ? data.lastMessageAt.toDate()
                : null;

              // Format time: today → show time, older → show date
              let time = '';
              if (lastAt) {
                const now = new Date();
                const isToday =
                  lastAt.getDate() === now.getDate() &&
                  lastAt.getMonth() === now.getMonth() &&
                  lastAt.getFullYear() === now.getFullYear();
                time = isToday
                  ? lastAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : lastAt.toLocaleDateString([], { month: 'short', day: 'numeric' });
              }

              // ── Unread logic ──
              // Use the new readStatus flag if it exists; otherwise fall back to lastSenderId logic for legacy chats.
              let isUnread = false;
              if (data.readStatus && typeof data.readStatus[authUser.uid] === 'boolean') {
                isUnread = data.readStatus[authUser.uid] === false;
              } else {
                isUnread = data.lastSenderId !== authUser.uid;
              }

              const conv: any = {
                id: d.id,
                otherUserId: otherId,
                initials,
                name: fullName,
                bloodType: profile.bloodType,
                lastMessage: data.lastMessage || '',
                time,
                unread: isUnread ? 1 : 0,
                _ts: data.lastMessageAt?.toMillis ? data.lastMessageAt.toMillis() : 0,
              };
              return conv;
            })
            .filter(Boolean) as any[];

          // Client-side sort by timestamp to avoid requiring composite index
          convs.sort((a: any, b: any) => b._ts - a._ts);

          setConversations(convs);
        } catch (e) {
          console.log('[ChatScreen] conversations load error:', e);
        } finally {
          setLoading(false);
        }
      },
      (err: any) => {
        console.log('[ChatScreen] snapshot error:', err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [authUser]);

  const filtered = conversations.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} >
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      <View style={{ padding: scale(16) }}>
        <Text style={styles.heading}>Messages</Text>
      </View>

      <View style={[styles.paddedRow, { marginBottom: verticalScale(10) }]}>
        <InputField
          placeholder="Search conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={images.searchicon}
        />
      </View>

      <View style={styles.paddedRow}>
        <PrivacyNotice
          title="End-to-End Encrypted"
          description="Messages are encrypted end-to-end. Only people in this chat can read them."
          icon={images.eyeopen}
          tintColor={COLORS.green900}
          backgroundColor={COLORS.green200}
          borderColor={COLORS.green500}
          titleColor={COLORS.green900}
          descriptionColor={COLORS.green700}
          centerDescription
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.red600} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'No conversations match your search.'
              : 'No conversations yet.\nMessage a donor to get started!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            // @ts-ignore
            <MessageCard
              key={item.id}
              {...item}
              navigation={navigation}
              otherUserId={item.otherUserId}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: scale(16) }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  paddedRow: {
    paddingHorizontal: scale(16),
  },
  heading: {
    fontSize: scale(20),
    fontFamily: karma.f700,
    color: COLORS.gray900,
    marginBottom: verticalScale(12),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
    gap: verticalScale(8),
  },
  emptyEmoji: {
    fontSize: scale(42),
  },
  emptyText: {
    fontSize: scale(14),
    fontFamily: karma.f400,
    color: COLORS.slate500,
    textAlign: 'center',
    lineHeight: verticalScale(22),
  },
});
