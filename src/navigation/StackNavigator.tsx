import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUser } from '../context/UserContext';
import SplashScreen from '../screens/splash';
import OnboardingScreen from '../screens/onboarding';
import RoleSelectionScreen from '../screens/auth/roleSelection';
import LoginScreen from '../screens/auth/login';
import SignupScreen from '../screens/auth/signup';
import ForgetPasswordScreen from '../screens/auth/forgetpassword';
import BottomTabs from './BottomTabs';
import MessageScreen from '../screens/main/message';
import NotificationScreen from '../screens/main/notification';
import UrgentRequestsScreen from '../screens/main/urgentRequests';
import AllHistoryScreen from '../screens/main/allHistory';
import LocationPickerScreen from '../screens/main/locationPicker';
import ProfileEditScreen from '../screens/main/profileEdit';
import ProfileBuilderScreen from '../screens/profile_builder';
import StatusScreen from '../screens/status';
import AdminDashboardScreen from '../screens/admin';
import EligibilityCheckerScreen from '../screens/main/eligibilityChecker';
import LogDonationScreen from '../screens/main/logDonation';
import DonationCertificateScreen from '../screens/main/donationCertificate';

const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  const { authUser, profile, loading } = useUser();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!authUser ? (
        <>
          <Stack.Screen name="SplashScreen" component={SplashScreen} />
          <Stack.Screen name="OnboardingScreen" component={OnboardingScreen} />
          <Stack.Screen name="RoleSelectionScreen" component={RoleSelectionScreen} />
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
          <Stack.Screen name="SignupScreen" component={SignupScreen} />
          <Stack.Screen name="ForgetPasswordScreen" component={ForgetPasswordScreen} />
        </>
      ) : profile?.role === 'admin' ? (
        <>
          <Stack.Screen name="AdminDashboardScreen" component={AdminDashboardScreen} />
        </>
      ) : profile?.status === 'approved' ? (
        <>
          <Stack.Screen name="BottomTabs" component={BottomTabs} />
          <Stack.Screen name="MessageScreen" component={MessageScreen} />
          <Stack.Screen name="NotificationScreen" component={NotificationScreen} />
          <Stack.Screen name="UrgentRequestsScreen" component={UrgentRequestsScreen} />
          <Stack.Screen name="AllHistoryScreen" component={AllHistoryScreen} />
          <Stack.Screen name="LocationPickerScreen" component={LocationPickerScreen} />
          <Stack.Screen name="ProfileEditScreen" component={ProfileEditScreen} />
          <Stack.Screen name="ProfileBuilderScreen" component={ProfileBuilderScreen} />
          <Stack.Screen name="EligibilityCheckerScreen" component={EligibilityCheckerScreen} />
          <Stack.Screen name="LogDonationScreen" component={LogDonationScreen} />
          <Stack.Screen name="DonationCertificateScreen" component={DonationCertificateScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="StatusScreen" component={StatusScreen} />
          <Stack.Screen name="ProfileBuilderScreen" component={ProfileBuilderScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default StackNavigator;
