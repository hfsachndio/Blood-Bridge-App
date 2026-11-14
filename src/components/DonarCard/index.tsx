import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Button from '../Button';
import { COLORS } from '../../utils/color';
import { karma } from '../../assets/fonts/fonts';
import { scale, verticalScale } from '../../utils/globalFunction';
import { images } from '../../assets/png/images';
import PrivacyNotice from '../PrivacyNotice';

interface Donor {
  id: string;
  initials: string;
  name?: string;
  bloodType: string;
  location: string;
  hospital?: string;
  note?: string;
  distance?: string;
  lastDonation: string;
  verified: boolean;
  available: boolean;
  donationCount: number;
  privacyMasked: boolean;
  phone?: string;
}

interface Props {
  donor: Donor;
  isUnmaskRequested: (id: string) => boolean;
  onRequestUnmask: (id: string) => void;
  onMessagePress?: () => void;
  isContactApproved?: boolean;
}

const DonorCard = ({ donor, isUnmaskRequested, onRequestUnmask, onMessagePress, isContactApproved }: Props) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{donor.initials}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName}>{donor.name || `Donor ${donor.initials}`}</Text>

            <View style={styles.bloodBadge}>
              <Text style={styles.bloodBadgeText}>{donor.bloodType}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(7) }}>
            <Image source={images.locationicon} resizeMode='contain' tintColor={COLORS.slate600}
              style={{ width: scale(13), height: verticalScale(13) }} />
            <Text style={styles.locationText}>{donor.location}</Text>
          </View>

          {!!donor.hospital && (
            <Text style={styles.hospitalText}>🏥 {donor.hospital}</Text>
          )}

          {!!donor.distance && (
            <Text style={styles.smallInfo}>
              📍 {donor.distance} | 🩸 {donor.donationCount} donations
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.smallSub}>
              Post Date: {donor.lastDonation}
            </Text>

            {donor.available && (
              <View style={styles.availableBadge}>
                <Text style={styles.availableText}>Available Now</Text>
              </View>
            )}</View>
        </View>
      </View>

      {donor.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Note</Text>
          <Text numberOfLines={2} style={styles.noteText}>
            {donor.note}
          </Text>
        </View>
      ) : null}

      {isContactApproved && donor.phone ? (
        <View style={styles.maskBox}>
          <Text style={styles.maskTitle}>✅ Contact Info Approved</Text>
          <Text style={[styles.maskSub, { color: COLORS.green600, fontFamily: karma.f600, marginTop: 4 }]}>
            📞 {donor.phone}
          </Text>
        </View>
      ) : donor.privacyMasked && !isUnmaskRequested(donor.id) ? (
        <View style={styles.maskBox}>
          <Text style={styles.maskTitle}>Contact details hidden</Text>
          <Text style={styles.maskSub}>
            Request to connect. Donor will choose to respond.
          </Text>

          <Button
            title="Request Contact Info"
            onPress={() => onRequestUnmask(donor.id)}
            backgroundColor={COLORS.white}
            textColor={COLORS.gray700}
            style={styles.maskBtn}
            icon={images.eyeopen}
          />
        </View>
      ) : isUnmaskRequested(donor.id) ? (
        <PrivacyNotice
          title='Request Sent'
          description='Waiting for donor approval. You will be notified when they respond.'
          icon={images.eyeopen}
          tintColor={COLORS.blue700} />
      ) : null}

      <Button
        title="Message"
        icon={images.chaticon}
        tintColor={COLORS.white}
        style={styles.maskBtn}
        onPress={onMessagePress}
      />
    </View>
  );
};

export default DonorCard;

const baseStyles = {
  card: {
    backgroundColor: COLORS.white,
    borderRadius: scale(10),
    padding: scale(16),
    marginBottom: verticalScale(16),
    marginHorizontal: scale(15),
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: verticalScale(8),
  },
  avatar: {
    height: verticalScale(48),
    width: scale(48),
    backgroundColor: COLORS.red100,
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.red600,
    fontFamily: karma.f700,
    fontSize: scale(16),
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: scale(16),
    color: COLORS.gray900,
    fontFamily: karma.f600,
  },
  bloodBadge: {
    backgroundColor: COLORS.red600,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(6),
  },
  bloodBadgeText: {
    color: COLORS.white,
    fontFamily: karma.f700,
    fontSize: scale(12),
  },
  locationText: {
    color: COLORS.slate600,
    fontFamily: karma.f400,
    marginTop: verticalScale(4),
    fontSize: scale(13),
  },
  smallInfo: {
    color: COLORS.slate600,
    // backgroundColor: COLORS.red500,
    fontFamily: karma.f400,
    marginTop: verticalScale(4),
    fontSize: scale(13),
  },
  smallSub: {
    color: COLORS.slate500,
    fontSize: scale(11),
    fontFamily: karma.f300,
  },
  noteBox: {
    marginTop: verticalScale(4),
    padding: scale(8),
    borderRadius: scale(8),
    backgroundColor: COLORS.gray300,
  },
  noteLabel: {
    fontSize: scale(12),
    fontFamily: karma.f600,
    color: COLORS.black,

  },
  noteText: {
    fontSize: scale(11),
    fontFamily: karma.f400,
    color: COLORS.gray700,
  },
  availableBadge: {

    backgroundColor: COLORS.green400 + '22',
    padding: scale(4),
    borderRadius: scale(6),
    alignSelf: 'flex-start',
  },
  availableText: {
    color: COLORS.green600,
    fontSize: scale(10),
    fontFamily: karma.f500,
  },
  maskBox: {
    backgroundColor: COLORS.white,
    // padding: scale(12),
    borderRadius: scale(8),
    marginVertical: verticalScale(6),
  },
  maskTitle: {
    fontSize: scale(12),
    color: COLORS.gray700,
    fontFamily: karma.f600,
  },
  maskSub: {
    fontSize: scale(12),
    color: COLORS.slate500,


    fontFamily: karma.f400,
  },
  maskBtn: {
    padding: scale(10),
    borderWidth: scale(1),
    borderColor: COLORS.gray300,
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
};

const styles = StyleSheet.create(baseStyles as any);