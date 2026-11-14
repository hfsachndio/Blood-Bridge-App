export type RootStackParamList = {
  SplashScreen: undefined;
  OnboardingScreen: undefined;
  LoginScreen: undefined;
  SignupScreen: undefined;
  ForgetPasswordScreen: undefined;
  HomeScreen: undefined;
  SearchScreen: undefined;
  ChatScreen: undefined;
  DonateScreen: undefined;
  ProfileScreen: undefined;
  BottomTabs: undefined
  MessageScreen: undefined
  NotificationScreen: undefined
  BloodBotScreen: undefined
  LocationPickerScreen: {
    from: 'Donate' | 'Search';
    latitude?: number;
    longitude?: number;
    label?: string;
  } | undefined;
};