import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import { COLORS } from '../../utils/color';

const TipsCard = () => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>💡 Donation Tip</Text>
      <Text style={styles.desc}>
        Drink plenty of water before donating blood to ensure a smooth donation
        process.
      </Text>
    </View>
  );
};

export default TipsCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.violet500,
    padding: scale(16),
    borderRadius: scale(12),
    borderWidth: scale(1),
    borderColor: COLORS.violet200,
    marginBottom: verticalScale(20),
  },
  title: {
    fontSize: scale(15),
    fontFamily: karma.f600,
    color: COLORS.gray900,
    marginBottom: verticalScale(6),
  },
  desc: {
    fontSize: scale(13),
    fontFamily: karma.f400,
    color: COLORS.gray700,
  },
});
