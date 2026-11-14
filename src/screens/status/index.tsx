import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import Button from '../../components/Button';
import { useUser } from '../../context/UserContext';
import { getAuth, signOut } from '../../config/firebase';

const StatusScreen = ({ navigation }: any) => {
    const { profile } = useUser();
    const status = profile?.status || 'incomplete';

    const onLogout = async () => {
        await signOut(getAuth());
    };

    const renderContent = () => {
        switch (status) {
            case 'pending':
                return (
                    <>
                        <View style={[styles.iconBox, { backgroundColor: '#ffedd5' }]}>
                            <Text style={{ fontSize: scale(40) }}>⏳</Text>
                        </View>
                        <Text style={styles.title}>Verification Pending</Text>
                        <Text style={styles.message}>We have received your documents. Our admins are reviewing your profile. Once approved, you will automatically be redirected!</Text>
                        <Button
                            title="Re-Submit Documents"
                            onPress={() => navigation.navigate('ProfileBuilderScreen')}
                            style={{ marginTop: verticalScale(20), width: '100%', backgroundColor: '#fff7ed', borderColor: '#fb923c', borderWidth: 1 }}
                            textColor="#ea580c"
                        />
                    </>
                );
            case 'rejected':
                return (
                    <>
                        <View style={[styles.iconBox, { backgroundColor: COLORS.red100 }]}>
                            <Text style={{ fontSize: scale(40) }}>❌</Text>
                        </View>
                        <Text style={styles.title}>Profile Rejected</Text>
                        <Text style={styles.message}>We could not verify your documents. Please review and ensure your information is authentic, and update your profile.</Text>
                        <Button title="Update Documents" onPress={() => navigation.navigate('ProfileBuilderScreen')} style={{ marginTop: verticalScale(20), width: '100%' }} />
                    </>
                );
            case 'incomplete':
            default:
                return (
                    <>
                        <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                            <Text style={{ fontSize: scale(40) }}>📝</Text>
                        </View>
                        <Text style={styles.title}>Profile Incomplete</Text>
                        <Text style={styles.message}>You must complete your profile by providing validation documents before you can access Blood Bridge.</Text>
                        <Button title="Complete Profile" onPress={() => navigation.navigate('ProfileBuilderScreen')} style={{ marginTop: verticalScale(20), width: '100%' }} />
                    </>
                );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <View style={styles.content}>
                {renderContent()}
                <Button
                    title="Sign Out"
                    backgroundColor={COLORS.white}
                    textColor={COLORS.slate600}
                    onPress={onLogout}
                    style={{ width: '100%', borderWidth: 1, borderColor: COLORS.gray300, marginTop: verticalScale(20) }}
                />
            </View>
        </SafeAreaView>
    );
};

export default StatusScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    content: { flex: 1, padding: scale(24), justifyContent: 'center', alignItems: 'center' },
    iconBox: { width: scale(100), height: verticalScale(100), borderRadius: scale(50), justifyContent: 'center', alignItems: 'center', marginBottom: verticalScale(24) },
    title: { fontSize: scale(22), fontFamily: karma.f700, color: COLORS.gray900, marginBottom: verticalScale(12), textAlign: 'center' },
    message: { fontSize: scale(15), color: COLORS.slate600, textAlign: 'center', lineHeight: 22, paddingHorizontal: scale(10) },
});
