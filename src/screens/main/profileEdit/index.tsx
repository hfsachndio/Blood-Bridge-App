import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import InputField from '../../../components/InputField';
import Button from '../../../components/Button';
import { images } from '../../../assets/png/images';
import { doc, updateDoc, db } from '../../../config/firebase';
import { useUser } from '../../../context/UserContext';
import Toast from 'react-native-toast-message';

const ProfileEditScreen = ({ navigation }: any) => {
    const { profile } = useUser();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: profile?.fullName || '',
        bloodType: profile?.bloodType || '',
        location: profile?.location || '',
        dateOfBirth: profile?.dateOfBirth || '',
        gender: profile?.gender || '',
        address: profile?.address || '',
        weight: profile?.weight?.toString() || '',
    });

    const [showBloodTypes, setShowBloodTypes] = useState(false);
    const [showGender, setShowGender] = useState(false);
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const genders = ['Male', 'Female', 'Other'];

    const updateField = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        if (!profile?.uid) return;
        if (!formData.fullName.trim()) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Name cannot be empty' });
            return;
        }

        setLoading(true);
        try {
            const userRef = doc(db, 'users', profile.uid);
            await updateDoc(userRef, {
                fullName: formData.fullName,
                bloodType: formData.bloodType,
                location: formData.location,
                dateOfBirth: formData.dateOfBirth,
                gender: formData.gender,
                address: formData.address,
                ...(formData.weight ? { weight: Number(formData.weight) } : {}),
            });

            Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
            navigation.goBack();
        } catch (error: any) {
            console.error('Update error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to update profile' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: scale(40) }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <InputField
                        placeholder="Enter your name"
                        value={formData.fullName}
                        onChangeText={(val: string) => updateField('fullName', val)}
                        leftIcon={images.usericon}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Blood Type</Text>
                    <TouchableOpacity
                        style={[styles.selectBox, formData.bloodType ? styles.selectBoxFilled : null]}
                        onPress={() => setShowBloodTypes(!showBloodTypes)}
                    >
                        <Text style={[styles.selectBoxText, !formData.bloodType && styles.selectPlaceholder]}>
                            {formData.bloodType || 'Select blood type'}
                        </Text>
                        <Text style={styles.chevron}>{showBloodTypes ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {showBloodTypes && (
                        <View style={styles.dropdown}>
                            {bloodTypes.map(type => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.dropdownItem, formData.bloodType === type && styles.dropdownItemActive]}
                                    onPress={() => { updateField('bloodType', type); setShowBloodTypes(false); }}>
                                    <Text style={[styles.dropdownText, formData.bloodType === type && styles.dropdownTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Location</Text>
                    <InputField
                        placeholder="Enter your location"
                        value={formData.location}
                        onChangeText={(val: string) => updateField('location', val)}
                        leftIcon={images.locationicon}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date of Birth</Text>
                    <InputField
                        placeholder="YYYY-MM-DD"
                        value={formData.dateOfBirth}
                        onChangeText={(val: string) => updateField('dateOfBirth', val)}
                        leftIcon={images.calendericon}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Gender</Text>
                    <TouchableOpacity
                        style={[styles.selectBox, formData.gender ? styles.selectBoxFilled : null]}
                        onPress={() => setShowGender(!showGender)}
                    >
                        <Text style={[styles.selectBoxText, !formData.gender && styles.selectPlaceholder]}>
                            {formData.gender || 'Select gender'}
                        </Text>
                        <Text style={styles.chevron}>{showGender ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {showGender && (
                        <View style={styles.dropdown}>
                            {genders.map(g => (
                                <TouchableOpacity
                                    key={g}
                                    style={[styles.dropdownItem, formData.gender === g && styles.dropdownItemActive]}
                                    onPress={() => { updateField('gender', g); setShowGender(false); }}>
                                    <Text style={[styles.dropdownText, formData.gender === g && styles.dropdownTextActive]}>
                                        {g}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Detailed Address</Text>
                    <InputField
                        placeholder="House #, Street, Block etc."
                        value={formData.address}
                        onChangeText={(val: string) => updateField('address', val)}
                        leftIcon={images.locationicon}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Weight (kg)</Text>
                    <InputField
                        placeholder="e.g. 65"
                        value={formData.weight}
                        onChangeText={(val: string) => updateField('weight', val)}
                        leftIcon={images.usericon}
                        keyboardType="numeric"
                    />
                </View>

                <Button
                    title={loading ? 'Saving...' : 'Save Changes'}
                    onPress={handleSave}
                    disabled={loading}
                    style={styles.saveBtn}
                />
            </ScrollView>
        </SafeAreaView>
    );
};

export default ProfileEditScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: verticalScale(15),
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    backBtn: { width: scale(40), height: scale(40), justifyContent: 'center', alignItems: 'center' },
    backBtnText: { fontSize: scale(20), color: COLORS.gray900 },
    headerTitle: { fontSize: scale(18), fontFamily: karma.f700, color: COLORS.gray900 },
    scroll: { padding: scale(20), flexGrow: 1 },
    inputGroup: { marginBottom: verticalScale(20) },
    label: { fontSize: scale(14), color: COLORS.gray700, marginBottom: verticalScale(8), fontFamily: karma.f600 },
    saveBtn: { marginTop: verticalScale(20) },
    selectBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(14),
        paddingVertical: verticalScale(12),
        borderRadius: scale(10),
        borderWidth: 1.5,
        borderColor: COLORS.gray300,
        backgroundColor: COLORS.white,
    },
    selectBoxFilled: { borderColor: COLORS.red400, backgroundColor: COLORS.red100 },
    selectBoxText: { fontSize: scale(14), fontFamily: karma.f500, color: COLORS.gray900 },
    selectPlaceholder: { color: COLORS.slate500, fontFamily: karma.f400 },
    chevron: { fontSize: scale(11), color: COLORS.slate500 },
    dropdown: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.gray300,
        borderRadius: scale(10),
        marginTop: scale(4),
        elevation: 6,
        zIndex: 999,
        overflow: 'hidden',
    },
    dropdownItem: { paddingVertical: scale(10), paddingHorizontal: scale(14), borderBottomWidth: 1, borderBottomColor: COLORS.gray300 },
    dropdownItemActive: { backgroundColor: COLORS.red100 },
    dropdownText: { fontSize: scale(14), color: COLORS.gray700, fontFamily: karma.f400 },
    dropdownTextActive: { color: COLORS.red600, fontFamily: karma.f600 },
});
