import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, StatusBar } from 'react-native';
import Header from '../../../components/Header';
import { scale, verticalScale } from '../../../utils/globalFunction';
import SOSSection from '../../../components/SOSSection';
import { COLORS } from '../../../utils/color';
import StatsSection from '../../../components/StatsSection';
import PrivacyNotice from '../../../components/PrivacyNotice';
import TipsCard from '../../../components/TipsCard';
import UrgentRequestsList from '../../../components/UrgentRequestsList';
import { images } from '../../../assets/png/images';
import CustomModal from '../../../components/CustomModal';
import InputField from '../../../components/InputField';
import Button from '../../../components/Button';
import Toast from 'react-native-toast-message';
import { getAuth, getRequestsCollection, getNotificationsCollection, getUsersCollection, addDoc, getDocs, query, orderBy, limit, where, onSnapshot, serverTimestamp } from '../../../config/firebase';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../../../context/UserContext';
import { karma } from '../../../assets/fonts/fonts';

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const { authUser, profile } = useUser();
  const bloodTypes = useMemo(() => ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'], []);

  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [showBloodTypes, setShowBloodTypes] = useState(false);
  const [sending, setSending] = useState(false);

  const [sosForm, setSosForm] = useState({
    bloodType: '',
    location: '',
    hospital: '',
    unitsNeeded: '',
    priority: 'moderate' as 'urgent' | 'moderate',
  });

  const updateSosField = (key: string, value: string) => {
    setSosForm(prev => ({ ...prev, [key]: value }));
  };

  const [urgentRequests, setUrgentRequests] = useState<any[]>([]);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return '-';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} h ago`;
    const days = Math.floor(hrs / 24);
    return `${days} d ago`;
  };

  useEffect(() => {
    const reqQuery = query(getRequestsCollection(), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(reqQuery, (snap: any) => {
      if (!snap || !snap.docs) return;
      const meUid = authUser?.uid;
      const items = snap.docs
        .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r: any) => r.status !== 'closed')
        .filter((r: any) => !meUid || r.uid !== meUid)
        .slice(0, 3)
        .map((r: any) => {
          const createdAt = r.createdAt?.toDate ? r.createdAt.toDate() : null;
          return {
            ...r,
            time: formatTimeAgo(createdAt),
            distance: r.distance || '-',
          };
        });
      setUrgentRequests(items);
    });
    return unsubscribe;
  }, [authUser?.uid]);

  useEffect(() => {
    if (!authUser?.uid) return;
    const notifQuery = query(getNotificationsCollection(authUser.uid), where('isRead', '==', false), limit(1));
    const unsub = onSnapshot(notifQuery, (snap: any) => {
      setHasUnreadNotifications(!snap.empty);
    });
    return unsub;
  }, [authUser?.uid]);

  const openSosModal = () => {
    setSosModalVisible(true);
  };

  const onSubmitSos = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    if (!sosForm.bloodType) {
      Toast.show({ type: 'error', text1: 'Validation', text2: 'Select blood type' });
      return;
    }
    if (!sosForm.location.trim()) {
      Toast.show({ type: 'error', text1: 'Validation', text2: 'Enter location' });
      return;
    }
    const units = parseInt(sosForm.unitsNeeded, 10);
    if (!units || units < 1) {
      Toast.show({ type: 'error', text1: 'Validation', text2: 'Enter units needed' });
      return;
    }
    if (units > 10) {
      Toast.show({ type: 'error', text1: 'Validation', text2: 'Maximum 10 units per request' });
      return;
    }

    const requesterName = profile?.fullName || user.displayName || 'User';
    const initials =
      requesterName
        .split(' ')
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .slice(0, 2) || 'U';

    setSending(true);
    try {
      await addDoc(getRequestsCollection(), {
        uid: user.uid,
        name: requesterName,
        initials,
        bloodType: sosForm.bloodType,
        location: sosForm.location.trim(),
        hospital: sosForm.hospital.trim(),
        unitsNeeded: units,
        priority: sosForm.priority,
        status: 'open',
        createdAt: serverTimestamp(),
      });

      Toast.show({ type: 'success', text1: 'SOS Sent', text2: 'Urgent request posted.' });
      setSosModalVisible(false);
      setSosForm(prev => ({ ...prev, bloodType: '', location: '', hospital: '', unitsNeeded: '', priority: 'moderate' }));

      // ── Send in-app notification to all other users ─────────────────────
      try {
        const usersSnap = await getDocs(getUsersCollection());
        const batchPromises: Promise<any>[] = [];
        usersSnap.docs.forEach((userDoc: any) => {
          const userData = userDoc.data() as any;
          if (userData.uid && userData.uid !== user.uid) {
            batchPromises.push(
              addDoc(getNotificationsCollection(userData.uid), {
                type: 'sos',
                title: '🚨 Urgent Blood Request',
                body: `${requesterName} needs ${sosForm.bloodType} blood at ${sosForm.location}. ${units} units required.`,
                fromUserId: user.uid,
                fromUserName: requesterName,
                isRead: false,
                createdAt: serverTimestamp(),
              }),
            );
          }
        });
        await Promise.allSettled(batchPromises);
      } catch (notifError) {
        console.log('[HomeScreen] SOS notify error:', notifError);
      }
    } catch (e: any) {
      console.log('SOS create error:', e);
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message || 'Try again' });
    } finally {
      setSending(false);
    }
  };

  const onViewAllRequests = () => navigation.navigate('UrgentRequestsScreen');
  const onRespondRequest = (req: any) => {
    if (!req?.uid) return;
    navigation.navigate('MessageScreen', {
      otherUserId: req.uid,
      name: req.name,
      initials: req.initials,
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}

      <StatusBar backgroundColor={COLORS.red600} barStyle="dark-content" />
      <Header hasUnreadNotifications={hasUnreadNotifications} />

      <View style={styles.mainContent}>
        <SOSSection onPressSend={openSosModal} />
        <StatsSection
          totalDonations={profile?.totalDonations || 0}
          livesSaved={(profile?.totalDonations || 0) * 3}
        />
        <PrivacyNotice
          title='Your Privacy is Protected'
          description={`Your contact detail remain hidden until you choose to
share them with a patient.`}
          icon={images.shieldicon}
          tintColor={COLORS.blue700} />
        <UrgentRequestsList
          urgentRequests={urgentRequests}
          onViewAll={onViewAllRequests}
          onRespond={onRespondRequest}
        />
        <TipsCard />
      </View>

      <CustomModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        title="Send SOS Alert">
        <View>
          <Text style={styles.modalLabel}>Blood Type</Text>
          <InputField
            placeholder="Select"
            value={sosForm.bloodType}
            onChangeText={() => { }}
            leftIcon={images.dropleticon}
            rightIcon={images.downarrow}
            onRightIconPress={() => setShowBloodTypes(!showBloodTypes)}
          />
          {showBloodTypes && (
            <View style={styles.dropdown}>
              {bloodTypes.map((type, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.dropdownItem}
                  onPress={() => {
                    updateSosField('bloodType', type);
                    setShowBloodTypes(false);
                  }}>
                  <Text style={styles.dropdownText}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.modalLabel}>Location</Text>
          <InputField
            placeholder="e.g. Clifton, Karachi"
            value={sosForm.location}
            onChangeText={(val: any) => updateSosField('location', val)}
            leftIcon={images.locationicon}
          />

          <Text style={styles.modalLabel}>Hospital / Place (optional)</Text>
          <InputField
            placeholder="e.g. Aga Khan Hospital"
            value={sosForm.hospital}
            onChangeText={(val: any) => updateSosField('hospital', val)}
            leftIcon={images.hearticon}
          />

          <Text style={styles.modalLabel}>Units Needed</Text>
          <InputField
            placeholder="e.g. 2"
            value={sosForm.unitsNeeded}
            onChangeText={(val: any) => updateSosField('unitsNeeded', val)}
            leftIcon={images.infoicon}
          />

          <Text style={styles.modalLabel}>Urgency</Text>
          <View style={styles.priorityRow}>
            {(['urgent', 'moderate'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.priorityChip, sosForm.priority === p && styles.priorityChipActive]}
                onPress={() => updateSosField('priority', p)}>
                <Text style={[styles.priorityText, sosForm.priority === p && styles.priorityTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title={sending ? 'Sending...' : 'Post Urgent Request'}
            onPress={onSubmitSos}
            style={{ marginTop: verticalScale(12) }}
          />
        </View>
      </CustomModal>
    </ScrollView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mainContent: {
    paddingHorizontal: scale(16),
    marginTop: verticalScale(-90),
    paddingBottom: verticalScale(20),
  },
  modalLabel: {
    fontSize: scale(12),
    color: COLORS.gray700,
    marginVertical: verticalScale(2),
    fontFamily: karma.f500,
  },
  dropdown: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(8),
    marginTop: scale(2),
    // paddingVertical: scale(2),
    // maxHeight: verticalScale(200),
  },
  dropdownItem: {
    paddingVertical: scale(5),
    paddingHorizontal: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  dropdownText: {
    fontSize: scale(12),
    color: COLORS.gray700,
    fontFamily: karma.f400,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(4),
  },
  priorityChip: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  priorityChipActive: {
    borderColor: COLORS.red600,
    backgroundColor: COLORS.red100,
  },
  priorityText: {
    fontSize: scale(12),
    fontFamily: karma.f600,
    color: COLORS.gray700,
    textTransform: 'capitalize',
  },
  priorityTextActive: {
    color: COLORS.red600,
  },
});
