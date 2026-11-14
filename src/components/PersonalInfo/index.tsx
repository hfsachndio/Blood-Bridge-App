import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {COLORS} from '../../utils/color';
import {karma} from '../../assets/fonts/fonts';
import {scale, verticalScale} from '../../utils/globalFunction';
import { images } from '../../assets/png/images';

type Props = {
  dateOfBirth?: string;
  location?: string;
  lastDonation?: string;
};

const PersonalInfo = ({ dateOfBirth, location, lastDonation }: Props) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Personal Information</Text>

      {/* DOB */}
      <View style={styles.row}>
        <Image
          source={images.calendericon}
          style={styles.icon}
        />
        <View>
          <Text style={styles.label}>Date of Birth</Text>
          <Text style={styles.value}>{dateOfBirth || '-'}</Text>
        </View>
      </View>

      {/* Location */}
      <View style={styles.row}>
        <Image
          source={images.locationicon}
          style={styles.icon}
        />
        <View>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>{location || '-'}</Text>
        </View>
      </View>

      {/* Last donation */}
      {/* <View style={styles.row}>
        <Image
          source={images.hearticon}
          style={styles.icon}
        />
        <View>
          <Text style={styles.label}>Last Donation</Text>
          <Text style={styles.value}>{lastDonation || '-'}</Text>
        </View>
      </View> */}
    </View>
  );
};

export default PersonalInfo;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    margin: scale(15),
    paddingHorizontal: scale(15),
    paddingVertical: verticalScale(15),
    borderRadius: scale(12),
  },
  title: {
    fontSize: scale(16),
    fontFamily: karma.f600,
    marginBottom: verticalScale(15),
    color: COLORS.gray900,
  },
  row: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: verticalScale(15),
  },
  icon: {
    width: scale(20),
    height: verticalScale(20),
    tintColor: COLORS.slate500,
  },
  label: {
    color: COLORS.slate500,
    fontSize: scale(12),
    fontFamily: karma.f400,
  },
  value: {
    fontSize: scale(14),
    color: COLORS.gray900,
    fontFamily: karma.f500,
  },
});
