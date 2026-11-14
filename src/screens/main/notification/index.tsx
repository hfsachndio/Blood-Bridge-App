import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../utils/color';
import { karma } from '../../../assets/fonts/fonts';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { getNotificationsCollection, getDonationsCollection, addDoc, updateDoc, setDoc, doc, deleteDoc, query, orderBy, limit, onSnapshot, serverTimestamp, db } from '../../../config/firebase';
import { useUser } from '../../../context/UserContext';

interface AppNotification {
    id: string;
    type: 'sos' | 'message' | 'contact_request' | 'contact_approved';
    title: string;
    body: string;
    fromUserId: string;
    fromUserName: string;
    relatedId?: string;
    category?: 'sos' | 'donation';
    otherUserId?: string;
    otherUserName?: string;
    otherUserInitials?: string;
    isRead: boolean;
    createdAt: Date | null;
}

const formatTime = (date: Date | null): string => {
    if (!date) return '';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

const NotificationScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { authUser, profile } = useUser();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authUser?.uid) {
            setLoading(false);
            return;
        }

        const notifQuery = query(getNotificationsCollection(authUser.uid), orderBy('createdAt', 'desc'), limit(50));
        const unsubscribe = onSnapshot(
            notifQuery,
            (snap: any) => {
                if (!snap) {
                    setLoading(false);
                    return;
                }
                const items: AppNotification[] = snap.docs.map((d: any) => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        type: data.type || 'sos',
                        title: data.title || '',
                        body: data.body || '',
                        fromUserId: data.fromUserId || '',
                        fromUserName: data.fromUserName || 'User',
                        relatedId: data.relatedId,
                        category: data.category,
                        otherUserId: data.otherUserId,
                        otherUserName: data.otherUserName,
                        otherUserInitials: data.otherUserInitials,
                        isRead: !!data.isRead,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                    };
                });
                setNotifications(items);
                setLoading(false);
            },
            (err: any) => {
                console.log('[NotificationScreen] snapshot error:', err);
                setLoading(false);
            },
        );

        return unsubscribe;
    }, [authUser?.uid]);

    const markAsRead = async (id: string) => {
        if (!authUser?.uid) return;
        try {
            await updateDoc(doc(db, 'notifications', authUser.uid, 'items', id), { isRead: true });
        } catch (e) {
            console.log('[NotificationScreen] markAsRead error:', e);
        }
    };

    const handlePress = (notif: AppNotification) => {
        markAsRead(notif.id);

        if (notif.type === 'sos') {
            navigation.navigate('UrgentRequestsScreen');
        } else if (notif.type === 'message') {
            if (notif.otherUserId) {
                navigation.navigate('MessageScreen', {
                    otherUserId: notif.otherUserId,
                    name: notif.otherUserName || notif.fromUserName,
                    initials: notif.otherUserInitials || (notif.fromUserName || 'U').slice(0, 2).toUpperCase(),
                });
            }
        } else if (notif.type === 'contact_request') {
            // Show approval dialog
            Alert.alert(
                'Contact Info Request',
                `${notif.fromUserName} wants to see your contact number. Allow them to view it?`,
                [
                    { text: 'Deny', style: 'cancel' },
                    {
                        text: 'Allow',
                        style: 'default',
                        onPress: () => handleApproveContact(notif),
                    },
                ],
            );
        } else if (notif.type === 'contact_approved') {
            Alert.alert(
                'Request Approved! 🎉',
                `${notif.fromUserName} has approved your contact info request. You can now see their phone number on their donation post.`,
                [{ text: 'OK' }],
            );
        }
    };

    const handleApproveContact = async (notif: AppNotification) => {
        if (!notif.relatedId || !notif.fromUserId || !authUser?.uid) return;
        try {
            // 1. Mark contactApprovedFor on the relevant doc
            // We use dot notation to merge into the nested object without overwriting other uids
            const approveData = { [`contactApprovedFor.${notif.fromUserId}`]: true };
            const collectionName = notif.category === 'sos' ? 'requests' : 'donations';

            await updateDoc(doc(db, collectionName, notif.relatedId), approveData);

            // Send approval notification back to requester
            const myName = profile?.fullName || 'User';
            await addDoc(getNotificationsCollection(notif.fromUserId), {
                type: 'contact_approved',
                title: 'Contact Approved! 🎉',
                body: `${myName} approved your contact info request. You can now see their phone number.`,
                fromUserId: authUser.uid,
                fromUserName: myName,
                relatedId: notif.relatedId,
                isRead: false,
                createdAt: serverTimestamp(),
            });

            Alert.alert('Done!', 'Contact info approved. They can now see your phone number.');
        } catch (e) {
            console.log('[NotificationScreen] approveContact error:', e);
            Alert.alert('Error', 'Could not approve. Please try again.');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'sos': return '🚨';
            case 'message': return '💬';
            case 'contact_request': return '📞';
            case 'contact_approved': return '✅';
            default: return '🔔';
        }
    };

    const getBorderColor = (type: string) => {
        switch (type) {
            case 'sos': return COLORS.red600;
            case 'message': return COLORS.blue600;
            case 'contact_request': return COLORS.orange600;
            case 'contact_approved': return COLORS.green600;
            default: return COLORS.gray300;
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleClearAll = () => {
        if (notifications.length === 0) return;
        Alert.alert(
            'Clear Notifications',
            'Are you sure you want to clear all notifications?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: clearAllNotifications,
                },
            ],
        );
    };

    const clearAllNotifications = async () => {
        if (!authUser?.uid) return;
        try {
            await Promise.all(
                notifications.map(n =>
                    deleteDoc(doc(db, 'notifications', authUser.uid, 'items', n.id))
                )
            );
        } catch (e) {
            console.log('[NotificationScreen] clearAll error:', e);
            Alert.alert('Error', 'Could not clear notifications.');
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]} >
            <StatusBar backgroundColor={COLORS.red600} barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    {unreadCount > 0 && (
                        <Text style={styles.headerSubtitle}>
                            {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                        </Text>
                    )}
                </View>
                {notifications.length > 0 && (
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
                        <Text style={styles.clearBtnText}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.red600} />
                </View>
            ) : (
                <ScrollView
                    style={styles.notificationsList}
                    showsVerticalScrollIndicator={false}>
                    {notifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateIcon}>🔕</Text>
                            <Text style={styles.emptyStateTitle}>No Notifications</Text>
                            <Text style={styles.emptyStateText}>
                                You're all caught up! Check back later for updates.
                            </Text>
                        </View>
                    ) : (
                        notifications.map(notif => (
                            <TouchableOpacity
                                key={notif.id}
                                style={[
                                    styles.notificationCard,
                                    !notif.isRead && styles.notificationCardUnread,
                                    { borderLeftColor: getBorderColor(notif.type), borderLeftWidth: scale(4) },
                                ]}
                                onPress={() => handlePress(notif)}
                                activeOpacity={0.7}>
                                {/* Unread dot */}
                                {!notif.isRead && <View style={styles.unreadIndicator} />}

                                {/* Icon */}
                                <Text style={styles.iconEmoji}>{getIcon(notif.type)}</Text>

                                {/* Content */}
                                <View style={styles.notificationContent}>
                                    <Text style={styles.notificationTitle} numberOfLines={1}>
                                        {notif.title}
                                    </Text>
                                    <Text style={styles.notificationMessage} numberOfLines={2}>
                                        {notif.body}
                                    </Text>
                                    <Text style={styles.notificationTime}>{formatTime(notif.createdAt)}</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}
        </View>
    );
};

export default NotificationScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.red600,
        paddingHorizontal: scale(20),
        paddingTop: verticalScale(16),
        paddingBottom: verticalScale(20),
        borderBottomLeftRadius: scale(20),
        borderBottomRightRadius: scale(20),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clearBtn: {
        paddingVertical: scale(8),
        paddingHorizontal: scale(12),
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: scale(8),
    },
    clearBtnText: {
        fontSize: scale(14),
        fontFamily: karma.f600,
        color: COLORS.white,
    },
    headerTitle: {
        fontSize: scale(28),
        fontFamily: karma.f700,
        color: COLORS.white,
        marginBottom: verticalScale(4),
    },
    headerSubtitle: {
        fontSize: scale(14),
        fontFamily: karma.f400,
        color: COLORS.white,
        opacity: 0.9,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationsList: {
        flex: 1,
        paddingHorizontal: scale(16),
        paddingTop: verticalScale(16),
    },
    notificationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: scale(12),
        padding: scale(16),
        marginBottom: verticalScale(12),
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        position: 'relative',
        gap: scale(12),
    },
    notificationCardUnread: {
        backgroundColor: '#FFF5F5',
    },
    unreadIndicator: {
        position: 'absolute',
        top: verticalScale(12),
        right: scale(12),
        width: scale(9),
        height: scale(9),
        borderRadius: scale(5),
        backgroundColor: COLORS.red600,
    },
    iconEmoji: {
        fontSize: scale(26),
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: scale(15),
        fontFamily: karma.f600,
        color: COLORS.gray900,
        marginBottom: verticalScale(3),
    },
    notificationMessage: {
        fontSize: scale(13),
        fontFamily: karma.f400,
        color: COLORS.slate600,
        lineHeight: scale(19),
        marginBottom: verticalScale(4),
    },
    notificationTime: {
        fontSize: scale(11),
        fontFamily: karma.f400,
        color: COLORS.slate500,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: verticalScale(80),
        paddingHorizontal: scale(40),
    },
    emptyStateIcon: {
        fontSize: scale(64),
        marginBottom: verticalScale(16),
    },
    emptyStateTitle: {
        fontSize: scale(20),
        fontFamily: karma.f600,
        color: COLORS.gray900,
        marginBottom: verticalScale(8),
    },
    emptyStateText: {
        fontSize: scale(14),
        fontFamily: karma.f400,
        color: COLORS.slate500,
        textAlign: 'center',
        lineHeight: scale(20),
    },
});
