import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { COLORS } from '../../../utils/color';
import { karma } from '../../../assets/fonts/fonts';
import { scale, verticalScale } from '../../../utils/globalFunction';
import DonorCard from '../../../components/DonarCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InputField from '../../../components/InputField';
import { images } from '../../../assets/png/images';
import CustomModal from '../../../components/CustomModal';
import {
  getAuth,
  getDonationsCollection,
  getNotificationsCollection,
  getUsersCollection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  db,
  query,
  orderBy,
  limit,
  getDocs,
} from '../../../config/firebase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUser } from '../../../context/UserContext';

interface Coords {
  latitude: number;
  longitude: number;
}

interface Donor {
  id: string;
  uid: string;
  initials: string;
  name: string;
  bloodType: string;
  location: string;
  hospital?: string;
  note?: string;
  coords?: Coords | null;
  distance?: string;
  lastDonation: string;
  verified: boolean;
  available: boolean;
  donationCount: number;
  privacyMasked: boolean;
  phone?: string;
}

const BLOOD_TYPES = ['all', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const SearchScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { authUser, profile } = useUser();

  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBloodTypes, setShowBloodTypes] = useState(false);
  const [unmaskRequests, setUnmaskRequests] = useState<Set<string>>(new Set());
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvedDonations, setApprovedDonations] = useState<Set<string>>(new Set());
  const [donorPhones, setDonorPhones] = useState<Record<string, string>>({});

  // ── Map filter ──────────────────────────────────────────────────────────
  const [centerCoords, setCenterCoords] = useState<Coords | null>(null);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const [activeRadius, setActiveRadius] = useState<number>(10);
  const [isRadiusModalOpen, setRadiusModalOpen] = useState(false);
  const [tempRadius, setTempRadius] = useState<number | 'Custom'>(10);
  const [customRadiusValue, setCustomRadiusValue] = useState<string>('');

  // Read selected location when returning from LocationPickerScreen
  // (route.params updates when LocationPickerScreen calls navigation.navigate('SearchScreen', {...}))
  useEffect(() => {
    const picked = route.params?.selectedLocation as Coords | undefined;
    if (picked?.latitude && picked?.longitude) {
      setCenterCoords(picked);
      setRadiusModalOpen(true);
      // Animate filter pill in
      Animated.spring(filterAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.selectedLocation]);

  const handleClearMapFilter = () => {
    Animated.timing(filterAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setCenterCoords(null);
      // Clear the route param so it doesn't re-apply on next focus
      navigation.setParams({ selectedLocation: undefined });
    });
  };

  // ── Load donations ───────────────────────────────────────────────────────
  const loadDonors = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const donationsRef = getDonationsCollection();
      const donationsQuery = query(donationsRef, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(donationsQuery);
      const myUid = authUser?.uid;

      // Count posts per donor uid for real donationCount
      const donorPostCount: Record<string, number> = {};
      snap.docs.forEach((d: any) => {
        const uid = d.data().uid;
        if (uid) donorPostCount[uid] = (donorPostCount[uid] || 0) + 1;
      });

      const newApproved = new Set<string>();
      const items: Donor[] = [];

      snap.docs.forEach((d: any) => {
        const data: any = d.data();
        if (data.status && data.status !== 'active') return;

        const name: string = data.name || 'User';
        const initials =
          name.split(' ').filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2) || 'U';
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;

        const donor: Donor = {
          id: d.id,
          uid: data.uid || '',
          initials,
          name,
          bloodType: data.bloodType || '-',
          location: data.location || '—',
          hospital: data.hospital,
          note: data.note,
          coords: data.coords
            ? { latitude: data.coords.latitude, longitude: data.coords.longitude }
            : null,
          distance: undefined,
          lastDonation: createdAt ? createdAt.toDateString() : '—',
          verified: true,
          available: data.status === 'active',
          donationCount: donorPostCount[data.uid] || 1,
          privacyMasked: true,
          phone: data.phone || undefined,
        };

        if (myUid && data.contactApprovedFor?.[myUid] === true) {
          newApproved.add(d.id);
        }
        items.push(donor);
      });

      setDonors(items);
      setApprovedDonations(newApproved);

      // Fetch real phones for approved contacts
      if (myUid) {
        const approved: { donorId: string; uid: string }[] = [];
        snap.docs.forEach((d: any) => {
          const data = d.data() as any;
          if (data.contactApprovedFor?.[myUid] === true && data.uid) {
            approved.push({ donorId: d.id, uid: data.uid });
          }
        });
        if (approved.length > 0) {
          const phones: Record<string, string> = {};
          await Promise.all(
            approved.map(async ({ donorId, uid }) => {
              try {
                const userSnap = await getUsersCollection().doc(uid).get();
                const userData = userSnap.exists ? (userSnap.data() as any) : {};
                if (userData?.phone) phones[donorId] = userData.phone;
              } catch (_) { }
            }),
          );
          setDonorPhones(prev => ({ ...prev, ...phones }));
        }
      }
    } catch (e) {
      console.log('Search donations load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authUser?.uid]);

  useEffect(() => { loadDonors(false); }, [loadDonors]);

  const onRefresh = useCallback(() => loadDonors(true), [loadDonors]);

  // ── Contact request ──────────────────────────────────────────────────────
  const handleRequestUnmask = async (donorId: string) => {
    setUnmaskRequests(prev => new Set(prev.add(donorId)));
    try {
      const donor = donors.find(d => d.id === donorId);
      if (!donor?.uid || !authUser?.uid) return;
      const myName = profile?.fullName || 'User';
      await addDoc(getNotificationsCollection(donor.uid), {
        type: 'contact_request',
        title: 'Contact Info Request',
        body: `${myName} wants to see your contact number on your donation post.`,
        fromUserId: authUser.uid,
        fromUserName: myName,
        relatedId: donorId,
        category: 'donation',
        isRead: false,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, 'donations', donorId),
        { contactRequests: arrayUnion(authUser.uid) },
        { merge: true },
      );
    } catch (e) { console.log('[SearchScreen] requestUnmask error:', e); }
  };

  const handleMessage = (donor: Donor) => {
    if (!donor.uid) return;
    navigation.navigate('MessageScreen', { otherUserId: donor.uid, name: donor.name, initials: donor.initials });
  };

  // ── Filtering ────────────────────────────────────────────────────────────
  const auth = getAuth();
  const me = auth.currentUser;

  const filteredDonors = donors
    .filter(d => !(me && d.uid === me.uid))
    .map(d => {
      // Compute and attach distance string
      if (centerCoords && d.coords?.latitude && d.coords?.longitude) {
        const dist = haversine(centerCoords.latitude, centerCoords.longitude, d.coords.latitude, d.coords.longitude);
        return { ...d, distance: `${dist.toFixed(1)} km away`, _dist: dist };
      }
      return { ...d, _dist: undefined };
    })
    .filter(d => {
      const matchBlood =
        bloodTypeFilter === 'all' ||
        d.bloodType.toLowerCase() === bloodTypeFilter.toLowerCase();
      const matchText =
        !searchQuery.trim() ||
        d.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const withinRadius =
        !centerCoords
          ? true
          : (!!d.coords?.latitude && (d as any)._dist <= activeRadius);
      return matchBlood && matchText && withinRadius;
    });

  // ── Animated filter pill ─────────────────────────────────────────────────
  const pillScale = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const pillOpacity = filterAnim;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* ── Fixed header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Donors</Text>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <InputField
            placeholder="Search by name or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={images.searchicon}
          />
        </View>

        {/* Blood type + filter row */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.bloodTypeBtn}
            onPress={() => setShowBloodTypes(v => !v)}>
            <Text style={styles.bloodTypeBtnText}>
              🩸{' '}
              <Text style={{ color: COLORS.red600, fontFamily: karma.f700 }}>
                {bloodTypeFilter === 'all' ? 'All Types' : bloodTypeFilter}
              </Text>
            </Text>
            <Text style={styles.chevron}>{showBloodTypes ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {/* Map filter chip */}
          <TouchableOpacity
            style={[styles.mapChip, centerCoords && styles.mapChipActive]}
            onPress={() => {
              // Auto-clear any existing filter so the old MapView is fully
              // unmounted before a new one is created — avoids "view tag -1" error
              if (centerCoords) {
                filterAnim.setValue(0);
                setCenterCoords(null);
                navigation.setParams({ selectedLocation: undefined });
              }
              // Navigate fresh without passing old coords
              navigation.navigate('LocationPickerScreen', { from: 'Search' });
            }}>
            <Text style={[styles.mapChipText, centerCoords && styles.mapChipTextActive]}>
              {centerCoords ? '📍 Change map filter' : '📍 Filter by map'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Blood type chip row */}
        {showBloodTypes && (
          <View style={styles.bloodTypeChips}>
            {BLOOD_TYPES.map(bt => (
              <TouchableOpacity
                key={bt}
                style={[styles.chip, bloodTypeFilter === bt && styles.chipActive]}
                onPress={() => { setBloodTypeFilter(bt); setShowBloodTypes(false); }}>
                <Text style={[styles.chipText, bloodTypeFilter === bt && styles.chipTextActive]}>
                  {bt === 'all' ? 'All' : bt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Active map filter pill */}
        {centerCoords && (
          <Animated.View style={[styles.filterPill, { opacity: pillOpacity, transform: [{ scale: pillScale }] }]}>
            <View style={styles.filterPillLeft}>
              <View style={styles.filterPillDot} />
              <Text style={styles.filterPillText}>
                Within ~{activeRadius} km of{' '}
                <Text style={{ fontFamily: karma.f600 }}>
                  {centerCoords.latitude.toFixed(3)}°, {centerCoords.longitude.toFixed(3)}°
                </Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.filterPillClear} onPress={handleClearMapFilter}>
              <Text style={styles.filterPillClearText}>✕ Clear</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.red600} />
          <Text style={styles.loadingText}>Loading donors...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDonors}
          keyExtractor={item => item.id}
          renderItem={({ item: donor }) => (
            <DonorCard
              donor={{ ...donor, phone: donorPhones[donor.id] || donor.phone }}
              isUnmaskRequested={(id: string) => unmaskRequests.has(id)}
              onRequestUnmask={handleRequestUnmask}
              isContactApproved={approvedDonations.has(donor.id)}
              onMessagePress={() => handleMessage(donor)}
            />
          )}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Privacy notice */}
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  🔒 Contact details are hidden to protect donor privacy.
                </Text>
              </View>
              {/* Result count */}
              <View style={styles.resultRow}>
                <Text style={styles.resultCount}>
                  <Text style={{ fontFamily: karma.f700, color: COLORS.gray900 }}>
                    {filteredDonors.length}
                  </Text>
                  {' '}donor{filteredDonors.length !== 1 ? 's' : ''} found
                  {centerCoords ? ` within ~${activeRadius} km` : ''}
                </Text>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                  <Text style={styles.refreshBtnText}>↻  Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No donors found</Text>
              <Text style={styles.emptyText}>
                {centerCoords
                  ? `No active donors within ${activeRadius} km of your chosen location.\nTry clearing the map filter or adjusting the blood type.`
                  : 'Pull down to refresh or adjust your filters.'}
              </Text>
              {centerCoords && (
                <TouchableOpacity style={styles.clearFilterBtn} onPress={handleClearMapFilter}>
                  <Text style={styles.clearFilterBtnText}>Clear map filter</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: verticalScale(24) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.red600]}
              tintColor={COLORS.red600}
            />
          }
        />
      )}

      {/* Radius Selection Modal */}
      <CustomModal
        visible={isRadiusModalOpen}
        onClose={() => setRadiusModalOpen(false)}
        title="Select Match Range">
        <Text style={styles.modalText}>
          Choose the distance radius to find donors near the selected location.
        </Text>
        <View style={styles.radiusChips}>
          {[5, 10, 15, 20, 'Custom'].map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, tempRadius === r && styles.chipActive]}
              onPress={() => setTempRadius(r as any)}>
              <Text style={[styles.chipText, tempRadius === r && styles.chipTextActive]}>
                {r === 'Custom' ? 'Custom' : `${r} km`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tempRadius === 'Custom' && (
          <View style={styles.customRadiusRow}>
            <InputField
              placeholder="Enter radius in km (e.g., 25)"
              value={customRadiusValue}
              onChangeText={setCustomRadiusValue}
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => {
            if (tempRadius === 'Custom') {
              const val = parseFloat(customRadiusValue);
              if (!isNaN(val) && val > 0) setActiveRadius(val);
            } else {
              setActiveRadius(tempRadius as number);
            }
            setRadiusModalOpen(false);
          }}>
          <Text style={styles.doneBtnText}>Confirm Range</Text>
        </TouchableOpacity>
      </CustomModal>
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // ── Header ──
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(6),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: scale(22),
    color: COLORS.gray900,
    fontFamily: karma.f700,
    marginBottom: verticalScale(10),
  },
  searchRow: {
    marginBottom: verticalScale(12),
  },
  filterRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: verticalScale(8),
  },
  bloodTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(8),
    backgroundColor: COLORS.white,
  },
  bloodTypeBtnText: {
    fontFamily: karma.f400,
    color: COLORS.gray700,
    fontSize: scale(13),
  },
  chevron: {
    fontSize: scale(10),
    color: COLORS.slate500,
  },
  mapChip: {
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(8),
    backgroundColor: COLORS.white,
    justifyContent: 'center',
  },
  mapChipActive: {
    backgroundColor: COLORS.red100,
    borderColor: COLORS.red400,
  },
  mapChipText: {
    fontSize: scale(12),
    fontFamily: karma.f500,
    color: COLORS.gray700,
  },
  mapChipTextActive: {
    color: COLORS.red600,
    fontFamily: karma.f600,
  },
  bloodTypeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: verticalScale(2),
    marginBottom: verticalScale(4),
  },
  chip: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(5),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(20),
    backgroundColor: COLORS.white,
  },
  chipActive: {
    backgroundColor: COLORS.red600,
    borderColor: COLORS.red600,
  },
  chipText: {
    fontFamily: karma.f500,
    color: COLORS.gray700,
    fontSize: scale(12),
  },
  chipTextActive: {
    color: COLORS.white,
    fontFamily: karma.f600,
  },
  // ── Active filter pill ──
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: COLORS.red400,
    borderRadius: scale(8),
    paddingVertical: verticalScale(7),
    paddingHorizontal: scale(12),
    marginTop: verticalScale(6),
  },
  filterPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    flex: 1,
  },
  filterPillDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: COLORS.red600,
  },
  filterPillText: {
    fontSize: scale(12),
    fontFamily: karma.f400,
    color: COLORS.red600,
    flex: 1,
  },
  filterPillClear: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: scale(4),
    backgroundColor: COLORS.red600,
  },
  filterPillClearText: {
    fontSize: scale(11),
    fontFamily: karma.f600,
    color: COLORS.white,
  },
  // ── List header ──
  listHeader: {
    paddingTop: verticalScale(4),
  },
  noticeBox: {
    backgroundColor: COLORS.yellow400 + '28',
    borderWidth: 1,
    borderColor: COLORS.yellow400,
    margin: scale(14),
    marginBottom: verticalScale(0),
    padding: scale(12),
    borderRadius: scale(8),
  },
  noticeText: {
    fontSize: scale(12),
    color: COLORS.orange600,
    fontFamily: karma.f400,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
  },
  resultCount: {
    fontSize: scale(13),
    color: COLORS.slate500,
    fontFamily: karma.f400,
  },
  refreshBtn: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(6),
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: COLORS.red400,
  },
  refreshBtnText: {
    fontSize: scale(12),
    color: COLORS.red600,
    fontFamily: karma.f600,
  },
  // ── Loading / empty ──
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: verticalScale(12),
  },
  loadingText: {
    fontSize: scale(14),
    color: COLORS.gray700,
    fontFamily: karma.f400,
  },
  emptyBox: {
    paddingTop: verticalScale(60),
    alignItems: 'center',
    paddingHorizontal: scale(32),
    gap: verticalScale(8),
  },
  emptyEmoji: {
    fontSize: scale(36),
    marginBottom: verticalScale(4),
  },
  emptyTitle: {
    fontSize: scale(16),
    color: COLORS.gray900,
    fontFamily: karma.f700,
  },
  emptyText: {
    fontSize: scale(13),
    color: COLORS.slate500,
    fontFamily: karma.f400,
    textAlign: 'center',
    lineHeight: verticalScale(20),
  },
  clearFilterBtn: {
    marginTop: verticalScale(8),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(8),
    backgroundColor: COLORS.red600,
  },
  clearFilterBtnText: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.white,
  },
  // ── Radius Modal ──
  modalText: {
    fontSize: scale(14),
    fontFamily: karma.f400,
    color: COLORS.gray700,
    marginBottom: verticalScale(12),
  },
  radiusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: verticalScale(16),
  },
  customRadiusRow: {
    marginBottom: verticalScale(16),
  },
  doneBtn: {
    backgroundColor: COLORS.red600,
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  doneBtnText: {
    color: COLORS.white,
    fontFamily: karma.f600,
    fontSize: scale(14),
  },
});
