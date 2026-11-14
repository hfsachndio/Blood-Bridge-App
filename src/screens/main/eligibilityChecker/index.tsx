import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import Button from '../../../components/Button';
import { useUser } from '../../../context/UserContext';
import { checkEligibility, EligibilityResult } from '../../../utils/eligibility';
import { doc, updateDoc, db, serverTimestamp, setDoc, getDocs, query, where, getDonationsCollection } from '../../../config/firebase';
import { getAuth } from '../../../config/firebase';
import Toast from 'react-native-toast-message';

// ── Outcome config ────────────────────────────────────────────────────────────
const OUTCOME_CONFIG = {
    eligible: { color: '#16a34a', bg: '#dcfce7', icon: '✅', label: 'Eligible Now' },
    wait: { color: '#d97706', bg: '#fef3c7', icon: '⏳', label: 'Wait Required' },
    medical_review: { color: '#7c3aed', bg: '#f3e8ff', icon: '🩺', label: 'Needs Medical Review' },
    not_eligible: { color: '#dc2626', bg: '#fee2e2', icon: '❌', label: 'Not Eligible' },
};

// ── Toggle question row ───────────────────────────────────────────────────────
const QuestionRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.questionRow}>
        <Text style={styles.questionLabel}>{label}</Text>
        <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: COLORS.gray300, true: COLORS.red600 }}
            thumbColor={value ? COLORS.white : COLORS.white}
        />
    </View>
);

const EligibilityCheckerScreen = ({ navigation }: any) => {
    const { profile } = useUser();

    const [weight, setWeight] = useState(profile?.weight?.toString() || '');
    const [lastDonationDate, setLastDonationDate] = useState(profile?.lastDonationDate || '');
    const [hasFever, setHasFever] = useState(false);
    const [hasIllness, setHasIllness] = useState(false);
    const [hadSurgeryRecently, setHadSurgeryRecently] = useState(false);
    const [isOnMedication, setIsOnMedication] = useState(false);
    const [hadTattooOrPiercing, setHadTattooOrPiercing] = useState(false);
    const [isPregnantOrBreastfeeding, setIsPregnantOrBreastfeeding] = useState(false);
    const [hadBloodTransfusion, setHadBloodTransfusion] = useState(false);

    const [result, setResult] = useState<EligibilityResult | null>(null);
    const [saving, setSaving] = useState(false);

    const runCheck = () => {
        if (!weight || isNaN(Number(weight))) {
            Toast.show({ type: 'error', text1: 'Weight Required', text2: 'Please enter your weight in kg.' });
            return;
        }
        const res = checkEligibility({
            dateOfBirth: profile?.dateOfBirth || '',
            weight: Number(weight),
            lastDonationDate: lastDonationDate || undefined,
            hasFever,
            hasIllness,
            hadSurgeryRecently,
            isOnMedication,
            hadTattooOrPiercing,
            isPregnantOrBreastfeeding,
            hadBloodTransfusion,
        });
        setResult(res);
    };

    const applyResult = async () => {
        if (!result || !profile?.uid) return;
        setSaving(true);
        try {
            const isEligible = result.outcome === 'eligible';
            const user = getAuth().currentUser;
            if (!user) return;

            // Save weight, lastDonationDate, eligibilityOutcome to profile
            await setDoc(doc(db, 'users', profile.uid), {
                weight: Number(weight),
                lastDonationDate: lastDonationDate || null,
                eligibilityOutcome: result.outcome,
                isAvailable: isEligible,
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // Sync donation posts status
            const donSnap = await getDocs(query(getDonationsCollection(), where('uid', '==', user.uid)));
            await Promise.all(donSnap.docs.map((d: any) => {
                const nextStatus = isEligible ? 'active' : 'inactive';
                if ((d.data() as any).status !== nextStatus) {
                    return updateDoc(doc(db, 'donations', d.id), { status: nextStatus, updatedAt: serverTimestamp() });
                }
                return Promise.resolve();
            }));

            Toast.show({
                type: isEligible ? 'success' : 'info',
                text1: isEligible ? 'Availability Enabled 🩸' : 'Availability Paused',
                text2: isEligible ? 'You are now visible to blood seekers.' : 'You are hidden from donation requests.',
            });
            navigation.goBack();
        } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Save failed', text2: e.message });
        } finally {
            setSaving(false);
        }
    };

    const cfg = result ? OUTCOME_CONFIG[result.outcome] : null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Eligibility Checker</Text>
                <View style={{ width: scale(40) }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                {/* Profile summary */}
                <View style={styles.profileCard}>
                    <Text style={styles.profileName}>{profile?.fullName}</Text>
                    <View style={styles.profileRow}>
                        <Text style={styles.profileChip}>🩸 {profile?.bloodType || '—'}</Text>
                        <Text style={styles.profileChip}>🎂 {profile?.dateOfBirth || 'DOB not set'}</Text>
                    </View>
                </View>

                {/* Weight input */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Basic Info</Text>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Weight (kg)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={weight}
                            onChangeText={setWeight}
                            keyboardType="numeric"
                            placeholder="e.g. 65"
                            placeholderTextColor={COLORS.slate500}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Last Donation Date</Text>
                        <TextInput
                            style={styles.textInput}
                            value={lastDonationDate}
                            onChangeText={setLastDonationDate}
                            placeholder="MM/DD/YYYY or leave blank"
                            placeholderTextColor={COLORS.slate500}
                        />
                    </View>
                </View>

                {/* Health questionnaire */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Health Questionnaire</Text>
                    <Text style={styles.sectionSubtitle}>Answer honestly — this protects both you and the recipient.</Text>
                    <QuestionRow label="Do you currently have a fever?" value={hasFever} onChange={setHasFever} />
                    <QuestionRow label="Are you currently ill or unwell?" value={hasIllness} onChange={setHasIllness} />
                    <QuestionRow label="Had surgery in the last 6 months?" value={hadSurgeryRecently} onChange={setHadSurgeryRecently} />
                    <QuestionRow label="Currently taking any medication?" value={isOnMedication} onChange={setIsOnMedication} />
                    <QuestionRow label="Tattoo or piercing in last 6 months?" value={hadTattooOrPiercing} onChange={setHadTattooOrPiercing} />
                    <QuestionRow label="Pregnant or breastfeeding?" value={isPregnantOrBreastfeeding} onChange={setIsPregnantOrBreastfeeding} />
                    <QuestionRow label="Received blood transfusion in last 12 months?" value={hadBloodTransfusion} onChange={setHadBloodTransfusion} />
                </View>

                <Button title="Check My Eligibility" onPress={runCheck} style={styles.checkBtn} />

                {/* Result card */}
                {result && cfg && (
                    <View style={[styles.resultCard, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
                        <Text style={styles.resultIcon}>{cfg.icon}</Text>
                        <Text style={[styles.resultTitle, { color: cfg.color }]}>{result.title}</Text>
                        <Text style={styles.resultMessage}>{result.message}</Text>

                        {result.outcome === 'wait' && result.daysUntilEligible && (
                            <View style={styles.countdownBox}>
                                <Text style={[styles.countdownDays, { color: cfg.color }]}>{result.daysUntilEligible}</Text>
                                <Text style={styles.countdownLabel}>days until eligible</Text>
                                {result.nextEligibleDate && (
                                    <Text style={styles.nextDate}>Next eligible: {result.nextEligibleDate}</Text>
                                )}
                            </View>
                        )}

                        {result.reasons.length > 0 && (
                            <View style={styles.reasonsList}>
                                {result.reasons.map((r, i) => (
                                    <Text key={i} style={styles.reasonItem}>• {r}</Text>
                                ))}
                            </View>
                        )}

                        <Button
                            title={saving ? 'Saving...' : result.outcome === 'eligible' ? 'Enable My Availability 🩸' : 'Save & Pause Availability'}
                            onPress={applyResult}
                            disabled={saving}
                            style={[styles.applyBtn, { backgroundColor: cfg.color, borderColor: cfg.color }]}
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default EligibilityCheckerScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    backBtn: { padding: scale(8) },
    backText: { fontSize: scale(20), color: COLORS.gray900 },
    headerTitle: { fontSize: scale(17), fontFamily: karma.f700, color: COLORS.gray900 },
    scroll: { padding: scale(16), paddingBottom: verticalScale(60) },
    profileCard: { backgroundColor: '#fff5f5', borderRadius: scale(12), padding: scale(16), marginBottom: verticalScale(20), borderWidth: 1, borderColor: '#fecaca' },
    profileName: { fontSize: scale(16), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(8) },
    profileRow: { flexDirection: 'row', gap: scale(10) },
    profileChip: { fontSize: scale(13), color: COLORS.slate600, backgroundColor: COLORS.white, paddingHorizontal: scale(10), paddingVertical: verticalScale(4), borderRadius: scale(20), borderWidth: 1, borderColor: COLORS.gray300 },
    section: { marginBottom: verticalScale(20) },
    sectionTitle: { fontSize: scale(15), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(4) },
    sectionSubtitle: { fontSize: scale(12), color: COLORS.slate500, marginBottom: verticalScale(12) },
    inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: verticalScale(10), borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    inputLabel: { fontSize: scale(14), color: COLORS.gray700, flex: 1 },
    textInput: { flex: 1, textAlign: 'right', fontSize: scale(14), color: COLORS.gray900, fontFamily: karma.f500 },
    questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    questionLabel: { fontSize: scale(13), color: COLORS.gray700, flex: 1, paddingRight: scale(10) },
    checkBtn: { marginBottom: verticalScale(20) },
    resultCard: { borderRadius: scale(16), padding: scale(20), borderWidth: 1.5, alignItems: 'center', marginBottom: verticalScale(20) },
    resultIcon: { fontSize: scale(40), marginBottom: verticalScale(8) },
    resultTitle: { fontSize: scale(20), fontFamily: karma.f700, marginBottom: verticalScale(8), textAlign: 'center' },
    resultMessage: { fontSize: scale(14), color: COLORS.gray700, textAlign: 'center', lineHeight: 20, marginBottom: verticalScale(12) },
    countdownBox: { alignItems: 'center', marginBottom: verticalScale(12) },
    countdownDays: { fontSize: scale(48), fontFamily: karma.f700, lineHeight: scale(52) },
    countdownLabel: { fontSize: scale(13), color: COLORS.slate600 },
    nextDate: { fontSize: scale(12), color: COLORS.slate500, marginTop: verticalScale(4) },
    reasonsList: { alignSelf: 'stretch', marginBottom: verticalScale(12) },
    reasonItem: { fontSize: scale(13), color: COLORS.slate600, marginBottom: verticalScale(4) },
    applyBtn: { width: '100%', marginTop: verticalScale(4) },
});
