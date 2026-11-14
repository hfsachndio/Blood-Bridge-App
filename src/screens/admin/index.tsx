import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Linking, Modal, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import { db, collection, query, where, onSnapshot, doc, updateDoc, getAuth, signOut } from '../../config/firebase';
import Button from '../../components/Button';
import Toast from 'react-native-toast-message';
import { getApp } from '@react-native-firebase/app';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import RNFS from 'react-native-fs';

// ── OCR via ML Kit (on-device, free, no billing needed) ──────────────────────
const extractTextFromImageUri = async (imageUri: string): Promise<string> => {
    const result = await TextRecognition.recognize(imageUri);
    const fullText = result.text || '';
    console.log('[Admin OCR] text length:', fullText.length, '| preview:', fullText.slice(0, 200));
    return fullText.toUpperCase();
};

// Convert stored base64 data URI → temp file → run OCR
const extractTextFromDataUri = async (dataUri: string): Promise<string> => {
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    const tempPath = `${RNFS.CachesDirectoryPath}/cnic_temp_${Date.now()}.jpg`;
    await RNFS.writeFile(tempPath, base64, 'base64');
    const text = await extractTextFromImageUri(`file://${tempPath}`);
    await RNFS.unlink(tempPath).catch(() => {});
    return text;
};

const verifyCnicFromOcr = (ocrText: string, fullName: string, cnicNumber: string): boolean => {
    const normalized = ocrText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    const cnicDigitsOnly = cnicNumber.replace(/\D/g, '');
    const ocrDigitsOnly = normalized.replace(/\D/g, '');
    const cnicFound =
        ocrDigitsOnly.includes(cnicDigitsOnly) ||
        normalized.includes(cnicNumber.toUpperCase()) ||
        normalized.replace(/\s/g, '').includes(cnicDigitsOnly);
    const nameParts = fullName.trim().toUpperCase().split(/\s+/).filter(p => p.length > 1);
    const nameFound = nameParts.length > 0 && nameParts.every(part => normalized.includes(part));
    console.log('[Admin OCR] cnicFound:', cnicFound, 'nameFound:', nameFound);
    return cnicFound && nameFound;
};

const AdminDashboardScreen = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [filter, setFilter] = useState('pending');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [reverifyingId, setReverifyingId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'user'),
            where('status', '==', filter)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(userDoc => ({ id: userDoc.id, ...userDoc.data() }));
            setUsers(fetchedUsers);
        }, (error) => {
            console.log('Error fetching users:', error);
        });

        return () => unsubscribe();
    }, [filter]);

    const changeStatus = async (userId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, 'users', userId), { status: newStatus });
            Toast.show({ type: 'success', text1: `User ${newStatus}` });
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Status update failed' });
        }
    };

    const handleLogout = async () => {
        await signOut(getAuth());
    };

    const openDocPreview = (item: any) => {
        setSelectedUser(item);
        if (item.documents?.[0]) {
            setPreviewImage(item.documents[0]);
        }
    };

    // Re-run OCR on stored CNIC image and auto-approve if it matches
    const reVerify = async (item: any) => {
        if (!item.documents?.[0] || !item.cnicNumber || !item.fullName) {
            Toast.show({ type: 'error', text1: 'Missing data', text2: 'No CNIC image or info to verify.' });
            return;
        }
        setReverifyingId(item.id);
        try {
            // Extract base64 from stored data URI
            const dataUri: string = item.documents[0];
            const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

            const ocrText = await extractTextFromDataUri(dataUri);
            const verified = verifyCnicFromOcr(ocrText, item.fullName, item.cnicNumber);

            await updateDoc(doc(db, 'users', item.id), {
                cnicVerified: verified,
                status: verified ? 'approved' : 'pending',
                ocrExtractedText: ocrText.slice(0, 500),
            });

            Toast.show({
                type: verified ? 'success' : 'info',
                text1: verified ? '✓ Auto-Verified & Approved' : 'No match found',
                text2: verified ? 'Name and CNIC matched.' : 'Approve manually if correct.',
            });
        } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Re-verify failed', text2: e.message });
        } finally {
            setReverifyingId(null);
        }
    };

    const renderVerificationBadge = (item: any) => {
        if (item.cnicVerified === true) {
            return (
                <View style={styles.badgeAuto}>
                    <Text style={styles.badgeText}>✓ Auto-Verified</Text>
                </View>
            );
        }
        if (item.documents?.length > 0) {
            return (
                <View style={styles.badgeManual}>
                    <Text style={styles.badgeText}>⚠ Needs Manual Review</Text>
                </View>
            );
        }
        return null;
    };

    const renderUser = ({ item }: { item: any }) => (
        <View style={styles.userCard}>
            <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.userName}>{item.fullName || 'No Name'}</Text>
                    {renderVerificationBadge(item)}
                </View>
                <Text style={styles.userEmail}>{item.email || 'No Email'}</Text>
                {item.cnicNumber ? (
                    <Text style={styles.cnicText}>CNIC: {item.cnicNumber}</Text>
                ) : null}
                <Text style={styles.userStatus}>Status: {item.status}</Text>
            </View>

            {item.documents && item.documents.length > 0 && (
                <TouchableOpacity
                    onPress={() =>
                        item.documents[0].startsWith('http')
                            ? Linking.openURL(item.documents[0])
                            : openDocPreview(item)
                    }
                    style={styles.docBtn}
                >
                    <Text style={styles.docBtnText}>🪪 View CNIC Photo</Text>
                </TouchableOpacity>
            )}

            {/* Re-verify button for pending users that have a document */}
            {item.status === 'pending' && item.documents?.length > 0 && item.cnicVerified !== true && (
                <TouchableOpacity
                    onPress={() => reVerify(item)}
                    style={styles.reverifyBtn}
                    disabled={reverifyingId === item.id}
                >
                    {reverifyingId === item.id ? (
                        <ActivityIndicator size="small" color="#7c3aed" />
                    ) : (
                        <Text style={styles.reverifyBtnText}>🔍 Re-run Auto Verify</Text>
                    )}
                </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
                {item.status !== 'approved' && (
                    <Button
                        title="Approve"
                        onPress={() => changeStatus(item.id, 'approved')}
                        style={[styles.flexBtn, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}
                    />
                )}
                {item.status !== 'rejected' && (
                    <Button
                        title="Reject"
                        onPress={() => changeStatus(item.id, 'rejected')}
                        style={[styles.flexBtn, { backgroundColor: COLORS.red600, borderColor: COLORS.red600 }]}
                    />
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>BloodBridge Admin</Text>
                <TouchableOpacity onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabsRow}>
                {['pending', 'approved', 'rejected', 'incomplete'].map((t) => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tab, filter === t && styles.activeTab]}
                        onPress={() => setFilter(t)}
                    >
                        <Text style={[styles.tabText, filter === t && styles.activeTabText]}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={renderUser}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No users found in this category.</Text>}
            />

            {/* CNIC Preview Modal */}
            <Modal
                visible={!!previewImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { setPreviewImage(null); setSelectedUser(null); }}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.closeModalBtn}
                        onPress={() => { setPreviewImage(null); setSelectedUser(null); }}
                    >
                        <Text style={styles.closeModalText}>✕ Close</Text>
                    </TouchableOpacity>

                    {selectedUser && (
                        <View style={styles.modalInfoBox}>
                            <Text style={styles.modalInfoName}>{selectedUser.fullName}</Text>
                            <Text style={styles.modalInfoCnic}>CNIC: {selectedUser.cnicNumber || 'Not provided'}</Text>
                            {selectedUser.cnicVerified === true ? (
                                <Text style={styles.modalVerified}>✓ Auto-verified by OCR</Text>
                            ) : (
                                <Text style={styles.modalNotVerified}>⚠ OCR could not verify — check manually</Text>
                            )}
                        </View>
                    )}

                    {previewImage && (
                        <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default AdminDashboardScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: scale(20), backgroundColor: COLORS.white },
    headerTitle: { fontSize: scale(20), fontFamily: karma.f700, color: COLORS.gray900 },
    logoutText: { fontSize: scale(14), color: COLORS.red600, fontWeight: 'bold' },
    tabsRow: { flexDirection: 'row', paddingHorizontal: scale(10), paddingVertical: verticalScale(10), backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    tab: { paddingHorizontal: scale(10), paddingVertical: verticalScale(6), borderRadius: scale(20) },
    activeTab: { backgroundColor: COLORS.red100 },
    tabText: { color: COLORS.slate600, fontSize: scale(13) },
    activeTabText: { color: COLORS.red600, fontWeight: 'bold' },
    list: { padding: scale(16), paddingBottom: verticalScale(100) },
    emptyText: { textAlign: 'center', color: COLORS.slate500, marginTop: verticalScale(40) },
    userCard: { backgroundColor: COLORS.white, padding: scale(16), borderRadius: scale(12), marginBottom: verticalScale(16), elevation: 2 },
    userInfo: { marginBottom: verticalScale(12) },
    nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: scale(8), marginBottom: verticalScale(2) },
    userName: { fontSize: scale(16), fontFamily: karma.f700, color: COLORS.gray900 },
    userEmail: { fontSize: scale(14), color: COLORS.slate600, marginTop: verticalScale(2) },
    cnicText: { fontSize: scale(13), color: COLORS.gray700, marginTop: verticalScale(3), fontFamily: karma.f500 },
    userStatus: { fontSize: scale(12), color: '#ea580c', marginTop: verticalScale(4), textTransform: 'uppercase', fontWeight: 'bold' },
    badgeAuto: { backgroundColor: '#dcfce7', paddingHorizontal: scale(8), paddingVertical: verticalScale(2), borderRadius: scale(10) },
    badgeManual: { backgroundColor: '#fef9c3', paddingHorizontal: scale(8), paddingVertical: verticalScale(2), borderRadius: scale(10) },
    badgeText: { fontSize: scale(11), color: '#166534', fontWeight: 'bold' },
    docBtn: { alignSelf: 'flex-start', paddingVertical: verticalScale(6), paddingHorizontal: scale(12), backgroundColor: '#eff6ff', borderRadius: scale(6), marginBottom: verticalScale(8) },
    docBtnText: { color: '#2563eb', fontSize: scale(12), fontWeight: 'bold' },
    reverifyBtn: { alignSelf: 'flex-start', paddingVertical: verticalScale(6), paddingHorizontal: scale(12), backgroundColor: '#f3e8ff', borderRadius: scale(6), marginBottom: verticalScale(12), minWidth: scale(160), alignItems: 'center' },
    reverifyBtnText: { color: '#7c3aed', fontSize: scale(12), fontWeight: 'bold' },
    actionRow: { flexDirection: 'row', gap: scale(10) },
    flexBtn: { flex: 1, height: verticalScale(40), elevation: 0 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: scale(16) },
    closeModalBtn: { position: 'absolute', top: verticalScale(40), right: scale(20), padding: scale(10), zIndex: 10 },
    closeModalText: { color: COLORS.white, fontSize: scale(16), fontWeight: 'bold' },
    modalInfoBox: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: scale(10), padding: scale(14), marginBottom: verticalScale(16), width: '90%', alignItems: 'center' },
    modalInfoName: { color: COLORS.white, fontSize: scale(16), fontFamily: karma.f700, marginBottom: verticalScale(4) },
    modalInfoCnic: { color: '#d1d5db', fontSize: scale(14), marginBottom: verticalScale(6) },
    modalVerified: { color: '#86efac', fontSize: scale(13), fontWeight: 'bold' },
    modalNotVerified: { color: '#fde68a', fontSize: scale(13), fontWeight: 'bold' },
    previewImage: { width: '90%', height: '65%' },
});
