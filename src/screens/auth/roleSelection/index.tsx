import React from 'react';
import { View, Text, StyleSheet, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { images } from '../../../assets/png/images';
import Button from '../../../components/Button';

const RoleSelectionScreen = ({ navigation }: any) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Image
                        source={images.dropleticon}
                        style={styles.heartImage}
                        resizeMode="contain"
                        tintColor={COLORS.white}
                    />
                </View>
                <Text style={styles.title}>Choose Your Path</Text>
                <Text style={styles.subtitle}>Are you here to connect, or are you an administrator?</Text>
            </View>

            <View style={styles.buttonContainer}>
                <Button
                    title="Continue as User"
                    onPress={() => navigation.navigate('LoginScreen', { role: 'user' })}
                    style={styles.mainBtn}
                />
                <Button
                    title="Continue as Admin"
                    backgroundColor={COLORS.white}
                    textColor={COLORS.red600}
                    style={styles.secondaryBtn}
                    onPress={() => navigation.navigate('LoginScreen', { role: 'admin' })}
                />
            </View>
        </SafeAreaView>
    );
};

export default RoleSelectionScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
        paddingHorizontal: scale(24),
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: verticalScale(40),
    },
    iconContainer: {
        backgroundColor: COLORS.red600,
        padding: scale(20),
        borderRadius: scale(100),
        marginBottom: verticalScale(16),
    },
    heartImage: {
        width: scale(48),
        height: verticalScale(48),
    },
    title: {
        fontFamily: karma.f600,
        fontSize: scale(22),
        color: COLORS.gray900,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: karma.f400,
        fontSize: scale(15),
        color: COLORS.gray700,
        textAlign: 'center',
        marginTop: verticalScale(8),
        paddingHorizontal: scale(10),
    },
    buttonContainer: {
        gap: verticalScale(16),
    },
    mainBtn: {
        width: '100%',
    },
    secondaryBtn: {
        width: '100%',
        borderWidth: 1,
        borderColor: COLORS.red600,
    },
});
