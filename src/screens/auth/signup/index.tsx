import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
} from 'react-native';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { images } from '../../../assets/png/images';
import Button from '../../../components/Button';
import InputField from '../../../components/InputField';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth, createUserWithEmailAndPassword, updateProfile, getUsersCollection, setDoc, doc, serverTimestamp, db } from '../../../config/firebase';
import Toast from 'react-native-toast-message';

const SignupScreen = ({ navigation }: any) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showCPassword, setShowCPassword] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBloodTypes, setShowBloodTypes] = useState(false);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    bloodType: '',
    dateOfBirth: '',
    gender: '',
    cnicNumber: '',
    password: '',
    confirmPassword: '',
  });

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    // Basic phone validation - at least 10 digits
    const phoneRegex = /\d{10,}/;
    return phoneRegex.test(phone.replace(/\s|-/g, ''));
  };

  // Format CNIC as user types: 37103-4353645-3
  const formatCnic = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  };

  const validateCnic = (cnic: string) => {
    return /^\d{5}-\d{7}-\d$/.test(cnic);
  };

  const onSignup = () => {
    // Validate all fields
    if (!formData.fullName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your full name',
      });
      return;
    }

    if (!formData.email.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your email address',
      });
      return;
    }

    if (!validateEmail(formData.email)) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter a valid email address',
      });
      return;
    }

    if (!formData.phone.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your phone number',
      });
      return;
    }

    if (!formData.location.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your city or area',
      });
      return;
    }

    if (!validatePhone(formData.phone)) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter a valid phone number',
      });
      return;
    }

    if (!formData.bloodType) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please select your blood type',
      });
      return;
    }

    if (!formData.dateOfBirth) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please select your date of birth',
      });
      return;
    }

    if (!formData.gender) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please select your gender',
      });
      return;
    }

    if (!formData.cnicNumber.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your CNIC number',
      });
      return;
    }

    if (!validateCnic(formData.cnicNumber)) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'CNIC must be in format: 37103-4353645-3',
      });
      return;
    }

    if (!formData.password) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter a password',
      });
      return;
    }

    if (formData.password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Password must be at least 6 characters long',
      });
      return;
    }

    if (!formData.confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please confirm your password',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Passwords do not match',
      });
      return;
    }

    // All validations passed, proceed with Firebase signup
    const authInstance = getAuth();
    createUserWithEmailAndPassword(authInstance, formData.email, formData.password)
      .then(userCredential => {
        // Update user profile with display name
        updateProfile(userCredential.user, {
          displayName: formData.fullName,
        })
          .then(() => {
            // Save full profile in Firestore for use in Profile/Donate screens
            setDoc(
              doc(db, 'users', userCredential.user.uid),
              {
                uid: userCredential.user.uid,
                fullName: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                location: formData.location,
                bloodType: formData.bloodType,
                dateOfBirth: formData.dateOfBirth,
                gender: formData.gender,
                cnicNumber: formData.cnicNumber,
                isAvailable: true,
                role: 'user',
                status: 'incomplete',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            )
              .catch(err => console.log('User profile save error:', err));

            Toast.show({
              type: 'success',
              text1: 'Account Created! 🎉',
              text2: 'Welcome to Blood Bridge',
            });
            // Status Stack will automatically mount empty Profile pages since status is incomplete
          })
          .catch(error => {
            console.log('Profile update error:', error);
            Toast.show({
              type: 'error',
              text1: 'Profile Update Failed',
              text2: 'Account created but profile update failed',
            });
          });
      })
      .catch(error => {
        console.log('Signup error:', error);

        if (error.code === 'auth/email-already-in-use') {
          Toast.show({
            type: 'error',
            text1: 'Signup Failed',
            text2: 'This email address is already in use',
          });
        } else if (error.code === 'auth/invalid-email') {
          Toast.show({
            type: 'error',
            text1: 'Signup Failed',
            text2: 'Invalid email address format',
          });
        } else if (error.code === 'auth/weak-password') {
          Toast.show({
            type: 'error',
            text1: 'Signup Failed',
            text2: 'Password is too weak',
          });
        } else if (error.code === 'auth/network-request-failed') {
          Toast.show({
            type: 'error',
            text1: 'Network Error',
            text2: 'Please check your internet connection',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Signup Failed',
            text2: error.message || 'An unexpected error occurred',
          });
        }
      });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
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
        <Text style={styles.title}>Join Blood Bridge</Text>
        <Text style={styles.subtitle}>
          Create an account to become a lifesaver
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <InputField
            placeholder="Your Name"
            value={formData.fullName}
            onChangeText={(val: any) => updateField('fullName', val)}
            leftIcon={images.usericon}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <InputField
            placeholder="name@email.com"
            value={formData.email}
            onChangeText={(val: any) => updateField('email', val)}
            leftIcon={images.mailicon}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <InputField
            placeholder="0300 1234567"
            value={formData.phone}
            onChangeText={(val: any) => updateField('phone', val)}
            leftIcon={images.phoneicon}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location</Text>
          <InputField
            placeholder="e.g. Clifton, Karachi"
            value={formData.location}
            onChangeText={(val: any) => updateField('location', val)}
            leftIcon={images.locationicon}
          />
        </View>

        {/* Raised above the fields below so the blood type list can be tapped. */}
        <View style={[styles.rowContainer, styles.raised]}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: scale(8) }]}>
            <Text style={styles.label}>Blood Type</Text>
            <InputField
              placeholder="Select"
              value={formData.bloodType}
              onChangeText={() => { }}
              leftIcon={images.dropleticon}
              rightIcon={images.downarrow}
              onRightIconPress={() => setShowBloodTypes(!showBloodTypes)}
              onPress={() => setShowBloodTypes(!showBloodTypes)}
            />

            {showBloodTypes && (
              <View style={styles.dropdown}>
                {bloodTypes.map((type, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownItem}
                    onPress={() => {
                      updateField('bloodType', type);
                      setShowBloodTypes(false);
                    }}>
                    <Text style={styles.dropdownText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: scale(8) }]}>
            <Text style={styles.label}>Date of Birth</Text>
            <InputField
              placeholder="mm/dd/yyyy"
              value={formData.dateOfBirth}
              onChangeText={() => { }}
              leftIcon={images.calendericon}
              onPress={() => setShowDatePicker(true)}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {['Male', 'Female', 'Other'].map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.genderChip, formData.gender === g && styles.genderChipActive]}
                onPress={() => updateField('gender', g)}>
                <Text style={[styles.genderText, formData.gender === g && styles.genderTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>CNIC Number</Text>
          <InputField
            placeholder="37103-4353645-3"
            value={formData.cnicNumber}
            onChangeText={(val: any) => updateField('cnicNumber', formatCnic(val))}
            leftIcon={images.usericon}
            keyboardType="numeric"
          />
          <Text style={styles.cnicHint}>13 digits with dashes: XXXXX-XXXXXXX-X</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <InputField
            placeholder="Create a password"
            value={formData.password}
            onChangeText={(val: any) => updateField('password', val)}
            secure={!showPassword}
            leftIcon={images.lockicon}
            rightIcon={showPassword ? images.eyeopen : images.eyeclose}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <InputField
            placeholder="Re-enter password"
            value={formData.confirmPassword}
            onChangeText={(val: any) => updateField('confirmPassword', val)}
            secure={!showCPassword}
            leftIcon={images.lockicon}
            rightIcon={showCPassword ? images.eyeopen : images.eyeclose}
            onRightIconPress={() => setShowCPassword(!showCPassword)}
          />
        </View>

        <Button
          title="Create Account"
          onPress={onSignup}
          style={{ marginTop: verticalScale(20) }}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.line} />
        </View>

        <View>
          <Text style={styles.loginText}>
            Already have an account?{' '}
            <Text style={styles.loginLink} onPress={() => navigation.goBack()}>Sign In</Text>
          </Text>
        </View>
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="calendar"
          onChange={(event: any, selectedDate: any) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const formatted =
                selectedDate.getMonth() +
                1 +
                '/' +
                selectedDate.getDate() +
                '/' +
                selectedDate.getFullYear();

              updateField('dateOfBirth', formatted);
            }
          }}
        />
      )}
    </ScrollView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    padding: scale(24),
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
    fontSize: scale(18),
    color: COLORS.gray900,
  },
  subtitle: {
    fontFamily: karma.f400,
    fontSize: scale(14),
    color: COLORS.gray700,
    marginTop: verticalScale(4),
    textAlign: 'center',
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
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  raised: {
    zIndex: 20,
    elevation: 20,
  },
  dropdown: {
    position: 'absolute',
    top: scale(70),
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(8),
    marginTop: scale(4),
    elevation: 5,
    zIndex: 999,
    paddingVertical: scale(2),
  },
  dropdownItem: {
    paddingVertical: scale(2),
    paddingHorizontal: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  dropdownText: {
    fontSize: scale(14),
    color: COLORS.gray700,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: verticalScale(20),
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray300,
  },
  dividerText: {
    marginHorizontal: scale(8),
    fontSize: scale(12),
    color: COLORS.gray700,
  },
  loginText: {
    textAlign: 'center',
    fontSize: scale(12),
    color: COLORS.gray700,
    marginTop: verticalScale(10),
  },
  loginLink: {
    color: COLORS.red600,
    fontWeight: 'bold',
  },
  genderRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(4),
  },
  genderChip: {
    flex: 1,
    paddingVertical: verticalScale(10),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  genderChipActive: {
    borderColor: COLORS.red600,
    backgroundColor: COLORS.red100,
  },
  genderText: {
    fontSize: scale(14),
    fontFamily: karma.f500,
    color: COLORS.gray700,
  },
  genderTextActive: {
    color: COLORS.red600,
    fontFamily: karma.f600,
  },
  cnicHint: {
    fontSize: scale(11),
    color: COLORS.slate500,
    marginTop: verticalScale(3),
    marginLeft: scale(2),
  },
});