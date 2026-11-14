import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, StatusBar, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DonationHistory, { DonationHistoryItem } from '../../../components/DonationHistory';
import PersonalInfo from '../../../components/PersonalInfo';
import MenuOptions from '../../../components/MenuOptions';
import { COLORS } from '../../../utils/color';
import { karma } from '../../../assets/fonts/fonts';
import { scale, verticalScale } from '../../../utils/globalFunction';
import {
  getAuth,
  getDonationsCollection,
  getRequestsCollection,
  getUsersCollection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  db,
} from '../../../config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PREVIEW_COUNT = 3;

const formatDate = (data: any): string => {
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
  if (!createdAt) return '—';
  const diff = Date.now() - createdAt.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return createdAt.toDateString();
};

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const authUser = useMemo(() => getAuth().currentUser, []);

  const [profile, setProfile] = useState<any>(null);
  const [donations, setDonations] = useState<DonationHistoryItem[]>([]);
  const [sosRequests, setSosRequests] = useState<DonationHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const user = getAuth().currentUser;
    if (!user) return;

    try {
      // User profile
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      setProfile(userSnap.exists() ? (userSnap.data() as any) : null);

      // Donation posts
      // NOTE: .where + .orderBy requires a Firestore composite index.
      // To avoid the index requirement, we fetch with only .where and sort client-side.
      const donSnap = await getDocs(query(getDonationsCollection(), where('uid', '==', user.uid)));

      console.log('[Profile] donation docs found:', donSnap.docs.length);

      const donItems: DonationHistoryItem[] = donSnap.docs
        .map((d: any) => {
          const data: any = d.data();
          return {
            id: d.id,
            type: 'donation' as const,
            date: formatDate(data),
            hospital: data.hospital || data.location || 'Donation Post',
            location: data.location,
            bloodType: data.bloodType,
            status: data.status || 'active',
            _ts: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
          };
        })
        .sort((a: any, b: any) => b._ts - a._ts); // newest first, client-side
      setDonations(donItems);

      // SOS / urgent requests — same fix: no orderBy, sort client-side
      const sosSnap = await getDocs(query(getRequestsCollection(), where('uid', '==', user.uid)));

      console.log('[Profile] SOS docs found:', sosSnap.docs.length);

      const sosItems: DonationHistoryItem[] = sosSnap.docs
        .map((d: any) => {
          const data: any = d.data();
          return {
            id: d.id,
            type: 'sos' as const,
            date: formatDate(data),
            hospital: data.hospital,
            location: data.location || 'SOS Request',
            bloodType: data.bloodType,
            status: data.status || 'open',
            priority: data.priority,
            unitsNeeded: data.unitsNeeded,
            _ts: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
          };
        })
        .sort((a: any, b: any) => b._ts - a._ts); // newest first, client-side
      setSosRequests(sosItems);
    } catch (e: any) {
      console.log('[ProfileScreen] load error:', e?.message || e);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Derived values ─────────────────────────────────────────────────────────
  const displayName = profile?.fullName || authUser?.displayName || 'User';
  const email = profile?.email || authUser?.email || '-';
  const bloodType = profile?.bloodType || '-';
  const location = profile?.location || '-';
  const dob = profile?.dateOfBirth || '-';
  const totalDonations = donations.length;

  const onRefresh = () => {
    loadData(true);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />
      }
    >
      <StatusBar backgroundColor={COLORS.red600} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ProfileEditScreen')}>
            <Text style={{ color: COLORS.white, fontFamily: karma.f600, fontSize: scale(14) }}>Edit ✎</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {(displayName || 'U').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{displayName}</Text>
                {profile?.cnicVerified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ Verified</Text>
                  </View>
                )}
              </View>

              <Text style={styles.email}>{email}</Text>

              <View style={styles.bloodRow}>
                <View style={styles.bloodBadge}>
                  <Text style={styles.bloodText}>{bloodType}</Text>
                </View>
                <Text style={styles.location}>📍 {location}</Text>
              </View>
            </View>
          </View>

          {/* Stats bar */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalDonations}</Text>
              <Text style={styles.statLabel}>Donation Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#ea580c' }]}>{sosRequests.length}</Text>
              <Text style={styles.statLabel}>SOS Requests</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Personal Info ── */}
      <PersonalInfo dateOfBirth={dob} location={location} />

      {/* ── Donation History (My Activity) ── */}
      <View style={{ marginTop: verticalScale(-18) }}>
        <DonationHistory
          donations={donations}
          sosRequests={sosRequests}
          previewCount={PREVIEW_COUNT}
          onViewAll={() =>
            navigation.navigate('AllHistoryScreen', { tab: 'donation' })
          }
          onItemDeleted={loadData}   // refresh after deletion
        />
      </View>

      {/* ── Menu Options ── */}
      <View style={{ marginTop: verticalScale(-18) }}>
        <MenuOptions navigation={navigation} />
      </View>

      <Text style={styles.version}>Blood Bridge v1.0.0</Text>
    </ScrollView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.red600,
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(60),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: scale(20),
    fontFamily: karma.f600,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    marginTop: verticalScale(20),
    borderRadius: scale(15),
    paddingHorizontal: scale(15),
    paddingVertical: verticalScale(15),
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(15),
  },
  avatar: {
    width: scale(70),
    height: verticalScale(70),
    borderRadius: scale(35),
    borderWidth: 2,
    borderColor: COLORS.red100,
  },
  avatarCircle: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    backgroundColor: COLORS.red600,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.red100,
  },
  avatarInitials: {
    color: COLORS.white,
    fontSize: scale(24),
    fontFamily: karma.f700,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    flexWrap: 'wrap',
  },
  name: {
    fontSize: scale(17),
    fontFamily: karma.f600,
    color: COLORS.gray900,
  },
  verifiedBadge: {
    backgroundColor: COLORS.blue500,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(6),
  },
  verifiedText: {
    fontSize: scale(10),
    color: COLORS.blue600,
    fontFamily: karma.f600,
  },
  email: {
    fontSize: scale(12),
    color: COLORS.slate500,
    marginVertical: verticalScale(3),
    fontFamily: karma.f400,
  },
  bloodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  bloodBadge: {
    backgroundColor: COLORS.red600,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: scale(6),
  },
  bloodText: {
    color: COLORS.white,
    fontSize: scale(12),
    fontFamily: karma.f700,
  },
  location: {
    fontSize: scale(12),
    color: COLORS.slate500,
    fontFamily: karma.f400,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: COLORS.gray300,
    marginTop: verticalScale(14),
    paddingTop: verticalScale(12),
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: verticalScale(32),
    backgroundColor: COLORS.gray300,
  },
  statNumber: {
    color: COLORS.red600,
    fontSize: scale(20),
    fontFamily: karma.f700,
  },
  statLabel: {
    color: COLORS.slate500,
    fontSize: scale(10),
    fontFamily: karma.f400,
    textAlign: 'center',
    marginTop: verticalScale(2),
  },
  version: {
    textAlign: 'center',
    color: COLORS.slate500,
    fontSize: scale(12),
    marginVertical: verticalScale(20),
    fontFamily: karma.f400,
  },
});
