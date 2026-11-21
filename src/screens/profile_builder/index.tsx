import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import Button from '../../components/Button';
import { useUser } from '../../context/UserContext';
import { launchImageLibrary } from 'react-native-image-picker';
import { doc, setDoc, db } from '../../config/firebase';
import Toast from 'react-native-toast-message';
import { readCnic } from '../../ai/cnicReader';
import type { CnicReading } from '../../ai/cnicText';
import { navigationRef } from '../../../App';

// ── AI CNIC reader: ML Kit OCR on phones, quality check + Tesseract OCR on the web build ─────
// (src/ai/cnicReader.ts / cnicReader.web.ts — same parser and checks as the website)

// ── Match name and CNIC/Identity number from OCR text ────────────────────────
const verifyCnicFromOcr = (ocrText: string, fullName: string, cnicNumber: string): boolean => {
    // Normalize OCR text — collapse whitespace, uppercase
    const normalized = ocrText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

    // ── CNIC number matching ──────────────────────────────────────────────────
    // Strip all non-digits from both the stored CNIC and the OCR text for comparison
    const cnicDigitsOnly = cnicNumber.replace(/\D/g, ''); // e.g. "3230229985527"

    // Also build variants the card might show: with dashes, without, with spaces
    const cnicWithDash = cnicNumber.toUpperCase(); // e.g. "32302-2998552-7"

    // Remove all non-alphanumeric from OCR and check if digit sequence is present
    const ocrDigitsOnly = normalized.replace(/\D/g, '');

    const cnicFound =
        ocrDigitsOnly.includes(cnicDigitsOnly) ||          // pure digit match
        normalized.includes(cnicWithDash) ||               // exact dash format
        normalized.replace(/\s/g, '').includes(cnicDigitsOnly); // spaces stripped

    // ── Name matching ─────────────────────────────────────────────────────────
    // Split name into individual words, require ALL words (length > 1) to appear
    const nameParts = fullName.trim().toUpperCase().split(/\s+/).filter(p => p.length > 1);
    const nameFound = nameParts.length > 0 && nameParts.every(part => normalized.includes(part));

    console.log('[OCR Debug] normalized (first 300):', normalized.slice(0, 300));
    console.log('[OCR Debug] cnicDigitsOnly:', cnicDigitsOnly);
    console.log('[OCR Debug] ocrDigitsOnly (first 30):', ocrDigitsOnly.slice(0, 30));
    console.log('[OCR Debug] cnicFound:', cnicFound, '| nameFound:', nameFound);

    return cnicFound && nameFound;
};

const ProfileBuilderScreen = ({ navigation }: any) => {
    const { profile } = useUser();
    const [documentImage, setDocumentImage] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [verifyingOcr, setVerifyingOcr] = useState(false);

    const selectImage = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            includeBase64: true,
            quality: 0.5,
            maxWidth: 1200,
            maxHeight: 1200,
        });
        if (result.assets && result.assets.length > 0) {
            setDocumentImage(result.assets[0]);
        }
    };

    const submitProfile = async () => {
        if (!profile?.uid) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Profile context not loaded.' });
            return;
        }
        if (!documentImage || !documentImage.base64) {
            Toast.show({ type: 'error', text1: 'Missing Document', text2: 'Please upload your CNIC photo' });
            return;
        }

        const dataUri = `data:${documentImage.type || 'image/jpeg'};base64,${documentImage.base64}`;
        if (dataUri.length > 1_000_000) {
            Toast.show({ type: 'error', text1: 'Image Too Large', text2: 'Please select a smaller image.' });
            return;
        }

        setLoading(true);

        try {
            // ── Step 1: Run OCR on the CNIC image ──────────────────────────
            setVerifyingOcr(true);
            let ocrText = '';
            let cnicVerified = false;

            let read: CnicReading | null = null;
            try {
                read = await readCnic(documentImage.uri, profile.cnicNumber || undefined);
                ocrText = read.text.toUpperCase();
                if (!read.quality.ok) {
                    // Photo-quality check failed: ask for a better photo instead of sending a bad one to review.
                    setVerifyingOcr(false);
                    setLoading(false);
                    Alert.alert('Retake your CNIC photo', read.quality.issues.join('\n') + '\n\nUse good light, keep the card flat and fill the frame.');
                    return;
                }
                cnicVerified = verifyCnicFromOcr(
                    ocrText,
                    profile.fullName || '',
                    profile.cnicNumber || '',
                );
            } catch (ocrErr) {
                console.log('OCR failed, falling back to manual review:', ocrErr);
                // OCR failure → fall back to manual admin review (pending)
            }
            setVerifyingOcr(false);

            // ── Step 2: Save to Firestore ───────────────────────────────────
            const newStatus = cnicVerified ? 'approved' : 'pending';

            await setDoc(doc(db, 'users', profile.uid), {
                status: newStatus,
                documents: [dataUri],
                cnicVerified,
                ocrExtractedText: ocrText.slice(0, 500), // store first 500 chars for admin audit
                // Result of the AI CNIC check, shown to the admin (same shape as the website).
                ...(read ? { cnicCheck: { cnic: read.cnic, matchesTyped: read.matchesTyped, confidence: read.confidence, qualityOk: read.quality.ok, issues: read.quality.issues, dateOfBirth: read.dateOfBirth, checkedAt: new Date().toISOString() } } : {}),
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            if (cnicVerified) {
                Alert.alert(
                    '✅ Identity Verified!',
                    'Your name and CNIC number matched successfully. Your account is now approved.',
                    [{
                        text: 'Go to Dashboard',
                        style: 'default',
                        onPress: () => {
                            // Give Firestore onSnapshot ~1s to update profile.status
                            // then navigate — StackNavigator will have switched to approved stack
                            setTimeout(() => {
                                if (navigationRef.isReady()) {
                                    navigationRef.reset({
                                        index: 0,
                                        routes: [{ name: 'BottomTabs' as never }],
                                    });
                                }
                            }, 800);
                        },
                    }]
                );
            } else {
                Toast.show({
                    type: 'info',
                    text1: 'Submitted for Review',
                    text2: 'Auto-verification failed. Admin will review manually.',
                });
            }
        } catch (err: any) {
            console.log('Submit error:', err);
            Toast.show({ type: 'error', text1: 'Upload Failed', text2: err.message || 'Try again later' });
        } finally {
            setLoading(false);
            setVerifyingOcr(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.title}>Upload Your CNIC</Text>
                <Text style={styles.subtitle}>
                    Take a clear photo of your CNIC card. Your name and CNIC number will be automatically verified.
                </Text>

                <View style={styles.imagePickerContainer}>
                    {documentImage ? (
                        <Image source={{ uri: documentImage.uri }} style={styles.documentPreview} />
                    ) : (
                        <View style={styles.documentPlaceholder}>
                            <Text style={styles.placeholderIcon}>🪪</Text>
                            <Text style={styles.placeholderText}>No CNIC Photo Selected</Text>
                        </View>
                    )}
                    <TouchableOpacity onPress={selectImage} style={styles.selectBtn}>
                        <Text style={styles.selectBtnText}>
                            {documentImage ? 'Change Photo' : 'Choose CNIC Photo'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.infoSummary}>
                    <Text style={styles.infoTitle}>Info to be verified from CNIC:</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Name</Text>
                        <Text style={styles.infoValue}>{profile?.fullName || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>CNIC No.</Text>
                        <Text style={styles.infoValue}>{profile?.cnicNumber || '—'}</Text>
                    </View>
                </View>

                {verifyingOcr && (
                    <View style={styles.ocrStatus}>
                        <ActivityIndicator size="small" color={COLORS.red600} />
                        <Text style={styles.ocrStatusText}>Scanning CNIC image...</Text>
                    </View>
                )}

                <View style={styles.actionContainer}>
                    <Button
                        title={loading ? 'Verifying...' : profile?.documents && profile.documents.length > 0 ? 'Re-Submit & Verify' : 'Submit & Verify'}
                        onPress={submitProfile}
                        disabled={loading}
                        style={styles.mainBtn}
                    />
                    <Button
                        title={profile?.status === 'approved' ? 'Cancel' : 'Finish Later'}
                        backgroundColor={COLORS.white}
                        textColor={COLORS.slate600}
                        style={styles.skipBtn}
                        onPress={() =>
                            profile?.status === 'approved'
                                ? navigation.goBack()
                                : navigation.navigate('StatusScreen')
                        }
                        disabled={loading}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ProfileBuilderScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    scroll: { padding: scale(24), flexGrow: 1 },
    title: { fontSize: scale(24), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(8), textAlign: 'center' },
    subtitle: { fontSize: scale(14), color: COLORS.gray700, textAlign: 'center', marginBottom: verticalScale(28), lineHeight: 20 },
    imagePickerContainer: { alignItems: 'center', marginBottom: verticalScale(24) },
    documentPreview: { width: '100%', height: verticalScale(200), borderRadius: scale(8), resizeMode: 'cover', borderWidth: 1, borderColor: COLORS.gray300 },
    documentPlaceholder: { width: '100%', height: verticalScale(200), borderRadius: scale(8), backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray300, borderStyle: 'dashed' },
    placeholderIcon: { fontSize: scale(40), marginBottom: verticalScale(8) },
    placeholderText: { color: COLORS.slate500, fontSize: scale(14) },
    selectBtn: { marginTop: verticalScale(14), paddingVertical: verticalScale(10), paddingHorizontal: scale(24), backgroundColor: COLORS.red100, borderRadius: scale(20) },
    selectBtnText: { color: COLORS.red600, fontSize: scale(14), fontFamily: karma.f600 },
    infoSummary: { backgroundColor: '#f9fafb', padding: scale(16), borderRadius: scale(12), marginBottom: verticalScale(20), borderWidth: 1, borderColor: COLORS.gray300 },
    infoTitle: { fontSize: scale(13), fontFamily: karma.f600, color: COLORS.gray700, marginBottom: verticalScale(10) },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: verticalScale(6) },
    infoLabel: { fontSize: scale(13), color: COLORS.slate600 },
    infoValue: { fontSize: scale(13), color: COLORS.gray900, fontFamily: karma.f600 },
    ocrStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), marginBottom: verticalScale(16), padding: scale(10), backgroundColor: '#fef3c7', borderRadius: scale(8) },
    ocrStatusText: { fontSize: scale(13), color: '#92400e', fontFamily: karma.f500 },
    actionContainer: { gap: verticalScale(12), marginTop: verticalScale(8) },
    mainBtn: { width: '100%' },
    skipBtn: { width: '100%', borderWidth: 1, borderColor: COLORS.gray300 },
});
