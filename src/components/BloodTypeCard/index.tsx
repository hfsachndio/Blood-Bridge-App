import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Switch} from 'react-native';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';

const BloodTypeCard = ({bloodType, isAvailable, setIsAvailable}: any) => {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.label}>Your Blood Type</Text>
        <View style={styles.row}>
          <Text style={styles.bloodType}>{bloodType || '-'}</Text>
          <Text style={styles.badge}>Verified</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.label}>Availability</Text>
        <View style={styles.row}>
          <Text style={styles.availText}>
            {isAvailable ? 'Available' : 'Unavailable'}
          </Text>
          <Switch value={isAvailable} onValueChange={setIsAvailable} />
        </View>
      </View>
    </View>
  );
}

export default BloodTypeCard

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: scale(16),
    borderRadius: scale(12),
    padding: scale(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(-50),
  },
  label: {
    color: COLORS.white,
    opacity: 0.9,
    fontSize: scale(12),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(4),
  },
  bloodType: {
    fontSize: scale(28),
    color: COLORS.white,
    fontFamily: karma.f500,
  },
  badge: {
    backgroundColor: COLORS.green400,
    color: COLORS.white,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(6),
    fontSize: scale(12),
  },
  right: {
    alignItems: 'flex-end',
  },
  availText: {
    color: COLORS.white,
  },
});
