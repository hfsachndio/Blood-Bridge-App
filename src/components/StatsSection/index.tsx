import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scale, verticalScale } from '../../utils/globalFunction';
import { COLORS } from '../../utils/color';
import { karma } from '../../assets/fonts/fonts';

interface Props {
  livesSaved: number;
  totalDonations: number;
}

const StatsSection = ({ livesSaved, totalDonations }: Props) => {
  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.number}>{livesSaved}</Text>
        <Text style={styles.label}>Lives Potentially Saved</Text>
        <Text style={styles.note}>1 donation = up to 3 lives</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.number}>{totalDonations}</Text>
        <Text style={styles.label}>Confirmed Donations</Text>
        <Text style={styles.note}>Logged & verified records</Text>
      </View>
    </View>
  );
};

export default StatsSection;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: scale(12), marginBottom: verticalScale(16) },
  card: { flex: 1, backgroundColor: COLORS.background, padding: scale(16), borderRadius: scale(12), alignItems: 'center', borderColor: COLORS.gray300, borderWidth: scale(1.5) },
  number: { color: COLORS.red600, fontSize: scale(22), fontFamily: karma.f600 },
  label: { fontSize: scale(12), color: COLORS.gray700, fontFamily: karma.f400, marginTop: verticalScale(2) },
  note: { fontSize: scale(9), color: COLORS.slate400, fontFamily: karma.f400, marginTop: verticalScale(1), textAlign: 'center' },
});
