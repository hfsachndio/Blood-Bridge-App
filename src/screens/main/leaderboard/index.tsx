import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { db, collection, query, where, getDocs } from '../../../config/firebase';
import { useUser } from '../../../context/UserContext';

const { width } = Dimensions.get('window');

// ── Award definitions ─────────────────────────────────────────────────────────
const AWARDS = [
    { id: 'first_drop', icon: '🩸', title: 'First Drop', desc: 'Logged your first donation', minRecords: 1, color: '#fee2e2', border: '#fca5a5' },
    { id: 'life_saver', icon: '💉', title: 'Life Saver', desc: '3 confirmed donations', minRecords: 3, color: '#dbeafe', border: '#93c5fd' },
    { id: 'hero', icon: '🦸', title: 'Blood Hero', desc: '5 confirmed donations', minRecords: 5, color: '#fef3c7', border: '#fcd34d' },
    { id: 'champion', icon: '🏆', title: 'Champion', desc: '10 confirmed donations', minRecords: 10, color: '#d1fae5', border: '#6ee7b7' },
    { id: 'legend', icon: '👑', title: 'Legend', desc: '20 confirmed donations', minRecords: 20, color: '#ede9fe', border: '#c4b5fd' },
];

const getEarnedAwards = (confirmedCount: number) =>
    AWARDS.filter(a => confirmedCount >= a.minRecords);

const getNextAward = (confirmedCount: number) =>
    AWARDS.find(a => confirmedCount < a.minRecords) || null;

// ── Points calculation ────────────────────────────────────────────────────────
// 100 pts per donation post, 150 pts per confirmed donation record
const calcPoints = (postCount: number, recordCount: number) =>
    postCount * 100 + recordCount * 150;

const LeaderboardScreen = ({ navigation }: any) => {
    const { profile } = useUser();
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [myConfirmedCount, setMyConfirmedCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'leaderboard' | 'awards'>('leaderboard');

    const fetchLeaderboard = async () => {
        setRefreshing(true);
        try {
            // 1. All users
            const snapshotUsers = await getDocs(query(collection(db, 'users'), where('role', '==', 'user')));

            // 2. All donation posts → 100 pts each
            const snapshotDonations = await getDocs(query(collection(db, 'donations')));
            const postPointsMap: Record<string, number> = {};
            const myDonations: any[] = [];
            snapshotDonations.docs.forEach((d: any) => {
                const data = d.data();
                if (!data.uid) return;
                postPointsMap[data.uid] = (postPointsMap[data.uid] || 0) + 1;
                if (data.uid === profile?.uid && data.createdAt) myDonations.push(data);
            });

            // 3. All confirmed donation records → 150 pts each
            const snapshotRecords = await getDocs(query(collection(db, 'donationRecords')));
            const recordCountMap: Record<string, number> = {};
            snapshotRecords.docs.forEach((d: any) => {
                const data = d.data();
                if (!data.donorUid) return;
                recordCountMap[data.donorUid] = (recordCountMap[data.donorUid] || 0) + 1;
            });

            // My confirmed count for awards
            setMyConfirmedCount(recordCountMap[profile?.uid || ''] || 0);

            // 4. Build leaderboard
            let users = snapshotUsers.docs.map((doc: any) => {
                const data = doc.data();
                const posts = postPointsMap[doc.id] || 0;
                const records = recordCountMap[doc.id] || 0;
                return {
                    id: doc.id,
                    fullName: data.fullName || 'Anonymous Donor',
                    points: calcPoints(posts, records),
                    posts,
                    records,
                    location: data.location || 'Global',
                    bloodType: data.bloodType || '?',
                };
            });
            users.sort((a: any, b: any) => b.points - a.points);
            setLeaderboard(users);

            // 5. Chart — last 6 months activity
            const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const now = new Date();
            const chartMap: Record<string, number> = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                chartMap[monthsNames[d.getMonth()]] = 0;
            }
            myDonations.forEach(d => {
                const date = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
                const mName = monthsNames[date.getMonth()];
                if (chartMap[mName] !== undefined) chartMap[mName] += 35;
            });
            setChartData(Object.keys(chartMap).map(m => ({ month: m, value: Math.min(chartMap[m] || 5, 100) })));

        } catch (err) {
            console.log('Leaderboard fetch error:', err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchLeaderboard(); }, [profile?.uid]);

    const myRank = leaderboard.findIndex(u => u.id === profile?.uid) + 1;
    const myPoints = leaderboard.find(u => u.id === profile?.uid)?.points || 0;
    const earnedAwards = getEarnedAwards(myConfirmedCount);
    const nextAward = getNextAward(myConfirmedCount);
    const topThree = leaderboard.slice(0, 3);
    const restOfList = leaderboard.slice(3);

    const getRankColor = (rank: number) => {
        if (rank === 1) return ['#FDE047', '#EAB308'];
        if (rank === 2) return ['#E2E8F0', '#94A3B8'];
        if (rank === 3) return ['#FED7AA', '#F97316'];
        return [COLORS.red100, COLORS.red600];
    };

    const renderPodiumItem = (user: any, rank: number) => {
        if (!user) return <View style={styles.podiumEmpty} />;
        const heightMultiplier = rank === 1 ? 140 : rank === 2 ? 110 : 80;
        return (
            <Animatable.View animation="fadeInUp" delay={rank * 200} style={styles.podiumCol}>
                <Text style={styles.podiumName} numberOfLines={1}>{user.fullName.split(' ')[0]}</Text>
                <Text style={styles.podiumPoints}>{user.points} pts</Text>
                <LinearGradient colors={getRankColor(rank)} style={[styles.podiumBlock, { height: verticalScale(heightMultiplier) }]}>
                    <Text style={styles.podiumRankText}>{rank}</Text>
                    <Text style={{ fontSize: scale(18), marginTop: verticalScale(5) }}>
                        {rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}
                    </Text>
                </LinearGradient>
            </Animatable.View>
        );
    };

    const renderListItem = ({ item, index }: any) => {
        const actualRank = index + 4;
        const isMe = item.id === profile?.uid;
        const itemAwards = getEarnedAwards(item.records);
        return (
            <Animatable.View animation="fadeInLeft" delay={100 + index * 50}>
                <View style={[styles.listItem, isMe && styles.myListItem]}>
                    <Text style={styles.listRank}>{actualRank}</Text>
                    <View style={styles.listInfo}>
                        <View style={styles.listNameRow}>
                            <Text style={styles.listName}>{item.fullName}</Text>
                            {itemAwards.length > 0 && (
                                <Text style={styles.listAwardIcon}>{itemAwards[itemAwards.length - 1].icon}</Text>
                            )}
                        </View>
                        <Text style={styles.listSub}>{item.bloodType} • {item.location.split(',')[0]}</Text>
                        {item.records > 0 && (
                            <Text style={styles.listRecords}>✓ {item.records} confirmed donation{item.records > 1 ? 's' : ''}</Text>
                        )}
                    </View>
                    <View style={styles.listScoreBox}>
                        <Text style={styles.listScore}>{item.points}</Text>
                        <Text style={styles.listScorePts}>pts</Text>
                    </View>
                </View>
            </Animatable.View>
        );
    };

    // ── Awards tab content ────────────────────────────────────────────────────
    const renderAwardsTab = () => (
        <View style={styles.awardsContainer}>
            {/* My stats */}
            <View style={styles.awardsStatsRow}>
                <View style={styles.awardsStatBox}>
                    <Text style={styles.awardsStatNum}>{myConfirmedCount}</Text>
                    <Text style={styles.awardsStatLabel}>Confirmed Donations</Text>
                </View>
                <View style={styles.awardsStatBox}>
                    <Text style={styles.awardsStatNum}>{earnedAwards.length}</Text>
                    <Text style={styles.awardsStatLabel}>Awards Earned</Text>
                </View>
                <View style={styles.awardsStatBox}>
                    <Text style={styles.awardsStatNum}>#{myRank > 0 ? myRank : '--'}</Text>
                    <Text style={styles.awardsStatLabel}>Global Rank</Text>
                </View>
            </View>

            {/* Next award progress */}
            {nextAward && (
                <View style={styles.nextAwardBox}>
                    <Text style={styles.nextAwardTitle}>Next Award</Text>
                    <View style={styles.nextAwardRow}>
                        <Text style={styles.nextAwardIcon}>{nextAward.icon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.nextAwardName}>{nextAward.title}</Text>
                            <Text style={styles.nextAwardDesc}>{nextAward.desc}</Text>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, {
                                    width: `${Math.min((myConfirmedCount / nextAward.minRecords) * 100, 100)}%`
                                }]} />
                            </View>
                            <Text style={styles.progressText}>
                                {myConfirmedCount} / {nextAward.minRecords} donations
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* All awards */}
            <Text style={styles.allAwardsTitle}>All Awards</Text>
            {AWARDS.map(award => {
                const earned = myConfirmedCount >= award.minRecords;
                return (
                    <View key={award.id} style={[styles.awardCard, earned ? { borderColor: award.border, backgroundColor: award.color } : styles.awardCardLocked]}>
                        <Text style={[styles.awardCardIcon, !earned && styles.awardIconLocked]}>{earned ? award.icon : '🔒'}</Text>
                        <View style={{ flex: 1 }}>
                            <View style={styles.awardCardTitleRow}>
                                <Text style={[styles.awardCardTitle, !earned && styles.awardTextLocked]}>{award.title}</Text>
                                {earned && <View style={styles.earnedBadge}><Text style={styles.earnedBadgeText}>Earned ✓</Text></View>}
                            </View>
                            <Text style={[styles.awardCardDesc, !earned && styles.awardTextLocked]}>{award.desc}</Text>
                        </View>
                    </View>
                );
            })}

            {/* Log donation CTA */}
            <TouchableOpacity
                style={styles.logCta}
                onPress={() => navigation.navigate('LogDonationScreen')}>
                <Text style={styles.logCtaText}>🩸 Log a Donation to Earn Awards</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#b91c1c', '#991b1b']} style={styles.headerGradient}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    <Text style={{ fontSize: scale(20) }}>🏆</Text>
                </View>
                <View style={styles.myStatsCards}>
                    <View style={styles.statCard}>
                        <Text style={{ fontSize: scale(18) }}>🔥</Text>
                        <Text style={styles.statVal}>{myPoints}</Text>
                        <Text style={styles.statLabel}>My Points</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={{ fontSize: scale(18) }}>🏅</Text>
                        <Text style={styles.statVal}>#{myRank > 0 ? myRank : '--'}</Text>
                        <Text style={styles.statLabel}>Global Rank</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={{ fontSize: scale(18) }}>🎖️</Text>
                        <Text style={styles.statVal}>{earnedAwards.length}</Text>
                        <Text style={styles.statLabel}>Awards</Text>
                    </View>
                </View>

                {/* Tab switcher */}
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'leaderboard' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('leaderboard')}>
                        <Text style={[styles.tabBtnText, activeTab === 'leaderboard' && styles.tabBtnTextActive]}>
                            🏆 Rankings
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'awards' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('awards')}>
                        <Text style={[styles.tabBtnText, activeTab === 'awards' && styles.tabBtnTextActive]}>
                            🎖️ My Awards
                        </Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.scrollArea}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchLeaderboard} />}
            >
                {activeTab === 'awards' ? renderAwardsTab() : (
                    <>
                        {/* Activity chart */}
                        <View style={styles.chartSection}>
                            <View style={styles.chartHeader}>
                                <Text style={{ fontSize: scale(18) }}>📈</Text>
                                <Text style={styles.chartTitle}>My Activity Volume</Text>
                            </View>
                            <View style={styles.barChartContainer}>
                                {chartData.map((data, idx) => (
                                    <View key={idx} style={styles.barCol}>
                                        <View style={styles.barSlot}>
                                            <Animatable.View
                                                animation="slideInUp"
                                                delay={300 + idx * 100}
                                                style={[styles.barFill, { height: `${data.value}%` }]}>
                                                <LinearGradient colors={['#ef4444', '#b91c1c']} style={StyleSheet.absoluteFillObject} />
                                            </Animatable.View>
                                        </View>
                                        <Text style={styles.barLabel}>{data.month}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Points legend */}
                        <View style={styles.legendBox}>
                            <Text style={styles.legendTitle}>How points are calculated</Text>
                            <Text style={styles.legendItem}>🩸 Donation post = 100 pts</Text>
                            <Text style={styles.legendItem}>✅ Confirmed donation record = 150 pts</Text>
                        </View>

                        {/* Podium */}
                        <Text style={styles.sectionTitle}>Top Donors</Text>
                        {leaderboard.length >= 3 && topThree[0]?.points > 0 ? (
                            <View style={styles.podiumContainer}>
                                {renderPodiumItem(topThree[1], 2)}
                                {renderPodiumItem(topThree[0], 1)}
                                {renderPodiumItem(topThree[2], 3)}
                            </View>
                        ) : (
                            <Text style={[styles.emptyText, { marginBottom: 20 }]}>Post a donation to climb to the top!</Text>
                        )}

                        {/* Roster */}
                        <View style={styles.listContainer}>
                            <FlatList
                                data={restOfList}
                                renderItem={renderListItem}
                                keyExtractor={item => item.id}
                                scrollEnabled={false}
                                ListEmptyComponent={<Text style={styles.emptyText}>Keep donating to populate the roster!</Text>}
                            />
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default LeaderboardScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerGradient: { paddingHorizontal: scale(20), paddingTop: verticalScale(10), paddingBottom: verticalScale(16), borderBottomLeftRadius: scale(25), borderBottomRightRadius: scale(25) },
    headerTitle: { fontSize: scale(24), fontFamily: karma.f700, color: COLORS.white },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: verticalScale(16) },
    myStatsCards: { flexDirection: 'row', justifyContent: 'center', gap: scale(10), marginBottom: verticalScale(16) },
    statCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: scale(12), padding: scale(12), flex: 1, alignItems: 'center' },
    statVal: { fontSize: scale(18), fontFamily: karma.f700, color: COLORS.white, marginTop: verticalScale(4) },
    statLabel: { fontSize: scale(10), color: 'rgba(255,255,255,0.8)', marginTop: verticalScale(2), textAlign: 'center' },
    // Tabs
    tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: scale(10), padding: scale(3), gap: scale(4) },
    tabBtn: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center', borderRadius: scale(8) },
    tabBtnActive: { backgroundColor: COLORS.white },
    tabBtnText: { fontSize: scale(13), fontFamily: karma.f500, color: 'rgba(255,255,255,0.8)' },
    tabBtnTextActive: { color: '#b91c1c', fontFamily: karma.f700 },
    scrollArea: { paddingHorizontal: scale(16), paddingBottom: verticalScale(100), paddingTop: verticalScale(20) },
    // Chart
    chartSection: { backgroundColor: COLORS.white, borderRadius: scale(15), padding: scale(16), elevation: 2, marginBottom: verticalScale(16) },
    chartHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: verticalScale(16) },
    chartTitle: { fontSize: scale(15), fontFamily: karma.f700, color: COLORS.gray900 },
    barChartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: verticalScale(130), paddingHorizontal: scale(5) },
    barCol: { alignItems: 'center', width: scale(35) },
    barSlot: { height: verticalScale(100), width: scale(20), backgroundColor: '#f1f5f9', borderRadius: scale(10), overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderTopLeftRadius: scale(10), borderTopRightRadius: scale(10) },
    barLabel: { marginTop: verticalScale(6), fontSize: scale(10), color: '#94a3b8' },
    // Legend
    legendBox: { backgroundColor: COLORS.white, borderRadius: scale(12), padding: scale(14), marginBottom: verticalScale(16), borderWidth: 1, borderColor: COLORS.gray300 },
    legendTitle: { fontSize: scale(12), fontFamily: karma.f600, color: COLORS.gray700, marginBottom: verticalScale(6) },
    legendItem: { fontSize: scale(12), color: COLORS.slate600, marginBottom: verticalScale(3) },
    sectionTitle: { fontSize: scale(17), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(14), marginLeft: scale(4) },
    // Podium
    podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', height: verticalScale(200), marginBottom: verticalScale(24), gap: scale(10) },
    podiumCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    podiumName: { fontSize: scale(12), color: COLORS.gray700, fontFamily: karma.f600, marginBottom: verticalScale(2) },
    podiumPoints: { fontSize: scale(11), color: COLORS.red600, marginBottom: verticalScale(6), fontWeight: 'bold' },
    podiumBlock: { width: '100%', borderTopLeftRadius: scale(15), borderTopRightRadius: scale(15), alignItems: 'center', paddingTop: verticalScale(10), elevation: 4 },
    podiumRankText: { fontSize: scale(22), fontFamily: karma.f700, color: '#FFF' },
    podiumEmpty: { flex: 1 },
    // List
    listContainer: { backgroundColor: COLORS.white, borderRadius: scale(15), overflow: 'hidden', elevation: 2, marginBottom: verticalScale(16) },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: scale(14), borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    myListItem: { backgroundColor: '#fef2f2' },
    listRank: { width: scale(28), fontSize: scale(15), fontFamily: karma.f700, color: '#94a3b8' },
    listInfo: { flex: 1, marginLeft: scale(8) },
    listNameRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    listName: { fontSize: scale(14), fontFamily: karma.f600, color: COLORS.gray900 },
    listAwardIcon: { fontSize: scale(14) },
    listSub: { fontSize: scale(11), color: COLORS.slate500, marginTop: verticalScale(1) },
    listRecords: { fontSize: scale(10), color: '#16a34a', fontFamily: karma.f500, marginTop: verticalScale(2) },
    listScoreBox: { alignItems: 'flex-end' },
    listScore: { fontSize: scale(15), fontFamily: karma.f700, color: COLORS.red600 },
    listScorePts: { fontSize: scale(10), color: COLORS.slate500 },
    emptyText: { textAlign: 'center', padding: scale(20), color: '#94a3b8' },
    // Awards tab
    awardsContainer: { paddingBottom: verticalScale(20) },
    awardsStatsRow: { flexDirection: 'row', gap: scale(10), marginBottom: verticalScale(16) },
    awardsStatBox: { flex: 1, backgroundColor: COLORS.white, borderRadius: scale(12), padding: scale(14), alignItems: 'center', elevation: 1 },
    awardsStatNum: { fontSize: scale(22), fontFamily: karma.f700, color: COLORS.red600 },
    awardsStatLabel: { fontSize: scale(10), color: COLORS.slate500, textAlign: 'center', marginTop: verticalScale(2) },
    nextAwardBox: { backgroundColor: COLORS.white, borderRadius: scale(14), padding: scale(16), marginBottom: verticalScale(20), elevation: 2, borderWidth: 1, borderColor: '#fcd34d' },
    nextAwardTitle: { fontSize: scale(12), fontFamily: karma.f600, color: COLORS.slate500, marginBottom: verticalScale(10), textTransform: 'uppercase', letterSpacing: 0.5 },
    nextAwardRow: { flexDirection: 'row', alignItems: 'center', gap: scale(14) },
    nextAwardIcon: { fontSize: scale(36) },
    nextAwardName: { fontSize: scale(15), fontFamily: karma.f700, color: COLORS.gray900 },
    nextAwardDesc: { fontSize: scale(12), color: COLORS.slate500, marginBottom: verticalScale(8) },
    progressBar: { height: verticalScale(8), backgroundColor: '#f1f5f9', borderRadius: scale(4), overflow: 'hidden', marginBottom: verticalScale(4) },
    progressFill: { height: '100%', backgroundColor: COLORS.red600, borderRadius: scale(4) },
    progressText: { fontSize: scale(11), color: COLORS.slate500 },
    allAwardsTitle: { fontSize: scale(16), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(12) },
    awardCard: { flexDirection: 'row', alignItems: 'center', gap: scale(14), borderRadius: scale(12), padding: scale(14), marginBottom: verticalScale(10), borderWidth: 1.5, elevation: 1 },
    awardCardLocked: { backgroundColor: '#f8fafc', borderColor: COLORS.gray300 },
    awardCardIcon: { fontSize: scale(32) },
    awardIconLocked: { opacity: 0.4 },
    awardCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: verticalScale(2) },
    awardCardTitle: { fontSize: scale(14), fontFamily: karma.f700, color: COLORS.gray900 },
    awardTextLocked: { color: COLORS.slate400 },
    awardCardDesc: { fontSize: scale(12), color: COLORS.slate600 },
    earnedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: scale(8), paddingVertical: verticalScale(2), borderRadius: scale(10) },
    earnedBadgeText: { fontSize: scale(10), color: '#15803d', fontFamily: karma.f600 },
    logCta: { backgroundColor: COLORS.red600, borderRadius: scale(12), padding: scale(16), alignItems: 'center', marginTop: verticalScale(8) },
    logCtaText: { color: COLORS.white, fontSize: scale(14), fontFamily: karma.f700 },
});
