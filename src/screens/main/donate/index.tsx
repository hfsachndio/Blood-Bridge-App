import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Toast from 'react-native-toast-message';
import InputField from '../../../components/InputField';
import Button from '../../../components/Button';
import { images } from '../../../assets/png/images';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import {
  getAuth,
  getDonationsCollection,
  getUsersCollection,
  addDoc,
  getDoc,
  doc,
  serverTimestamp,
  db,
} from '../../../config/firebase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../../context/UserContext';

const DonateScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { profile } = useUser();

  const bloodTypes = useMemo(
    () => ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    [],
  );

  const [showBloodTypes, setShowBloodTypes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [formData, setFormData] = useState({
    bloodType: '',
    location: '',
    hospital: '',
    note: '',
  });

  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // If user manually edits location text, invalidate the picked coords
    if (key === 'location') {
      setCoords(null);
    }
  };

  // When returning from LocationPickerScreen
  useEffect(() => {
    const picked = route.params?.selectedLocation as
      | { latitude: number; longitude: number }
      | undefined;
    if (picked) {
      setCoords(picked);
      const label = `${picked.latitude.toFixed(5)}, ${picked.longitude.toFixed(5)}`;
      setFormData(prev => ({ ...prev, location: label }));
    }
  }, [route.params?.selectedLocation]);

  const handleClearLocation = () => {
    setCoords(null);
    setFormData(prev => ({ ...prev, location: '' }));
    navigation.setParams({ selectedLocation: undefined });
  };

  const onPostDonation = async () => {
    const authInstance = getAuth();
    const user = authInstance.currentUser;

    if (!user) {
      Toast.show({ type: 'error', text1: 'Not logged in', text2: 'Please login first.' });
      return;
    }

    // ── Eligibility gate ──────────────────────────────────────────────────────
    if (profile?.eligibilityOutcome && profile.eligibilityOutcome !== 'eligible') {
      Toast.show({
        type: 'error',
        text1: 'Not Eligible to Donate',
        text2: 'Please complete the eligibility check first.',
      });
      navigation.navigate('EligibilityCheckerScreen');
      return;
    }

    if (!formData.bloodType) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please select a blood type.' });
      return;
    }
    if (!formData.location.trim()) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please enter or pick your location.' });
      return;
    }

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      const userData = (userSnap.exists() ? (userSnap.data() as any) : undefined) || {};

      await addDoc(getDonationsCollection(), {
        uid: user.uid,
        name: userData?.fullName || user.displayName || 'User',
        email: user.email || '',
        phone: userData?.phone || '',
        bloodType: formData.bloodType,
        location: formData.location.trim(),
        hospital: formData.hospital.trim(),
        note: formData.note.trim(),
        coords: coords
          ? { latitude: coords.latitude, longitude: coords.longitude }
          : null,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      Toast.show({ type: 'success', text1: 'Posted!', text2: 'Your donation post is now live.' });
      setFormData({ bloodType: '', location: '', hospital: '', note: '' });
      setCoords(null);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to post', text2: e?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Post a Donation</Text>
          <Text style={styles.subtitle}>Share your details so patients can find you.</Text>
        </View>
        {/* Blood-drop accent */}
        <View style={styles.accentBadge}>
          <Text style={styles.accentEmoji}>🩸</Text>
        </View>
      </View>

      <View style={styles.form}>

        {/* ── Blood Type ── */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Blood Type <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity
            style={[styles.selectBox, formData.bloodType ? styles.selectBoxFilled : null]}
            onPress={() => setShowBloodTypes(!showBloodTypes)}
            activeOpacity={0.7}>
            <Text style={[styles.selectBoxText, !formData.bloodType && styles.selectPlaceholder]}>
              {formData.bloodType || 'Select blood type'}
            </Text>
            <Text style={styles.chevron}>{showBloodTypes ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showBloodTypes && (
            <View style={styles.dropdown}>
              {bloodTypes.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.dropdownItem, formData.bloodType === type && styles.dropdownItemActive]}
                  onPress={() => { updateField('bloodType', type); setShowBloodTypes(false); }}>
                  <Text style={[styles.dropdownText, formData.bloodType === type && styles.dropdownTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Location ── */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location <Text style={styles.required}>*</Text></Text>

          {coords ? (
            /* ── Picked location card ── */
            <View style={styles.pickedCard}>
              <View style={styles.pickedCardLeft}>
                <View style={styles.pinCircle}>
                  <Text style={styles.pinEmoji}>📍</Text>
                </View>
                <View>
                  <Text style={styles.pickedTitle}>Location selected</Text>
                  <Text style={styles.pickedCoords}>
                    {coords.latitude.toFixed(5)}°N, {coords.longitude.toFixed(5)}°E
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearLocation}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Manual input + map picker ── */
            <>
              <InputField
                placeholder="e.g. Clifton, Karachi"
                value={formData.location}
                onChangeText={(val: string) => updateField('location', val)}
                leftIcon={images.locationicon}
              />
              <TouchableOpacity
                style={styles.mapPickerBtn}
                onPress={() =>
                  navigation.navigate('LocationPickerScreen', {
                    from: 'Donate',
                    latitude: undefined,
                    longitude: undefined,
                  })
                }
                activeOpacity={0.75}>
                <Text style={styles.mapPickerIcon}>🗺️</Text>
                <Text style={styles.mapPickerText}>Pick exact location on map</Text>
                <Text style={styles.mapPickerArrow}>→</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Show change-on-map when already picked */}
          {coords && (
            <TouchableOpacity
              style={styles.changeMapBtn}
              onPress={() => {
                handleClearLocation();
                navigation.navigate('LocationPickerScreen', { from: 'Donate' });
              }}
              activeOpacity={0.75}>
              <Text style={styles.changeMapText}>🗺️  Change on map</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Hospital ── */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hospital <Text style={styles.optional}>(optional)</Text></Text>
          <InputField
            placeholder="e.g. Aga Khan Hospital"
            value={formData.hospital}
            onChangeText={(val: string) => updateField('hospital', val)}
            leftIcon={images.hearticon}
          />
        </View>

        {/* ── Note ── */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Note <Text style={styles.optional}>(optional)</Text></Text>
          <InputField
            placeholder="Any extra info for the patient..."
            value={formData.note}
            onChangeText={(val: string) => updateField('note', val)}
            leftIcon={images.infoicon}
          />
        </View>

        {/* ── Submit ── */}
        <Button
          title={loading ? 'Posting...' : 'Post Donation'}
          onPress={onPostDonation}
          style={{ marginTop: verticalScale(10) }}
        />

        <Text style={styles.privacyNote}>
          🔒 Your phone number is hidden until you approve contact requests.
        </Text>
      </View>
    </ScrollView>
  );
};

export default DonateScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    padding: scale(16),
    paddingBottom: verticalScale(40),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(10),
    marginBottom: verticalScale(20),
  },
  title: {
    fontSize: scale(22),
    color: COLORS.gray900,
    fontFamily: karma.f700,
  },
  subtitle: {
    fontSize: scale(12),
    color: COLORS.slate500,
    fontFamily: karma.f400,
    marginTop: verticalScale(2),
  },
  accentBadge: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: COLORS.red100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accentEmoji: {
    fontSize: scale(22),
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: verticalScale(16),
  },
  label: {
    fontSize: scale(13),
    color: COLORS.gray700,
    marginBottom: verticalScale(6),
    fontFamily: karma.f600,
  },
  required: {
    color: COLORS.red600,
  },
  optional: {
    color: COLORS.slate500,
    fontFamily: karma.f400,
    fontSize: scale(11),
  },
  // ── Blood-type select ──
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  selectBoxFilled: {
    borderColor: COLORS.red400,
    backgroundColor: COLORS.red100,
  },
  selectBoxText: {
    fontSize: scale(14),
    fontFamily: karma.f500,
    color: COLORS.gray900,
  },
  selectPlaceholder: {
    color: COLORS.slate500,
    fontFamily: karma.f400,
  },
  chevron: {
    fontSize: scale(11),
    color: COLORS.slate500,
  },
  dropdown: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(10),
    marginTop: scale(4),
    elevation: 6,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.red100,
  },
  dropdownText: {
    fontSize: scale(14),
    color: COLORS.gray700,
    fontFamily: karma.f400,
  },
  dropdownTextActive: {
    color: COLORS.red600,
    fontFamily: karma.f600,
  },
  // ── Map picker button ──
  mapPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(8),
    paddingVertical: verticalScale(11),
    paddingHorizontal: scale(14),
    borderRadius: scale(10),
    borderWidth: 1.5,
    borderColor: COLORS.red400,
    borderStyle: 'dashed',
    backgroundColor: COLORS.red100,
    gap: scale(8),
  },
  mapPickerIcon: {
    fontSize: scale(16),
  },
  mapPickerText: {
    flex: 1,
    fontSize: scale(13),
    fontFamily: karma.f500,
    color: COLORS.red600,
  },
  mapPickerArrow: {
    fontSize: scale(14),
    color: COLORS.red600,
    fontFamily: karma.f600,
  },
  // ── Picked location card ──
  pickedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    borderRadius: scale(10),
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: COLORS.green500,
  },
  pickedCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    flex: 1,
  },
  pinCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: COLORS.green200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinEmoji: {
    fontSize: scale(18),
  },
  pickedTitle: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.green700,
  },
  pickedCoords: {
    fontSize: scale(11),
    fontFamily: karma.f400,
    color: COLORS.green600,
    marginTop: verticalScale(2),
  },
  clearBtn: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: COLORS.green200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: scale(13),
    color: COLORS.green700,
    fontFamily: karma.f700,
  },
  changeMapBtn: {
    marginTop: verticalScale(6),
    alignSelf: 'flex-start',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: COLORS.green500,
    backgroundColor: '#f0fdf4',
  },
  changeMapText: {
    fontSize: scale(12),
    fontFamily: karma.f500,
    color: COLORS.green600,
  },
  privacyNote: {
    marginTop: verticalScale(16),
    fontSize: scale(12),
    fontFamily: karma.f400,
    color: COLORS.slate500,
    textAlign: 'center',
    lineHeight: verticalScale(18),
  },
});
