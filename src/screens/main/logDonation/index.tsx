import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import Button from '../../../components/Button';
import { useUser } from '../../../context/UserContext';
import {
    addDoc, collection, doc, updateDoc, db,
    serverTimestamp, getAuth,
} from '../../../config/firebase';
import Toast from 'react-native-toast-message';

// Generate a short human-readable confirmation code
const generateConfirmationCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BB-';
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code; // e.g. BB-ABCD-EFGH
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const LogDonationScreen = ({ navigation, route }: any) => {
    const { profile } = useUser();
    // Pre-fill from route params if coming from a donation post context
    const prefill = route?.params || {};

    const [bloodType, setBloodType] = useState<string>(prefill.bloodType || profile?.bloodType || '');
    const [hospital, setHospital] = useState<string>(prefill.hospital || '');
    const [location, setLocation] = useState<string>(prefill.location || profile?.location || '');
    const [units, setUnits] = useState<string>('1');
    const [recipientName, setRecipientName] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [donationDate, setDonationDate] = useState<string>(
        new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
    );
    const [showBloodTypes, setShowBloodTypes] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!bloodType) {
            Toast.show({ type: 'error', text1: 'Required', text2: 'Please select blood type.' });
            return;
        }
        if (!hospital.trim() && !location.trim()) {
            Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter hospital or location.' });
            return;
        }

        const user = getAuth().currentUser;
        if (!user || !profile?.uid) return;

        setLoading(true);
        try {
            const confirmationCode = generateConfirmationCode();
            const donationDateStr = donationDate.trim() || new Date().toDateString();

            // Save to donationRecords collection
            const recordRef = await addDoc(collection(db, 'donationRecords'), {
                donorUid: user.uid,
                donorName: profile.fullName || user.displayName || 'Donor',
                bloodType,
                hospital: hospital.trim(),
                location: location.trim(),
                units: parseInt(units) || 1,
                recipientName: recipientName.trim() || null,
                notes: notes.trim() || null,
                donationDate: donationDateStr,
                confirmationCode,
                status: 'confirmed',
                createdAt: serverTimestamp(),
            });

            // Update user's lastDonationDate so eligibility checker picks it up
            await updateDoc(doc(db, 'users', user.uid), {
                lastDonationDate: donationDateStr,
                totalDonations: (profile as any).totalDonations
                    ? (profile as any).totalDonations + 1
                    : 1,
            });

            Toast.show({ type: 'success', text1: 'Donation Logged! 🩸', text2: 'Record saved successfully.' });

            // Navigate to certificate screen
            navigation.replace('DonationCertificateScreen', {
                record: {
                    id: recordRef.id,
                    donorName: profile.fullName || 'Donor',
                    bloodType,
                    hospital: hospital.trim(),
                    location: location.trim(),
                    units: parseInt(units) || 1,
                    recipientName: recipientName.trim() || null,
                    donationDate: donationDateStr,
                    confirmationCode,
                },
                totalRecords: ((profile as any).totalDonations || 0) + 1,
            });
        } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Failed', text2: e.message || 'Try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Log a Donation</Text>
                <View style={{ width: scale(40) }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        🩸 Record a completed blood donation. A confirmation certificate will be generated for your records.
                    </Text>
                </View>

                {/* Blood Type */}
                <View style={styles.field}>
                    <Text style={styles.label}>Blood Type <Text style={styles.req}>*</Text></Text>
                    <TouchableOpacity
                        style={[styles.selectBox, bloodType && styles.selectBoxFilled]}
                        onPress={() => setShowBloodTypes(v => !v)}>
                        <Text style={[styles.selectText, !bloodType && styles.placeholder]}>
                            {bloodType || 'Select blood type'}
                        </Text>
                        <Text style={styles.chevron}>{showBloodTypes ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {showBloodTypes && (
                        <View style={styles.dropdown}>
                            {BLOOD_TYPES.map(bt => (
                                <TouchableOpacity
                                    key={bt}
                                    style={[styles.dropItem, bloodType === bt && styles.dropItemActive]}
                                    onPress={() => { setBloodType(bt); setShowBloodTypes(false); }}>
                                    <Text style={[styles.dropText, bloodType === bt && styles.dropTextActive]}>{bt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Hospital */}
                <View style={styles.field}>
                    <Text style={styles.label}>Hospital / Facility</Text>
                    <TextInput
                        style={styles.input}
                        value={hospital}
                        onChangeText={setHospital}
                        placeholder="e.g. Aga Khan Hospital"
                        placeholderTextColor={COLORS.slate500}
                    />
                </View>

                {/* Location */}
                <View style={styles.field}>
                    <Text style={styles.label}>City / Location</Text>
                    <TextInput
                        style={styles.input}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="e.g. Karachi"
                        placeholderTextColor={COLORS.slate500}
                    />
                </View>

                {/* Donation Date */}
                <View style={styles.field}>
                    <Text style={styles.label}>Donation Date</Text>
                    <TextInput
                        style={styles.input}
                        value={donationDate}
                        onChangeText={setDonationDate}
                        placeholder="e.g. 07 May 2026"
                        placeholderTextColor={COLORS.slate500}
                    />
                </View>

                {/* Units */}
                <View style={styles.field}>
                    <Text style={styles.label}>Units Donated</Text>
                    <View style={styles.unitsRow}>
                        {['1', '2', '3'].map(u => (
                            <TouchableOpacity
                                key={u}
                                style={[styles.unitChip, units === u && styles.unitChipActive]}
                                onPress={() => setUnits(u)}>
                                <Text style={[styles.unitText, units === u && styles.unitTextActive]}>{u}</Text>
                            </TouchableOpacity>
                        ))}
                        <TextInput
                            style={[styles.unitInput, !['1', '2', '3'].includes(units) && styles.unitInputActive]}
                            value={['1', '2', '3'].includes(units) ? '' : units}
                            onChangeText={v => setUnits(v.replace(/\D/g, '') || '1')}
                            placeholder="Other"
                            placeholderTextColor={COLORS.slate500}
                            keyboardType="numeric"
                            maxLength={2}
                        />
                    </View>
                </View>

                {/* Recipient (optional) */}
                <View style={styles.field}>
                    <Text style={styles.label}>Recipient Name <Text style={styles.opt}>(optional)</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={recipientName}
                        onChangeText={setRecipientName}
                        placeholder="Leave blank for anonymous"
                        placeholderTextColor={COLORS.slate500}
                    />
                </View>

                {/* Notes */}
                <View style={styles.field}>
                    <Text style={styles.label}>Notes <Text style={styles.opt}>(optional)</Text></Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Any additional notes..."
                        placeholderTextColor={COLORS.slate500}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                <Button
                    title={loading ? 'Saving...' : 'Save & Generate Certificate'}
                    onPress={handleSubmit}
                    disabled={loading}
                    style={styles.submitBtn}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default LogDonationScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    backBtn: { padding: scale(8) },
    backText: { fontSize: scale(20), color: COLORS.gray900 },
    headerTitle: { fontSize: scale(17), fontFamily: karma.f700, color: COLORS.gray900 },
    scroll: { padding: scale(16), paddingBottom: verticalScale(60) },
    infoBox: { backgroundColor: '#eff6ff', borderRadius: scale(10), padding: scale(14), marginBottom: verticalScale(20), borderWidth: 1, borderColor: '#bfdbfe' },
    infoText: { fontSize: scale(13), color: '#1d4ed8', lineHeight: 20 },
    field: { marginBottom: verticalScale(18) },
    label: { fontSize: scale(13), fontFamily: karma.f600, color: COLORS.gray700, marginBottom: verticalScale(6) },
    req: { color: COLORS.red600 },
    opt: { color: COLORS.slate500, fontFamily: karma.f400, fontSize: scale(11) },
    input: { borderWidth: 1.5, borderColor: COLORS.gray300, borderRadius: scale(10), paddingHorizontal: scale(14), paddingVertical: verticalScale(11), fontSize: scale(14), color: COLORS.gray900, fontFamily: karma.f400 },
    textArea: { height: verticalScale(80), textAlignVertical: 'top' },
    selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(14), paddingVertical: verticalScale(12), borderRadius: scale(10), borderWidth: 1.5, borderColor: COLORS.gray300 },
    selectBoxFilled: { borderColor: COLORS.red400, backgroundColor: COLORS.red100 },
    selectText: { fontSize: scale(14), fontFamily: karma.f500, color: COLORS.gray900 },
    placeholder: { color: COLORS.slate500, fontFamily: karma.f400 },
    chevron: { fontSize: scale(11), color: COLORS.slate500 },
    dropdown: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray300, borderRadius: scale(10), marginTop: scale(4), elevation: 6, zIndex: 999, overflow: 'hidden' },
    dropItem: { paddingVertical: scale(10), paddingHorizontal: scale(14), borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    dropItemActive: { backgroundColor: COLORS.red100 },
    dropText: { fontSize: scale(14), color: COLORS.gray700 },
    dropTextActive: { color: COLORS.red600, fontFamily: karma.f600 },
    unitsRow: { flexDirection: 'row', gap: scale(8), alignItems: 'center' },
    unitChip: { paddingHorizontal: scale(18), paddingVertical: verticalScale(10), borderRadius: scale(8), borderWidth: 1.5, borderColor: COLORS.gray300 },
    unitChipActive: { backgroundColor: COLORS.red600, borderColor: COLORS.red600 },
    unitText: { fontSize: scale(14), fontFamily: karma.f600, color: COLORS.gray700 },
    unitTextActive: { color: COLORS.white },
    unitInput: { flex: 1, borderWidth: 1.5, borderColor: COLORS.gray300, borderRadius: scale(8), paddingHorizontal: scale(10), paddingVertical: verticalScale(10), fontSize: scale(14), color: COLORS.gray900, textAlign: 'center' },
    unitInputActive: { borderColor: COLORS.red600, backgroundColor: COLORS.red100 },
    submitBtn: { marginTop: verticalScale(8) },
});
