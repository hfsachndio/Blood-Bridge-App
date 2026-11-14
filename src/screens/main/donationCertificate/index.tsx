import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, Share, Alert, Animated, Clipboard, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';

const { width } = Dimensions.get('window');

interface DonationRecord {
    id: string;
    donorName: string;
    bloodType: string;
    hospital: string;
    location: string;
    units: number;
    recipientName?: string | null;
    donationDate: string;
    confirmationCode: string;
}

// ── Award definitions (same as leaderboard) ───────────────────────────────────
const AWARDS = [
    { id: 'first_drop', icon: '🩸', title: 'First Drop', minRecords: 1 },
    { id: 'life_saver', icon: '💉', title: 'Life Saver', minRecords: 3 },
    { id: 'hero', icon: '🦸', title: 'Blood Hero', minRecords: 5 },
    { id: 'champion', icon: '🏆', title: 'Champion', minRecords: 10 },
    { id: 'legend', icon: '👑', title: 'Legend', minRecords: 20 },
];

// ── Pulsing blood drop ────────────────────────────────────────────────────────
const PulsingDrop = () => {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            ])
        ).start();
    }, []);
    return (
        <Animated.Text style={[styles.dropEmoji, { transform: [{ scale: pulse }] }]}>🩸</Animated.Text>
    );
};

// ── Tap-to-copy code box ──────────────────────────────────────────────────────
const CopyableCode = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handleCopy = () => {
        Clipboard.setString(code);
        setCopied(true);
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1.05, duration: 120, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TouchableOpacity onPress={handleCopy} activeOpacity={0.8}>
            <Animated.View style={[styles.codeBox, copied && styles.codeBoxCopied, { transform: [{ scale: scaleAnim }] }]}>
                <Text style={styles.codeLabel}>CONFIRMATION CODE</Text>
                <Text style={[styles.codeValue, copied && styles.codeValueCopied]}>{code}</Text>
                <Text style={styles.codeTap}>{copied ? '✓ Copied to clipboard!' : 'Tap to copy'}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

// ── Detail row ────────────────────────────────────────────────────────────────
const DetailRow = ({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) => (
    <View style={detailStyles.row}>
        <Text style={detailStyles.icon}>{icon}</Text>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={[detailStyles.value, highlight && detailStyles.highlight]}>{value}</Text>
    </View>
);

// ── Lives saved counter (animated) ───────────────────────────────────────────
const LivesSavedCounter = ({ units }: { units: number }) => {
    const lives = units * 3;
    const countAnim = useRef(new Animated.Value(0)).current;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        Animated.timing(countAnim, { toValue: lives, duration: 1500, useNativeDriver: false }).start();
        countAnim.addListener(({ value }) => setDisplay(Math.floor(value)));
        return () => countAnim.removeAllListeners();
    }, []);

    return (
        <Animatable.View animation="fadeInUp" delay={600} style={styles.livesCard}>
            <LinearGradient colors={['#dc2626', '#991b1b']} style={styles.livesGradient}>
                <Text style={styles.livesEmoji}>❤️</Text>
                <Text style={styles.livesCount}>{display}</Text>
                <Text style={styles.livesLabel}>Lives You Could Save</Text>
                <Text style={styles.livesNote}>1 donation = up to 3 lives</Text>
            </LinearGradient>
        </Animatable.View>
    );
};

// ── Main screen ───────────────────────────────────────────────────────────────
const DonationCertificateScreen = ({ navigation, route }: any) => {
    const record: DonationRecord = route?.params?.record;
    const totalRecords: number = route?.params?.totalRecords || 1;

    if (!record) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>No record found.</Text>
            </SafeAreaView>
        );
    }

    const earnedAwards = AWARDS.filter(a => totalRecords >= a.minRecords);
    const latestAward = earnedAwards[earnedAwards.length - 1];

    const handleShare = async () => {
        try {
            await Share.share({
                message:
                    `🩸 Blood Donation Certificate\n\n` +
                    `Donor: ${record.donorName}\n` +
                    `Blood Type: ${record.bloodType}\n` +
                    `Units: ${record.units}\n` +
                    `Hospital: ${record.hospital || record.location}\n` +
                    `Date: ${record.donationDate}\n` +
                    `Confirmation Code: ${record.confirmationCode}\n\n` +
                    `Verified by BloodBridge 🏥\nhttps://bloodbridge.app`,
                title: 'My Blood Donation Certificate',
            });
        } catch (_) {}
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#991b1b" barStyle="light-content" />

            {/* Header */}
            <LinearGradient colors={['#b91c1c', '#7f1d1d']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Certificate</Text>
                <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                    <Text style={styles.shareText}>↑ Share</Text>
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}>

                {/* ── Certificate card ── */}
                <Animatable.View animation="fadeInDown" duration={600} style={styles.certificate}>
                    {/* Banner */}
                    <LinearGradient colors={['#dc2626', '#7f1d1d']} style={styles.certBanner}>
                        <PulsingDrop />
                        <Text style={styles.certTitle}>Certificate of Donation</Text>
                        <Text style={styles.certSubtitle}>BloodBridge Verified</Text>

                        {/* Award badge if earned */}
                        {latestAward && (
                            <Animatable.View animation="bounceIn" delay={400} style={styles.awardBadge}>
                                <Text style={styles.awardBadgeIcon}>{latestAward.icon}</Text>
                                <Text style={styles.awardBadgeTitle}>{latestAward.title}</Text>
                            </Animatable.View>
                        )}
                    </LinearGradient>

                    {/* Donor name hero */}
                    <Animatable.View animation="fadeIn" delay={300} style={styles.donorHero}>
                        <Text style={styles.donorHeroLabel}>This certifies that</Text>
                        <Text style={styles.donorHeroName}>{record.donorName}</Text>
                        <Text style={styles.donorHeroLabel}>has successfully donated blood</Text>
                    </Animatable.View>

                    {/* Copyable confirmation code */}
                    <Animatable.View animation="fadeInUp" delay={400}>
                        <CopyableCode code={record.confirmationCode} />
                    </Animatable.View>

                    {/* Dashed divider */}
                    <View style={styles.dashedDivider}>
                        {Array.from({ length: 30 }).map((_, i) => (
                            <View key={i} style={styles.dash} />
                        ))}
                    </View>

                    {/* Details */}
                    <Animatable.View animation="fadeInUp" delay={500} style={styles.detailsGrid}>
                        <DetailRow icon="🩸" label="Blood Type" value={record.bloodType} highlight />
                        <DetailRow icon="💉" label="Units Donated" value={`${record.units} unit${record.units > 1 ? 's' : ''}`} />
                        <DetailRow icon="🏥" label="Hospital" value={record.hospital || '—'} />
                        <DetailRow icon="📍" label="Location" value={record.location || '—'} />
                        <DetailRow icon="📅" label="Date" value={record.donationDate} />
                        {record.recipientName
                            ? <DetailRow icon="🤝" label="Recipient" value={record.recipientName} />
                            : null}
                    </Animatable.View>

                    {/* Dashed divider */}
                    <View style={styles.dashedDivider}>
                        {Array.from({ length: 30 }).map((_, i) => (
                            <View key={i} style={styles.dash} />
                        ))}
                    </View>

                    {/* Footer seal */}
                    <Animatable.View animation="fadeIn" delay={700} style={styles.certFooter}>
                        <View style={styles.sealCircle}>
                            <Text style={styles.sealEmoji}>🏥</Text>
                        </View>
                        <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedText}>✓ Verified by BloodBridge</Text>
                        </View>
                        <Text style={styles.footerNote}>
                            This certificate is digitally issued and stored in the BloodBridge system.
                        </Text>
                    </Animatable.View>
                </Animatable.View>

                {/* ── Lives saved counter ── */}
                <LivesSavedCounter units={record.units} />

                {/* ── Awards earned ── */}
                {earnedAwards.length > 0 && (
                    <Animatable.View animation="fadeInUp" delay={800} style={styles.awardsSection}>
                        <Text style={styles.awardsSectionTitle}>🎖️ Your Awards</Text>
                        <View style={styles.awardsRow}>
                            {earnedAwards.map((award, i) => (
                                <Animatable.View
                                    key={award.id}
                                    animation="bounceIn"
                                    delay={900 + i * 100}
                                    style={styles.awardChip}>
                                    <Text style={styles.awardChipIcon}>{award.icon}</Text>
                                    <Text style={styles.awardChipTitle}>{award.title}</Text>
                                </Animatable.View>
                            ))}
                        </View>
                    </Animatable.View>
                )}

                {/* ── Action buttons ── */}
                <Animatable.View animation="fadeInUp" delay={900} style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleShare}>
                        <Text style={styles.actionBtnPrimaryText}>↑ Share Certificate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtnSecondary}
                        onPress={() => navigation.navigate('AllHistoryScreen', { tab: 'records' })}>
                        <Text style={styles.actionBtnSecondaryText}>📋 View All Records</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtnSecondary}
                        onPress={() => navigation.navigate('LogDonationScreen')}>
                        <Text style={styles.actionBtnSecondaryText}>🩸 Log Another Donation</Text>
                    </TouchableOpacity>
                </Animatable.View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default DonationCertificateScreen;

const detailStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(10), borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    icon: { fontSize: scale(16), width: scale(28) },
    label: { flex: 1, fontSize: scale(13), color: COLORS.slate600, fontFamily: karma.f400 },
    value: { fontSize: scale(13), color: COLORS.gray900, fontFamily: karma.f600, textAlign: 'right' },
    highlight: { color: COLORS.red600, fontSize: scale(16), fontFamily: karma.f700 },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    errorText: { textAlign: 'center', marginTop: verticalScale(40), color: COLORS.slate500 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: verticalScale(14) },
    backBtn: { padding: scale(6) },
    backText: { fontSize: scale(20), color: COLORS.white, fontFamily: karma.f700 },
    headerTitle: { fontSize: scale(17), fontFamily: karma.f700, color: COLORS.white },
    shareBtn: { paddingHorizontal: scale(12), paddingVertical: verticalScale(6), backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: scale(8) },
    shareText: { fontSize: scale(13), color: COLORS.white, fontFamily: karma.f600 },
    scroll: { padding: scale(16), paddingBottom: verticalScale(60) },

    // Certificate
    certificate: { backgroundColor: COLORS.white, borderRadius: scale(20), overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, marginBottom: verticalScale(16) },
    certBanner: { alignItems: 'center', paddingVertical: verticalScale(28), paddingHorizontal: scale(20) },
    dropEmoji: { fontSize: scale(44), marginBottom: verticalScale(10) },
    certTitle: { fontSize: scale(20), fontFamily: karma.f700, color: COLORS.white, textAlign: 'center' },
    certSubtitle: { fontSize: scale(12), color: 'rgba(255,255,255,0.75)', marginTop: verticalScale(4) },
    awardBadge: { flexDirection: 'row', alignItems: 'center', gap: scale(6), backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: scale(20), paddingHorizontal: scale(14), paddingVertical: verticalScale(6), marginTop: verticalScale(14) },
    awardBadgeIcon: { fontSize: scale(18) },
    awardBadgeTitle: { fontSize: scale(13), color: COLORS.white, fontFamily: karma.f700 },

    // Donor hero
    donorHero: { alignItems: 'center', paddingVertical: verticalScale(20), paddingHorizontal: scale(20), backgroundColor: '#fff5f5' },
    donorHeroLabel: { fontSize: scale(12), color: COLORS.slate500, fontFamily: karma.f400 },
    donorHeroName: { fontSize: scale(22), fontFamily: karma.f700, color: COLORS.gray900, marginVertical: verticalScale(4), textAlign: 'center' },

    // Code box
    codeBox: { alignItems: 'center', paddingVertical: verticalScale(18), marginHorizontal: scale(16), marginVertical: verticalScale(4), borderRadius: scale(12), borderWidth: 2, borderColor: '#fca5a5', borderStyle: 'dashed', backgroundColor: '#fff5f5' },
    codeBoxCopied: { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
    codeLabel: { fontSize: scale(10), color: COLORS.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: verticalScale(6) },
    codeValue: { fontSize: scale(22), fontFamily: karma.f700, color: COLORS.red600, letterSpacing: 3 },
    codeValueCopied: { color: '#16a34a' },
    codeTap: { fontSize: scale(11), color: COLORS.slate400, marginTop: verticalScale(6) },

    // Dashed divider
    dashedDivider: { flexDirection: 'row', justifyContent: 'center', gap: scale(3), marginVertical: verticalScale(4), paddingHorizontal: scale(8) },
    dash: { width: scale(6), height: verticalScale(1.5), backgroundColor: '#e5e7eb', borderRadius: 1 },

    detailsGrid: { paddingHorizontal: scale(16), paddingBottom: verticalScale(8) },

    // Footer seal
    certFooter: { alignItems: 'center', paddingVertical: verticalScale(20), gap: verticalScale(8) },
    sealCircle: { width: scale(56), height: scale(56), borderRadius: scale(28), backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fca5a5' },
    sealEmoji: { fontSize: scale(26) },
    verifiedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: scale(16), paddingVertical: verticalScale(5), borderRadius: scale(20) },
    verifiedText: { fontSize: scale(12), color: '#15803d', fontFamily: karma.f600 },
    footerNote: { fontSize: scale(10), color: COLORS.slate400, textAlign: 'center', lineHeight: 15, paddingHorizontal: scale(20) },

    // Lives saved
    livesCard: { borderRadius: scale(16), overflow: 'hidden', marginBottom: verticalScale(16), elevation: 4 },
    livesGradient: { alignItems: 'center', paddingVertical: verticalScale(24) },
    livesEmoji: { fontSize: scale(36), marginBottom: verticalScale(6) },
    livesCount: { fontSize: scale(56), fontFamily: karma.f700, color: COLORS.white, lineHeight: scale(60) },
    livesLabel: { fontSize: scale(16), fontFamily: karma.f600, color: COLORS.white, marginTop: verticalScale(4) },
    livesNote: { fontSize: scale(12), color: 'rgba(255,255,255,0.7)', marginTop: verticalScale(4) },

    // Awards
    awardsSection: { backgroundColor: COLORS.white, borderRadius: scale(16), padding: scale(16), marginBottom: verticalScale(16), elevation: 2 },
    awardsSectionTitle: { fontSize: scale(15), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(12) },
    awardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) },
    awardChip: { alignItems: 'center', backgroundColor: '#fff5f5', borderRadius: scale(12), paddingHorizontal: scale(14), paddingVertical: verticalScale(10), borderWidth: 1, borderColor: '#fca5a5', minWidth: scale(70) },
    awardChipIcon: { fontSize: scale(24), marginBottom: verticalScale(4) },
    awardChipTitle: { fontSize: scale(10), fontFamily: karma.f600, color: COLORS.red600, textAlign: 'center' },

    // Actions
    actions: { gap: verticalScale(10) },
    actionBtnPrimary: { backgroundColor: COLORS.red600, borderRadius: scale(12), paddingVertical: verticalScale(14), alignItems: 'center', elevation: 2 },
    actionBtnPrimaryText: { color: COLORS.white, fontSize: scale(15), fontFamily: karma.f700 },
    actionBtnSecondary: { backgroundColor: COLORS.white, borderRadius: scale(12), paddingVertical: verticalScale(13), alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.gray300 },
    actionBtnSecondaryText: { color: COLORS.gray900, fontSize: scale(14), fontFamily: karma.f600 },
});
