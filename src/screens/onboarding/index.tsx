import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { images } from '../../assets/png/images';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import Button from '../../components/Button';
import { SafeAreaView } from 'react-native-safe-area-context';

const OnboardingScreen = ({ navigation }: any) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      image: images.hearticon,
      bgColor: '#fee2e2',
      tintColor: COLORS.red600,
      title: 'Save Lives in Emergency',
      description:
        'Connect with patients in need of blood during critical situations. Your donation can save a life.',
    },
    {
      image: images.locationicon,
      bgColor: '#dbeafe',
      tintColor: COLORS.blue600,
      title: 'Find Donors Nearby',
      description:
        'Locate compatible blood donors in your area instantly.',
    },
    {
      image: images.chaticon,
      bgColor: '#dcfce7',
      tintColor: COLORS.green600,
      title: 'Secure Communication',
      description:
        'Chat directly with patients through our encrypted messaging system. Safe and private conversations.',
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigation.replace('RoleSelectionScreen');
    }
  };

  const handleSkip = () => {
    navigation.replace('RoleSelectionScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
      {currentStep < steps.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <View
          style={[
            styles.imageContainer,
            { backgroundColor: currentStepData.bgColor },
          ]}>
          <Image
            source={currentStepData.image}
            style={[styles.image, { tintColor: currentStepData.tintColor }]}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>{currentStepData.title}</Text>

        <Text style={styles.description}>{currentStepData.description}</Text>

        <View style={styles.progressContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep
                  ? styles.activeDot
                  : index < currentStep
                    ? styles.completedDot
                    : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          title={currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
          onPress={handleNext}
        />

        {currentStep > 0 && (
          <Button
            title="Back"
            onPress={() => setCurrentStep(currentStep - 1)}
            backgroundColor={COLORS.white}
            textColor={COLORS.gray700}
            style={{ borderWidth: 1, borderColor: COLORS.gray300 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: scale(24),
    justifyContent: 'space-between',
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: scale(16),
  },
  skipText: {
    color: COLORS.slate500,
    fontSize: scale(16),
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: verticalScale(40),
  },
  imageContainer: {
    padding: scale(30),
    borderRadius: scale(100),
    marginBottom: scale(30),
  },
  image: {
    width: scale(100),
    height: verticalScale(100),
  },
  title: {
    color: COLORS.gray900,
    fontSize: scale(22),
    fontFamily: karma.f700,
    textAlign: 'center',
    marginBottom: verticalScale(12),
  },
  description: {
    color: COLORS.slate600,
    fontSize: scale(16),
    textAlign: 'center',
    marginBottom: verticalScale(24),
    paddingHorizontal: scale(12),
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    height: verticalScale(8),
    borderRadius: scale(4),
    marginHorizontal: scale(4),
  },
  activeDot: {
    width: scale(32),
    backgroundColor: COLORS.red600,
  },
  completedDot: {
    width: scale(8),
    backgroundColor: COLORS.red400,
  },
  inactiveDot: {
    width: scale(8),
    backgroundColor: COLORS.gray300,
  },
  bottom: {
    paddingBottom: verticalScale(24),
    gap: scale(10),
  },
});