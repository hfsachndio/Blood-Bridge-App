import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import { images } from '../../../assets/png/images';
import { getRequestsCollection, query, orderBy, limit, onSnapshot, db, collection, where, getDocs, doc, getDoc, addDoc, serverTimestamp, setDoc, arrayUnion, getNotificationsCollection } from '../../../config/firebase';
import { useUser } from '../../../context/UserContext';
import CustomModal from '../../../components/CustomModal';
import Button from '../../../components/Button';
import { ActivityIndicator } from 'react-native';

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

const UrgentRequestsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { authUser, profile: myProfile } = useUser();
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeSOS, setActiveSOS] = useState<any>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [requestingContact, setRequestingContact] = useState(false);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const sosUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (sosUnsubRef.current) {
        sosUnsubRef.current();
      }
    };
  }, []);

  const closeModal = () => {
    setUserModalVisible(false);
    if (sosUnsubRef.current) {
      sosUnsubRef.current();
      sosUnsubRef.current = null;
    }
  };

  const openUserDetail = async (requestId: string, uid: string) => {
    if (!uid) return;
    setLoadingUser(true);
    setUserModalVisible(true);
    setUserActivity([]);

    if (sosUnsubRef.current) sosUnsubRef.current();
    sosUnsubRef.current = onSnapshot(doc(db, 'requests', requestId), (snap) => {
      if (snap.exists()) {
        setActiveSOS({ id: snap.id, ...snap.data() });
      }
    });

    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        setSelectedUser({ uid, ...userSnap.data() });
      } else {
        setSelectedUser({ uid, fullName: 'Unknown User' });
      }

      // 2. Fetch Activity History (Donations + SOS)
      const [donSnap, sosSnap] = await Promise.all([
        getDocs(query(collection(db, 'donations'), where('uid', '==', uid))),
        getDocs(query(collection(db, 'requests'), where('uid', '==', uid)))
      ]);

      const donItems = donSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
        type: 'donation',
        date: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : null,
        _ts: d.data().createdAt?.toMillis ? d.data().createdAt.toMillis() : 0
      }));

      const sosItems = sosSnap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
        type: 'sos',
        date: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : null,
        _ts: d.data().createdAt?.toMillis ? d.data().createdAt.toMillis() : 0
      }));

      const combined = [...donItems, ...sosItems].sort((a, b) => b._ts - a._ts);
      setUserActivity(combined);

    } catch (err) {
      console.log('[UrgentRequestsScreen] Fetch detail error:', err);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleRequestContact = async () => {
    if (!selectedUser?.uid || !activeSOS?.id || !authUser?.uid) return;
    setRequestingContact(true);
    try {
      const myName = myProfile?.fullName || 'User';
      const notifRef = getNotificationsCollection(selectedUser.uid);
      await addDoc(notifRef, {
        type: 'contact_request',
        title: 'Contact Info Request',
        body: `${myName} wants to see your contact number for your SOS request in ${activeSOS.location}.`,
        fromUserId: authUser.uid,
        fromUserName: myName,
        relatedId: activeSOS.id,
        category: 'sos',
        isRead: false,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'requests', activeSOS.id),
        { contactRequests: arrayUnion(authUser.uid) },
        { merge: true }
      );

      setActiveSOS((prev: any) => ({
        ...prev,
        contactRequests: [...(prev.contactRequests || []), authUser.uid]
      }));

    } catch (err) {
      console.log('[UrgentRequestsScreen] requestContact error:', err);
    } finally {
      setRequestingContact(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    const reqQuery = query(getRequestsCollection(), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(reqQuery, (snap: any) => {
      if (!snap || !snap.docs) return;
      const meUid = authUser?.uid;
      const items = snap.docs
        .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r: any) => r.status !== 'closed')
        .filter((r: any) => !meUid || r.uid !== meUid)
        .map((r: any) => {
          const createdAt = r.createdAt?.toDate ? r.createdAt.toDate() : null;
          return {
            ...r,
            time: formatTimeAgo(createdAt),
            distance: r.distance || '-',
          };
        });
      setRequests(items);
      setRefreshing(false);
    });

    return unsubscribe;
  }, [authUser?.uid, refreshKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey(prev => prev + 1);
  }, []);

  const onRespond = (req: any) => {
    if (!req?.uid) return;
    navigation.navigate('MessageScreen', {
      otherUserId: req.uid,
      name: req.name,
      initials: req.initials,
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} >
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            source={images.backarrow}
            resizeMode="contain"
            tintColor={COLORS.black}
            style={{ width: scale(35), height: verticalScale(35) }}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Urgent Requests</Text>

        {/* Refresh button on top-right */}
        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={onRefresh}
          activeOpacity={0.7}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: scale(16) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.red600]}
            tintColor={COLORS.red600}
          />
        }>
        {requests.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No urgent requests right now.</Text>
          </View>
        )}
        {requests.map(req => (
          <View key={req.id} style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.bloodTypeBox}>
                <Text style={styles.bloodType}>{req.bloodType}</Text>
              </View>
              <View style={[styles.priorityBadge, req.priority === 'moderate' && { backgroundColor: COLORS.blue700 }]}>
                <Text style={styles.priorityText}>{req.priority}</Text>
              </View>
            </View>

            <Text style={styles.location}>{req.location}</Text>
            {!!req.hospital && <Text style={styles.hospital}>🏥 {req.hospital}</Text>}

            {/* Requester Info Section */}
            <TouchableOpacity
              style={styles.requesterSection}
              onPress={() => openUserDetail(req.id, req.uid)}>
              <View style={styles.requesterAvatar}>
                <Text style={styles.requesterInitials}>{req.initials || '?'}</Text>
              </View>
              <View>
                <Text style={styles.requestedBy}>Requested by</Text>
                <Text style={styles.requesterName}>{req.name || 'Anonymous'}</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.meta}>
              Units needed: {req.unitsNeeded} • {req.time}
            </Text>

            <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond(req)}>
              <Text style={styles.respondText}>Respond</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* User Detail Modal */}
      <CustomModal
        visible={userModalVisible}
        onClose={closeModal}
        title="Requester Details">
        {loadingUser ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.red600} />
          </View>
        ) : (
          <View>
            <View style={styles.modalProfileHeader}>
              <View style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>
                  {selectedUser?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.modalName}>{selectedUser?.fullName}</Text>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{selectedUser?.gender || 'Not specified'}</Text>
              </View>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{selectedUser?.location || 'Not provided'}</Text>
              </View>
            </View>

            {selectedUser?.address && (
              <View style={styles.addressSection}>
                <Text style={styles.infoLabel}>Detailed Address</Text>
                <Text style={styles.infoValue}>{selectedUser.address}</Text>
              </View>
            )}

            {/* Contact Request Section */}
            <View style={styles.contactActionSection}>
              {activeSOS?.contactApprovedFor?.[authUser?.uid] ? (
                <View style={[styles.approvedBox, { marginBottom: verticalScale(16) }]}>
                  <Text style={styles.approvedTitle}>✅ Contact Info Approved</Text>
                  <Text style={styles.phoneNumber}>📞 {selectedUser?.phone || 'No phone set'}</Text>
                </View>
              ) : activeSOS?.contactRequests?.includes(authUser?.uid) ? (
                <View style={styles.pendingBox}>
                  <Text style={styles.pendingText}>⏳ Request Sent. Waiting for approval...</Text>
                </View>
              ) : (
                <Button
                  title={requestingContact ? "Sending..." : "Request Contact Info"}
                  onPress={handleRequestContact}
                  disabled={requestingContact}
                  backgroundColor={COLORS.white}
                  textColor={COLORS.red600}
                  style={styles.contactBtn}
                  icon={images.eyeopen}
                  tintColor={COLORS.red600}
                />
              )}
            </View>

            <Text style={styles.sectionTitle}>Activity History</Text>
            <View style={styles.scrollArea}>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {userActivity.length === 0 ? (
                  <Text style={styles.noHistory}>No previous activity found.</Text>
                ) : (
                  userActivity.map((item, index) => (
                    <View key={item.id} style={[styles.historyItem, index === userActivity.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.historyTop}>
                        <View style={[styles.typeBadge, { backgroundColor: item.type === 'sos' ? COLORS.red100 : COLORS.blue200 }]}>
                          <Text style={[styles.typeText, { color: item.type === 'sos' ? COLORS.red600 : COLORS.blue600 }]}>
                            {item.type === 'sos' ? '🚨 SOS' : '🩸 Donation'}
                          </Text>
                        </View>
                        <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
                      </View>
                      <Text style={styles.historyInfo}>
                        {item.bloodType} blood type at {item.location || item.hospital}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </CustomModal>
    </View>
  );
};

export default UrgentRequestsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  title: {
    fontSize: scale(18),
    color: COLORS.gray900,
    fontFamily: karma.f700,
    flex: 1,
  },
  refreshIconBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: COLORS.red400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: scale(20),
    color: COLORS.red600,
    fontFamily: karma.f700,
  },
  emptyBox: {
    paddingTop: verticalScale(60),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: scale(14),
    color: COLORS.gray700,
    fontFamily: karma.f400,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: scale(12),
    padding: scale(14),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: COLORS.gray300,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  bloodTypeBox: {
    backgroundColor: COLORS.red100,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(8),
  },
  bloodType: {
    color: COLORS.red600,
    fontFamily: karma.f700,
    fontSize: scale(12),
  },
  priorityBadge: {
    backgroundColor: COLORS.blue700,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(8),
  },
  priorityText: {
    color: COLORS.white,
    fontFamily: karma.f600,
    fontSize: scale(12),
    textTransform: 'capitalize',
  },
  location: {
    fontFamily: karma.f600,
    color: COLORS.gray900,
    fontSize: scale(14),
  },
  hospital: {
    fontFamily: karma.f400,
    color: COLORS.gray700,
    fontSize: scale(12),
    marginTop: verticalScale(2),
  },
  meta: {
    fontFamily: karma.f400,
    color: COLORS.gray700,
    fontSize: scale(12),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(10),
  },
  respondBtn: {
    backgroundColor: COLORS.red600,
    paddingVertical: verticalScale(10),
    borderRadius: scale(10),
    alignItems: 'center',
  },
  respondText: {
    color: COLORS.white,
    fontFamily: karma.f700,
    fontSize: scale(14),
  },
  requesterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: '#f8fafc',
    padding: scale(8),
    borderRadius: scale(8),
    marginTop: verticalScale(12),
    marginBottom: verticalScale(2),
  },
  requesterAvatar: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: COLORS.red100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requesterInitials: {
    fontSize: scale(14),
    fontFamily: karma.f700,
    color: COLORS.red600,
  },
  requestedBy: {
    fontSize: scale(10),
    fontFamily: karma.f400,
    color: COLORS.slate500,
  },
  requesterName: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.gray900,
  },
  // Modal Styles
  centered: {
    padding: scale(40),
    alignItems: 'center',
  },
  modalProfileHeader: {
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  modalAvatar: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    backgroundColor: COLORS.red100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  modalAvatarText: {
    fontSize: scale(24),
    fontFamily: karma.f700,
    color: COLORS.red600,
  },
  modalName: {
    fontSize: scale(18),
    fontFamily: karma.f700,
    color: COLORS.gray900,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: verticalScale(16),
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: scale(12),
    borderRadius: scale(10),
  },
  infoLabel: {
    fontSize: scale(11),
    fontFamily: karma.f500,
    color: COLORS.slate500,
    textTransform: 'uppercase',
    marginBottom: verticalScale(2),
  },
  infoValue: {
    fontSize: scale(14),
    fontFamily: karma.f600,
    color: COLORS.gray900,
  },
  addressSection: {
    backgroundColor: '#f1f5f9',
    padding: scale(12),
    borderRadius: scale(10),
    marginBottom: verticalScale(12),
  },
  contactActionSection: {
    marginBottom: verticalScale(24),
  },
  contactBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.red600,
    elevation: 0,
    height: verticalScale(44),
  },
  pendingBox: {
    backgroundColor: COLORS.blue200,
    padding: scale(12),
    borderRadius: scale(10),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.blue700,
  },
  pendingText: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.blue700,
  },
  approvedBox: {
    backgroundColor: '#dcfce7',
    padding: scale(12),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
  },
  approvedTitle: {
    fontSize: scale(12),
    fontFamily: karma.f500,
    color: '#166534',
    marginBottom: verticalScale(2),
  },
  phoneNumber: {
    fontSize: scale(18),
    fontFamily: karma.f700,
    color: '#15803d',
  },
  scrollArea: {
    maxHeight: verticalScale(250),
    backgroundColor: COLORS.white,
    borderRadius: scale(10),
    padding: scale(4),
  },
  sectionTitle: {
    fontSize: scale(15),
    fontFamily: karma.f700,
    color: COLORS.gray900,
    marginBottom: verticalScale(12),
  },
  historyItem: {
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
    paddingHorizontal: scale(8),
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  typeBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: scale(6),
  },
  typeText: {
    fontSize: scale(10),
    fontFamily: karma.f700,
  },
  historyDate: {
    fontSize: scale(11),
    color: COLORS.slate500,
    fontFamily: karma.f400,
  },
  historyInfo: {
    fontSize: scale(13),
    color: COLORS.gray700,
    fontFamily: karma.f500,
  },
  noHistory: {
    fontSize: scale(13),
    fontFamily: karma.f400,
    color: COLORS.slate500,
    textAlign: 'center',
    marginVertical: verticalScale(10),
  },
});
