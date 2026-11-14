import React from 'react';
import { getAuth, signOut } from '../../config/firebase';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { COLORS } from '../../utils/color';
import { karma } from '../../assets/fonts/fonts';
import { scale, verticalScale } from '../../utils/globalFunction';
import { images } from '../../assets/png/images';
import CustomModal from '../CustomModal';
import Toast from 'react-native-toast-message';

const MenuOptions = ({ navigation }: any) => {
  const [isPrivacyModalOpen, setPrivacyModalOpen] = React.useState(false);
  const [isHelpModalOpen, setHelpModalOpen] = React.useState(false);

  const menu = [
    { title: 'My Activity & History', icon: images.dropleticon, onPress: () => navigation.navigate('AllHistoryScreen', { tab: 'donation' }) },
    { title: 'Ask BloodBot (AI assistant)', icon: images.chaticon, onPress: () => navigation.navigate('BloodBotScreen') },
    { title: 'Log a Donation 🩸', icon: images.heartfill, onPress: () => navigation.navigate('LogDonationScreen') },
    { title: 'Update Profile & Docs', icon: images.usericon, onPress: () => navigation.navigate('ProfileBuilderScreen') },
    { title: 'Privacy & Security', icon: images.shieldicon, onPress: () => setPrivacyModalOpen(true) },
    { title: 'Help & Support', icon: images.questionicon, onPress: () => setHelpModalOpen(true) },
    { title: 'Log Out', icon: images.logouticon, red: true, onPress: () => onLogout() },
  ];

  const onLogout = () => {
    signOut(getAuth())
      .then(() => {
        Toast.show({
          type: 'success',
          text1: 'Logout Successful! 👋',
          text2: 'See you soon!',
        });
        setTimeout(() => {
          navigation.reset({
            index: 1,
            routes: [
              { name: 'RoleSelectionScreen' as never },
              { name: 'LoginScreen' as never }
            ],
          });
        }, 500);
      })
      .catch(error => {
        console.log('Logout error:', error);
        Toast.show({
          type: 'error',
          text1: 'Logout Failed',
          text2: 'An error occurred while logging out',
        });
      });
  };

  return (
    <View style={styles.card}>
      {menu.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={item.onPress}
          style={[styles.row, item.red && { backgroundColor: COLORS.red100 }]}>
          <View style={styles.left}>
            <Image
              source={item.icon}
              style={[styles.icon, item.red && { tintColor: COLORS.red600 }]}
            />
            <Text style={[styles.title, item.red && { color: COLORS.red600 }]}>
              {item.title}
            </Text>
          </View>

          <Image
            source={images.arrowright}
            style={[styles.arrow, item.red && { tintColor: COLORS.red600 }]}
          />
        </TouchableOpacity>
      ))}

      <CustomModal
        visible={isPrivacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        title="Privacy & Security">
        <Text style={styles.modalText}>
          Your privacy is important to us. Here you can manage your security settings and view our privacy policy.
        </Text>
      </CustomModal>

      <CustomModal
        visible={isHelpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        title="Help & Support">
        <Text style={styles.modalText}>
          Need help? Contact our support team or browse our FAQs to find answers to common questions.
        </Text>
      </CustomModal>
    </View>
  );
};

export default MenuOptions;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    margin: scale(15),
    paddingHorizontal: scale(5),
    paddingVertical: verticalScale(5),
    borderRadius: scale(12),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
    borderRadius: scale(10),
    marginBottom: verticalScale(4),
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  icon: {
    width: scale(20),
    height: verticalScale(20),
    tintColor: COLORS.slate600,
  },
  arrow: {
    width: scale(18),
    height: verticalScale(18),
    tintColor: COLORS.gray300,
  },
  title: {
    fontSize: scale(14),
    color: COLORS.gray900,
    fontFamily: karma.f500,
  },
  modalText: {
    fontSize: scale(14),
    fontFamily: karma.f400,
    color: COLORS.gray700,
    lineHeight: verticalScale(20),
  },
});
