import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, StatusBar } from 'react-native';
import { images } from '../../assets/png/images';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import * as Animatable from 'react-native-animatable';
import { SafeAreaView } from 'react-native-safe-area-context';

const SplashScreen = ({ navigation }: any) => {

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('OnboardingScreen');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.red600} barStyle="dark-content" />
      <Animatable.View
        animation="pulse"
        easing="ease-out"
        iterationCount="infinite"
        style={styles.iconWrapper}>
        <Image source={images.dropleticon} style={styles.icon} />
      </Animatable.View>

      <Text style={styles.title}>Blood Bridge</Text>
      <Text style={styles.subtitle}>Connecting Lives, One Drop at a Time</Text>
    </SafeAreaView>
  );
}

export default SplashScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.red600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: scale(128),
    height: verticalScale(128),
    tintColor: COLORS.white,
  },
  title: {
    color: COLORS.white,
    fontSize: scale(28),
    fontFamily: karma.f600,
    marginTop: verticalScale(30),
    marginBottom: verticalScale(4),
  },
  subtitle: {
    color: COLORS.white,
    fontSize: scale(16),
    textAlign: 'center',
    paddingHorizontal: scale(30),
  },
});
