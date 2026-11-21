import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, StatusBar, BackHandler, Platform } from 'react-native';
import { getAuth, signInWithEmailAndPassword, getDoc, doc, db, signOut } from '../../../config/firebase';
import Toast from 'react-native-toast-message';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { images } from '../../../assets/png/images';
import Button from '../../../components/Button';
import InputField from '../../../components/InputField';

const LoginScreen = ({ route, navigation }: any) => {
  const role = route?.params?.role || 'user';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (!navigation.canGoBack()) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'RoleSelectionScreen' as never }],
        });
        return true;
      }
      return false;
    };

    if (Platform.OS === 'web') return; // no hardware back button in the browser
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [navigation]);

  const handleSignUp = () => {
    navigation.navigate('SignupScreen');
  };

  const onLogin = async () => {
    const authInstance = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(authInstance, email, password);

      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const actualRole = userDoc.exists() ? (userDoc.data() as any)?.role || 'user' : 'user';

      if (role === 'admin' && actualRole !== 'admin') {
        await signOut(authInstance);
        Toast.show({
          type: 'error',
          text1: 'Access Denied',
          text2: `You lack admin privileges. (Role found: ${actualRole})`,
        });
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Login Successful! 🎉',
        text2: 'Welcome back.',
      });
    } catch (error: any) {
      if (email === '' || password === '') {
        Toast.show({
          type: 'error',
          text1: 'Login Failed!',
          text2: 'Please enter your email and password first!',
        });
        console.log(error);
      }
      if (error.code === 'auth/invalid-email') {
        Toast.show({
          type: 'error',
          text1: 'Login Failed!',
          text2: 'That email address is invalid!',
        });
        console.log(error);
      }
      if (error.code === 'auth/invalid-credential') {
        Toast.show({
          type: 'error',
          text1: 'Login Failed!',
          text2: 'Wrong email or password!',
        });
        console.log(error);
      }
    }
  };

  const forgetPassword = () => {
    navigation.navigate('ForgetPasswordScreen');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'RoleSelectionScreen' as never }],
            });
          }
        }}>
        <Image
          source={images.backarrow}
          style={styles.backIcon}
          tintColor={COLORS.gray900}
        />
      </TouchableOpacity>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Image
            source={images.heartfill}
            style={styles.heartImage}
            resizeMode="contain"
            tintColor={COLORS.white}
          />
        </View>
        <Text style={styles.title}>Welcome to Blood Bridge</Text>
        <Text style={styles.subtitle}>Sign in to connect and save lives</Text>
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <InputField
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secure={!showPassword}
            leftIcon={images.lockicon}
            rightIcon={showPassword ? images.eyeopen : images.eyeclose}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity onPress={forgetPassword}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <Button
          title="Sign In"
          onPress={onLogin}
          style={{ marginTop: verticalScale(20) }}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.line} />
        </View>
      </View>

      {role === 'user' && (
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            Don't have an account?{' '}
            <Text style={styles.signupLink} onPress={handleSignUp}>
              Sign Up
            </Text>
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    padding: scale(24),
  },
  backButton: {
    position: 'absolute',
    top: verticalScale(20),
    left: scale(20),
    zIndex: 10,
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: scale(24),
    height: scale(24),
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
  forgotText: {
    fontSize: scale(12),
    color: COLORS.red600,
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
    color: COLORS.gray700,
    fontSize: scale(12),
  },
  signupContainer: {
    alignItems: 'center',
    marginVertical: verticalScale(20),
  },
  signupText: {
    fontSize: scale(12),
    color: COLORS.gray700,
  },
  signupLink: {
    color: COLORS.red600,
    fontWeight: 'bold',
  },
});
