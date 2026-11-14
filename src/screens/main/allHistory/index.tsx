import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    RefreshControl,
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../utils/color';
import { karma } from '../../../assets/fonts/fonts';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { images } from '../../../assets/png/images';
import { getAuth, getDonationsCollection, getRequestsCollection, getDocs, deleteDoc, doc, query, where, db, collection, orderBy } from '../../../config/firebase';
import { DonationHistoryItem } from '../../../components/DonationHistory';

const formatTimeAgo = (date: Date | null) => {
    if (!date) return '—';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return date.toDateString();
};

const priorityColor = (p?: string) => {
    if (p === 'critical') return '#dc2626';
    if (p === 'urgent') return '#ea580c';
    return '#2563eb';
};

const AllHistoryScreen = ({ navigation, route }: any) => {
    const initialTab: 'donation' | 'sos' | 'records' = route?.params?.tab || 'donation';
    const [activeTab, setActiveTab] = useState<'donation' | 'sos' | 'records'>(initialTab);
    const [donations, setDonations] = useState<DonationHistoryItem[]>([]);
    const [sosRequests, setSosRequests] = useState<DonationHistoryItem[]>([]);
    const [donationRecords, setDonationRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    // ─── Load data ─────────────────────────────────────────────────────────────
    const loadData = useCallback(async (isRefresh = false) => {
        const user = getAuth().currentUser;
        if (!user) return;

        isRefresh ? setRefreshing(true) : setLoading(true);

        try {
            // Donation posts — no orderBy to avoid composite index requirement
            const donSnap = await getDocs(query(getDonationsCollection(), where('uid', '==', user.uid)));

            console.log('[AllHistory] donation docs found:', donSnap.docs.length);

            const donItems: DonationHistoryItem[] = donSnap.docs
                .map((d: any) => {
                    const data = d.data() as any;
                    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
                    return {
                        id: d.id,
                        type: 'donation' as const,
                        date: formatTimeAgo(createdAt),
                        hospital: data.hospital || data.location || 'Donation Post',
                        location: data.location,
                        bloodType: data.bloodType,
                        status: data.status || 'active',
                        _ts: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
                    };
                })
                .sort((a: any, b: any) => b._ts - a._ts);
            setDonations(donItems);

            // SOS / urgent requests — no orderBy to avoid composite index requirement
            const sosSnap = await getDocs(query(getRequestsCollection(), where('uid', '==', user.uid)));

            console.log('[AllHistory] SOS docs found:', sosSnap.docs.length);

            const sosItems: DonationHistoryItem[] = sosSnap.docs
                .map((d: any) => {
                    const data = d.data() as any;
                    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
                    return {
                        id: d.id,
                        type: 'sos' as const,
                        date: formatTimeAgo(createdAt),
                        hospital: data.hospital,
                        location: data.location || 'SOS Request',
                        bloodType: data.bloodType,
                        status: data.status || 'open',
                        priority: data.priority,
                        unitsNeeded: data.unitsNeeded,
                        _ts: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
                    };
                })
                .sort((a: any, b: any) => b._ts - a._ts);
            setSosRequests(sosItems);

            // ── Donation Records (confirmed donations) ─────────────────────
            const recSnap = await getDocs(
                query(collection(db, 'donationRecords'), where('donorUid', '==', user.uid))
            );
            const recItems = recSnap.docs
                .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
                .sort((a: any, b: any) => {
                    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return tb - ta;
                });
            setDonationRecords(recItems);
        } catch (e: any) {
            console.log('[AllHistoryScreen] load error:', e?.message || e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData(false);
    }, [loadData]);

    // ─── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = (item: DonationHistoryItem) => {
        Alert.alert(
            item.type === 'sos' ? 'Close SOS Request' : 'Close Donation Post',
            'This will permanently delete this post. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(item.id);
                        try {
                            if (item.type === 'sos') {
                                await deleteDoc(doc(db, 'requests', item.id));
                                setSosRequests(prev => prev.filter(r => r.id !== item.id));
                            } else {
                                await deleteDoc(doc(db, 'donations', item.id));
                                setDonations(prev => prev.filter(r => r.id !== item.id));
                            }
                        } catch (e) {
                            Alert.alert('Error', 'Failed to delete. Please try again.');
                        } finally {
                            setDeleting(null);
                        }
                    },
                },
            ],
        );
    };

    const activeList = activeTab === 'donation' ? donations : activeTab === 'sos' ? sosRequests : donationRecords;
    const isSOS = activeTab === 'sos';
    const isRecords = activeTab === 'records';

    // ─── Render item ───────────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: any }) => {
        if (deleting === item.id) {
            return (
                <View style={styles.deletingRow}>
                    <ActivityIndicator size="small" color={COLORS.red600} />
                    <Text style={styles.deletingText}>Deleting...</Text>
                </View>
            );
        }

        // ── Confirmed donation record card ──────────────────────────────────
        if (isRecords) {
            return (
                <TouchableOpacity
                    style={styles.recordCard}
                    onPress={() => navigation.navigate('DonationCertificateScreen', {
                        record: item,
                        totalRecords: donationRecords.length,
                    })}
                    activeOpacity={0.8}>
                    <View style={styles.recordLeft}>
                        <View style={styles.recordIconBox}>
                            <Text style={styles.recordIcon}>🩸</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.recordTopRow}>
                                <Text style={styles.recordTitle}>{item.hospital || item.location || 'Blood Donation'}</Text>
                                <View style={styles.bloodBadgeGreen}>
                                    <Text style={styles.bloodBadgeText}>{item.bloodType}</Text>
                                </View>
                            </View>
                            <Text style={styles.recordDate}>{item.donationDate}</Text>
                            <Text style={styles.recordCode}>Code: {item.confirmationCode}</Text>
                            <View style={styles.recordTagRow}>
                                <View style={styles.confirmedTag}>
                                    <Text style={styles.confirmedTagText}>✓ Confirmed • {item.units} unit{item.units > 1 ? 's' : ''}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.recordArrow}>›</Text>
                </TouchableOpacity>
            );
        }

        const isSosItem = item.type === 'sos';

        return (
            <View style={[styles.card, isSosItem && styles.cardSOS]}>
                {/* Left stripe */}
                <View style={[styles.stripe, { backgroundColor: isSosItem ? '#ea580c' : COLORS.red600 }]} />

                {/* Icon */}
                <View style={[styles.iconBox, isSosItem && styles.iconBoxSOS]}>
                    <Image
                        source={isSosItem ? images.heartfill : images.dropleticon}
                        style={styles.icon}
                        tintColor={isSosItem ? '#ea580c' : COLORS.red600}
                        resizeMode="contain"
                    />
                </View>

                {/* Details */}
                <View style={{ flex: 1 }}>
                    <View style={styles.topRow}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.hospital || item.location || (isSosItem ? 'SOS Request' : 'Donation Post')}
                        </Text>
                        {item.bloodType ? (
                            <View style={[styles.bloodBadge, isSosItem && { backgroundColor: '#ea580c' }]}>
                                <Text style={styles.bloodText}>{item.bloodType}</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={styles.dateText}>{item.date}</Text>

                    <View style={styles.tagsRow}>
                        {isSosItem && item.priority ? (
                            <View style={[
                                styles.priorityTag,
                                { backgroundColor: priorityColor(item.priority) + '22', borderColor: priorityColor(item.priority) },
                            ]}>
                                <Text style={[styles.priorityText, { color: priorityColor(item.priority) }]}>
                                    {item.priority?.toUpperCase()}
                                </Text>
                            </View>
                        ) : (
                            <View style={[
                                styles.statusTag,
                                item.status === 'active' ? styles.statusActive : styles.statusClosed,
                            ]}>
                                <Text style={[
                                    styles.statusText,
                                    item.status === 'active' ? styles.statusActiveText : styles.statusClosedText,
                                ]}>
                                    {item.status === 'active' ? '● Active' : '✓ Closed'}
                                </Text>
                            </View>
                        )}

                        {isSosItem && item.unitsNeeded ? (
                            <Text style={styles.unitsText}>• {item.unitsNeeded} units needed</Text>
                        ) : null}
                    </View>
                </View>

                {/* Delete button */}
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>✕ Close</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]} >
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Image
                        source={images.backarrow}
                        resizeMode="contain"
                        tintColor={COLORS.black}
                        style={{ width: scale(28), height: verticalScale(28) }}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Activity</Text>
                <View style={{ width: scale(36) }} />
            </View>

            {/* Summary bar */}
            <View style={styles.summaryBar}>
                <View style={styles.sumChip}>
                    <Text style={styles.sumCount}>{donations.length}</Text>
                    <Text style={styles.sumLabel}>Donation Posts</Text>
                </View>
                <View style={styles.sumDivider} />
                <View style={styles.sumChip}>
                    <Text style={[styles.sumCount, { color: '#ea580c' }]}>{sosRequests.length}</Text>
                    <Text style={styles.sumLabel}>SOS Requests</Text>
                </View>
                <View style={styles.sumDivider} />
                <View style={styles.sumChip}>
                    <Text style={[styles.sumCount, { color: '#16a34a' }]}>{donationRecords.length}</Text>
                    <Text style={styles.sumLabel}>Confirmed</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'donation' && styles.tabActive]}
                    onPress={() => setActiveTab('donation')}>
                    <Text style={[styles.tabText, activeTab === 'donation' && styles.tabActiveText]}>
                        🩸 Posts ({donations.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'sos' && styles.tabActiveSOS]}
                    onPress={() => setActiveTab('sos')}>
                    <Text style={[styles.tabText, activeTab === 'sos' && styles.tabActiveText]}>
                        🚨 SOS ({sosRequests.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'records' && styles.tabActiveRecords]}
                    onPress={() => setActiveTab('records')}>
                    <Text style={[styles.tabText, activeTab === 'records' && styles.tabActiveText]}>
                        ✅ Records ({donationRecords.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Log Donation button */}
            <TouchableOpacity
                style={styles.logBtn}
                onPress={() => navigation.navigate('LogDonationScreen')}>
                <Text style={styles.logBtnText}>+ Log a Completed Donation</Text>
            </TouchableOpacity>

            {/* List */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.red600} />
                    <Text style={styles.loadingText}>Loading your activity...</Text>
                </View>
            ) : (
                <FlatList
                    data={activeList}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadData(true)}
                            colors={[COLORS.red600]}
                            tintColor={COLORS.red600}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyEmoji}>{isRecords ? '📋' : isSOS ? '🚨' : '🩸'}</Text>
                            <Text style={styles.emptyTitle}>
                                {isRecords ? 'No donation records yet.' : isSOS ? 'No SOS requests yet.' : 'No donation posts yet.'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {isRecords
                                    ? 'Tap "+ Log a Completed Donation" above to record a donation and get your certificate.'
                                    : isSOS
                                        ? 'When you create an SOS/urgent request, it will appear here.'
                                        : 'When you post a donation, it will appear here.'}
                            </Text>
                            {isRecords && (
                                <TouchableOpacity
                                    style={styles.logEmptyBtn}
                                    onPress={() => navigation.navigate('LogDonationScreen')}>
                                    <Text style={styles.logEmptyBtnText}>+ Log a Donation</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </View>
    );
};

export default AllHistoryScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        paddingHorizontal: scale(14),
        paddingVertical: verticalScale(12),
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray300,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    backBtn: { padding: scale(4) },
    headerTitle: {
        fontSize: scale(17),
        fontFamily: karma.f700,
        color: COLORS.gray900,
    },
    // Summary bar
    summaryBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        margin: scale(14),
        marginBottom: 0,
        borderRadius: scale(12),
        padding: scale(14),
        alignItems: 'center',
        elevation: 1,
    },
    sumChip: { flex: 1, alignItems: 'center' },
    sumDivider: { width: 1, height: verticalScale(32), backgroundColor: COLORS.gray300 },
    sumCount: {
        fontSize: scale(24),
        fontFamily: karma.f700,
        color: COLORS.red600,
    },
    sumLabel: {
        fontSize: scale(11),
        fontFamily: karma.f400,
        color: COLORS.slate500,
        marginTop: verticalScale(2),
    },
    // Tabs
    tabRow: {
        flexDirection: 'row',
        margin: scale(14),
        marginBottom: scale(8),
        backgroundColor: COLORS.white,
        borderRadius: scale(10),
        padding: scale(4),
        gap: scale(4),
        elevation: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: verticalScale(9),
        alignItems: 'center',
        borderRadius: scale(8),
    },
    tabActive: { backgroundColor: COLORS.red600 },
    tabActiveSOS: { backgroundColor: '#ea580c' },
    tabActiveRecords: { backgroundColor: '#16a34a' },
    tabText: {
        fontSize: scale(13),
        fontFamily: karma.f500,
        color: COLORS.gray700,
    },
    tabActiveText: {
        color: COLORS.white,
        fontFamily: karma.f700,
    },
    // List
    listContent: {
        padding: scale(14),
        paddingTop: scale(6),
        paddingBottom: verticalScale(40),
    },
    // Card
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.white,
        borderRadius: scale(12),
        marginBottom: verticalScale(10),
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        padding: scale(10),
        gap: scale(10),
    },
    cardSOS: {
        backgroundColor: '#fff7f7',
    },
    stripe: {
        width: scale(4),
        borderRadius: scale(2),
        alignSelf: 'stretch',
        minHeight: verticalScale(40),
    },
    iconBox: {
        backgroundColor: COLORS.red100,
        width: scale(36),
        height: verticalScale(36),
        borderRadius: scale(8),
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconBoxSOS: { backgroundColor: '#ffedd5' },
    icon: { width: scale(18), height: verticalScale(18) },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(2),
    },
    itemTitle: {
        fontSize: scale(13),
        fontFamily: karma.f600,
        color: COLORS.gray900,
        flex: 1,
        marginRight: scale(6),
    },
    bloodBadge: {
        backgroundColor: COLORS.red600,
        borderRadius: scale(4),
        paddingHorizontal: scale(6),
        paddingVertical: verticalScale(1),
    },
    bloodText: {
        color: COLORS.white,
        fontSize: scale(10),
        fontFamily: karma.f700,
    },
    dateText: {
        fontSize: scale(11),
        fontFamily: karma.f400,
        color: COLORS.slate500,
        marginBottom: verticalScale(4),
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
    },
    priorityTag: {
        borderWidth: 1,
        borderRadius: scale(4),
        paddingHorizontal: scale(6),
        paddingVertical: verticalScale(1),
    },
    priorityText: {
        fontSize: scale(10),
        fontFamily: karma.f700,
    },
    statusTag: {
        borderWidth: 1,
        borderRadius: scale(4),
        paddingHorizontal: scale(6),
        paddingVertical: verticalScale(1),
    },
    statusActive: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
    statusClosed: { backgroundColor: COLORS.gray300 + '55', borderColor: COLORS.gray300 },
    statusText: { fontSize: scale(10), fontFamily: karma.f600 },
    statusActiveText: { color: '#15803d' },
    statusClosedText: { color: COLORS.slate500 },
    unitsText: {
        fontSize: scale(11),
        fontFamily: karma.f400,
        color: COLORS.gray700,
    },
    // Delete btn
    deleteBtn: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: scale(6),
        paddingHorizontal: scale(8),
        paddingVertical: verticalScale(5),
        alignSelf: 'center',
    },
    deleteBtnText: {
        fontSize: scale(11),
        fontFamily: karma.f600,
        color: COLORS.red600,
    },
    deletingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        padding: scale(14),
        marginBottom: verticalScale(8),
        backgroundColor: COLORS.white,
        borderRadius: scale(12),
    },
    deletingText: {
        fontSize: scale(13),
        fontFamily: karma.f400,
        color: COLORS.slate500,
    },
    // Loading / empty
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: verticalScale(10),
    },
    loadingText: {
        fontSize: scale(13),
        fontFamily: karma.f400,
        color: COLORS.slate500,
    },
    emptyBox: {
        paddingTop: verticalScale(60),
        alignItems: 'center',
        paddingHorizontal: scale(32),
        gap: verticalScale(8),
    },
    emptyEmoji: { fontSize: scale(44) },
    emptyTitle: {
        fontSize: scale(16),
        fontFamily: karma.f600,
        color: COLORS.gray900,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: scale(13),
        fontFamily: karma.f400,
        color: COLORS.slate500,
        textAlign: 'center',
        lineHeight: verticalScale(20),
    },
    logBtn: { marginHorizontal: scale(14), marginBottom: scale(8), backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#22c55e', borderRadius: scale(8), paddingVertical: verticalScale(10), alignItems: 'center' },
    logBtnText: { fontSize: scale(13), fontFamily: karma.f600, color: '#15803d' },
    logEmptyBtn: { marginTop: verticalScale(12), backgroundColor: COLORS.red600, paddingHorizontal: scale(20), paddingVertical: verticalScale(10), borderRadius: scale(8) },
    logEmptyBtnText: { color: COLORS.white, fontFamily: karma.f600, fontSize: scale(13) },
    // Record card
    recordCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: scale(12), marginBottom: verticalScale(10), padding: scale(12), elevation: 1, borderWidth: 1, borderColor: '#bbf7d0' },
    recordLeft: { flex: 1, flexDirection: 'row', gap: scale(10), alignItems: 'flex-start' },
    recordIconBox: { width: scale(40), height: scale(40), borderRadius: scale(10), backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
    recordIcon: { fontSize: scale(20) },
    recordTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(2) },
    recordTitle: { fontSize: scale(13), fontFamily: karma.f600, color: COLORS.gray900, flex: 1, marginRight: scale(6) },
    bloodBadgeGreen: { backgroundColor: '#16a34a', borderRadius: scale(4), paddingHorizontal: scale(6), paddingVertical: verticalScale(1) },
    bloodBadgeText: { color: COLORS.white, fontSize: scale(10), fontFamily: karma.f700 },
    recordDate: { fontSize: scale(11), color: COLORS.slate500, marginBottom: verticalScale(2) },
    recordCode: { fontSize: scale(11), color: COLORS.slate400, fontFamily: karma.f400, marginBottom: verticalScale(4) },
    recordTagRow: { flexDirection: 'row' },
    confirmedTag: { backgroundColor: '#dcfce7', borderRadius: scale(4), paddingHorizontal: scale(6), paddingVertical: verticalScale(1), borderWidth: 1, borderColor: '#22c55e' },
    confirmedTagText: { fontSize: scale(10), color: '#15803d', fontFamily: karma.f600 },
    recordArrow: { fontSize: scale(20), color: COLORS.slate400, paddingLeft: scale(8) },
});
