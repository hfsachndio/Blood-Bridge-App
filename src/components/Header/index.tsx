import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, getDonationsCollection, getUsersCollection, setDoc, updateDoc, getDocs, doc, query, where, serverTimestamp, db } from '../../config/firebase';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import { images } from '../../assets/png/images';
import BloodTypeCard from '../BloodTypeCard';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';

interface HeaderProps {
  hasUnreadNotifications?: boolean;
}

const Header = ({ hasUnreadNotifications = false }: HeaderProps) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { authUser, profile } = useUser();
  const userName = profile?.fullName || authUser?.displayName || 'User';
  const bloodType = profile?.bloodType || '-';
  const [isAvailable, setIsAvailable] = useState<boolean>(profile?.isAvailable ?? true);

  useEffect(() => {
    setIsAvailable(profile?.isAvailable ?? true);
  }, [profile?.isAvailable]);

  const updateAvailability = async (value: boolean) => {
    // When turning ON availability, run eligibility check first
    if (value) {
      const lastOutcome = profile?.eligibilityOutcome;
      if (lastOutcome !== 'eligible') {
        Alert.alert(
          '🩺 Eligibility Check Required',
          'Before enabling availability, please complete a quick health check to ensure you are safe to donate.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Check Now',
              onPress: () => navigation.navigate('EligibilityCheckerScreen' as never),
            },
          ]
        );
        return;
      }
    }

    setIsAvailable(value);
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      // update user profile availability
      await setDoc(
        doc(db, 'users', user.uid),
        { isAvailable: value, updatedAt: serverTimestamp() },
        { merge: true },
      );

      // update donation posts visibility (status)
      const donationsSnap = await getDocs(query(getDonationsCollection(), where('uid', '==', user.uid)));

      await Promise.all(
        donationsSnap.docs.map((d: any) => {
          const data: any = d.data();
          const nextStatus = value ? 'active' : 'inactive';
          if (data.status !== nextStatus) {
            return updateDoc(doc(db, 'donations', d.id), {
              status: nextStatus,
              updatedAt: serverTimestamp(),
            });
          }
          return Promise.resolve();
        })
      );
    } catch (e) {
      console.log('Availability update error:', e);
    }
  };

  return (
    <View style={[styles.headerWrapper, { paddingTop: insets.top + verticalScale(16) }]}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {(userName || 'U').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.username}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton} onPress={() => (navigation as any).navigate('NotificationScreen')}>
          <Image
            source={images.bellicon}
            resizeMode="contain"
            style={styles.bellicon}
            tintColor={COLORS.white}
          />
          {hasUnreadNotifications && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>

      {/* Centered Blood Type Card */}
      <View style={styles.cardContainer}>
        <BloodTypeCard
          bloodType={bloodType}
          isAvailable={isAvailable}
          setIsAvailable={updateAvailability}
        />
      </View>
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: COLORS.red600,
    height: verticalScale(360),
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(20),
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  avatar: {
    width: scale(48),
    height: verticalScale(48),
    borderRadius: scale(24),
    borderWidth: scale(2),
    borderColor: COLORS.white,
  },
  avatarCircle: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    borderWidth: scale(2),
    borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: COLORS.white,
    fontSize: scale(16),
    fontFamily: karma.f700,
  },
  welcome: {
    color: COLORS.white,
    fontSize: scale(12),
    opacity: 0.9,
  },
  username: {
    color: COLORS.white,
    fontSize: scale(16),
    fontFamily: karma.f700,
  },
  bellButton: {
    padding: scale(6),
    position: 'relative',
  },
  bellicon: {
    width: scale(24),
    height: verticalScale(24),
  },
  notificationDot: {
    width: scale(8),
    height: verticalScale(8),
    backgroundColor: COLORS.yellow400,
    borderRadius: scale(4),
    position: 'absolute',
    top: verticalScale(2),
    right: scale(2),
  },
  cardContainer: {
    marginVertical: verticalScale(100),
  },
});