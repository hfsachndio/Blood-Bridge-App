import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { db, collection, query, where, getDocs, doc, getDoc, orderBy, addDoc, serverTimestamp, setDoc, arrayUnion, getNotificationsCollection, onSnapshot } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import CustomModal from '../CustomModal';
import Button from '../Button';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import { COLORS } from '../../utils/color';
import { images } from '../../assets/png/images';

const UrgentRequestsList = ({ urgentRequests, onViewAll, onRespond }: any) => {
  const { authUser, profile: myProfile } = useUser();
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

    // 1. Setup real-time listener for the SOS request
    if (sosUnsubRef.current) sosUnsubRef.current();
    sosUnsubRef.current = onSnapshot(doc(db, 'requests', requestId), (snap) => {
      if (snap.exists()) {
        setActiveSOS({ id: snap.id, ...snap.data() });
      }
    });

    try {
      // 1. Fetch User Profile
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
      console.log('[UrgentRequestsList] Fetch detail error:', err);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleRequestContact = async () => {
    if (!selectedUser?.uid || !activeSOS?.id || !authUser?.uid) return;
    setRequestingContact(true);
    try {
      const myName = myProfile?.fullName || 'User';
      // 1. Send Notification
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

      // 2. Update SOS Doc
      await setDoc(
        doc(db, 'requests', activeSOS.id),
        { contactRequests: arrayUnion(authUser.uid) },
        { merge: true }
      );

      // 3. Update local state
      setActiveSOS((prev: any) => ({
        ...prev,
        contactRequests: [...(prev.contactRequests || []), authUser.uid]
      }));

    } catch (err) {
      console.log('[UrgentRequestsList] requestContact error:', err);
    } finally {
      setRequestingContact(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return (
    <View style={{ marginBottom: verticalScale(20) }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Urgent Requests Nearby</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {urgentRequests.map((req: any) => (
        <View key={req.id} style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.leftRow}>
              <View style={styles.bloodTypeBox}>
                <Text style={styles.bloodType}>{req.bloodType}</Text>
              </View>

              <View>
                <Text style={styles.location}>{req.location}</Text>
                <View style={styles.infoRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(3) }}>
                    <Image
                      source={images.locationicon}
                      resizeMode="contain"
                      tintColor={COLORS.gray700}
                      style={{ width: scale(14), height: verticalScale(14) }}
                    />
                    <Text style={{ fontSize: scale(12), fontFamily: karma.f500, color: COLORS.gray700 }}>
                      {req.hospital || '-'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(3) }}>
                    <Image
                      source={images.clockicon}
                      resizeMode="contain"
                      tintColor={COLORS.gray700}
                      style={{ width: scale(14), height: verticalScale(14) }}
                    />
                    <Text style={{ fontSize: scale(12), fontFamily: karma.f500, color: COLORS.gray700 }}>
                      {req.time || '-'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.priority,
                req.priority === 'critical' || req.priority === 'urgent'
                  ? styles.urgent
                  : styles.moderate,
              ]}>
              <Text style={styles.priorityText}>{req.priority}</Text>
            </View>
          </View>

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

          <View style={styles.bottomRow}>
            <Text style={styles.units}>Units needed: {req.unitsNeeded}</Text>

            <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond?.(req)}>
              <Text style={styles.respondText}>Respond</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

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
                  title={requestingContact ? "Sending Request..." : "Request Contact Info"}
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
                        {item.bloodType} blood type --- at {item.location || item.hospital}
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

export default UrgentRequestsList;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },
  title: {
    fontSize: scale(16),
    fontFamily: karma.f600,
    color: COLORS.black,
  },
  viewAll: {
    fontSize: scale(13),
    fontFamily: karma.f400,
    color: COLORS.red600,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: scale(14),
    borderRadius: scale(10),
    borderLeftWidth: scale(4),
    borderLeftColor: COLORS.red600,
    marginBottom: verticalScale(12),
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  leftRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  bloodTypeBox: {
    backgroundColor: COLORS.red100,
    paddingHorizontal: scale(8),
    height: verticalScale(30),
    justifyContent: 'center',
    borderRadius: scale(6),
  },
  bloodType: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.red600,
  },
  location: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.gray900,
  },
  infoRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  info: {
    fontSize: scale(12),
    fontFamily: karma.f400,
    color: COLORS.slate600,
  },
  priority: {
    height: verticalScale(22),
    paddingHorizontal: verticalScale(8),
    borderRadius: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityText: {
    fontSize: scale(12),
    fontFamily: karma.f500,
    color: COLORS.white,
    textTransform: 'capitalize',
    marginTop: verticalScale(3.3),
  },
  urgent: {
    backgroundColor: COLORS.red600,
  },
  moderate: {
    backgroundColor: COLORS.blue700,
  },
  requesterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: '#f8fafc',
    padding: scale(8),
    borderRadius: scale(8),
    marginBottom: verticalScale(12),
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
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  units: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.gray700,
  },
  respondBtn: {
    backgroundColor: COLORS.red600,
    height: verticalScale(30),
    width: scale(105),
    borderRadius: scale(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  respondText: {
    fontSize: scale(14),
    fontFamily: karma.f600,
    color: COLORS.white,
    marginTop: verticalScale(3),
  },
});