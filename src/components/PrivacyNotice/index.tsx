import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';

const PrivacyNotice = ({
  icon,
  title,
  description,
  tintColor,
  backgroundColor = COLORS.blue500,
  borderColor = COLORS.blue200,
  titleColor = COLORS.blue900,
  descriptionColor = COLORS.blue700,
  centerDescription = false, // ✅ new prop
}: any) => {
  return (
    <View style={[styles.card, { backgroundColor, borderColor }]}>
      <Image
        source={icon}
        resizeMode="contain"
        tintColor={tintColor}
        style={{ width: scale(20), height: verticalScale(20) }}
      />

      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={[styles.title, { color: titleColor }]}>
          {title}
        </Text>

        <Text
          style={[
            styles.desc,
            { color: descriptionColor },
            centerDescription && styles.centerText, // ✅ conditional style
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
};


export default PrivacyNotice;

const styles = StyleSheet.create({
  card: {
    borderWidth: scale(1),
    padding: scale(12),
    borderRadius: scale(10),
    flexDirection: 'row',
    marginBottom: verticalScale(18),
  },
  title: {
    fontSize: scale(14),
    fontFamily: karma.f600,
  },
  desc: {
    fontSize: scale(12),
    fontFamily: karma.f400,
    marginTop: verticalScale(1),
  },
  centerText: {
    textAlign: 'center',
  },
});
