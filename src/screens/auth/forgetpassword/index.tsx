import React, { useState } from 'react';
import { getAuth, sendPasswordResetEmail } from '../../../config/firebase';
import Toast from 'react-native-toast-message';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, StatusBar } from 'react-native';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { images } from '../../../assets/png/images';
import Button from '../../../components/Button';
import InputField from '../../../components/InputField';

const ForgetPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async () => {
    // Validate email field
    if (!email.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your email address',
      });
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter a valid email address',
      });
      return;
    }

    try {
      await sendPasswordResetEmail(getAuth(), email);
      Toast.show({
        type: 'success',
        text1: 'Email Sent Successfully!',
        text2: 'Check your inbox and spam folder',
      });
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error: any) {
      console.log('Password reset error:', error);

      if (error.code === 'auth/user-not-found') {
        Toast.show({
          type: 'error',
          text1: 'User Not Found',
          text2: 'No account found with this email address',
        });
      } else if (error.code === 'auth/invalid-email') {
        Toast.show({
          type: 'error',
          text1: 'Invalid Email',
          text2: 'Please enter a valid email address',
        });
      } else if (error.code === 'auth/network-request-failed') {
        Toast.show({
          type: 'error',
          text1: 'Network Error',
          text2: 'Please check your internet connection',
        });
      } else if (error.code === 'auth/too-many-requests') {
        Toast.show({
          type: 'error',
          text1: 'Too Many Requests',
          text2: 'Please try again later',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Reset Failed',
          text2: error.message || 'An unexpected error occurred',
        });
      }
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Image
            source={images.heartfill}
            style={styles.heartImage}
            resizeMode="contain"
            tintColor={COLORS.white}
          />
        </View>
        <Text style={styles.title}>Forgot Your Password</Text>
        <Text style={styles.subtitle}>
          Enter your email to reset your password
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <InputField
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            leftIcon={images.mailicon}
          />
        </View>

        <Button
          title="Send Reset Link"
          onPress={handleResetPassword}
          style={{ marginVertical: verticalScale(20) }}
        />
        <Button
          title="Back To Login"
          onPress={() => navigation.goBack()}
          backgroundColor={COLORS.white}
          textColor={COLORS.gray700}
          style={{ borderWidth: 1, borderColor: COLORS.gray300 }}
        />
      </View>
    </ScrollView>
  );
};

export default ForgetPasswordScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    padding: scale(24),
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: verticalScale(40),
    marginBottom: verticalScale(20),
  },
  iconContainer: {
    backgroundColor: COLORS.red600,
    padding: scale(16),
    borderRadius: scale(100),
    marginBottom: verticalScale(16),
  },
  heartImage: {
    width: scale(40),
    height: verticalScale(40),
  },
  title: {
    fontFamily: karma.f600,
    fontSize: scale(15),
    color: COLORS.gray900,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: karma.f400,
    fontSize: scale(20),
    color: COLORS.gray700,
    textAlign: 'center',
    marginTop: verticalScale(4),
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: verticalScale(16),
  },
  label: {
    fontSize: scale(14),
    color: COLORS.gray700,
    marginBottom: verticalScale(4),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
