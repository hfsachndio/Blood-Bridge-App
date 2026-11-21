import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Image, View } from 'react-native';
import { scale, verticalScale } from '../../utils/globalFunction';
import { COLORS } from '../../utils/color';
import { karma } from '../../assets/fonts/fonts';

const Button = ({
  title,
  onPress,
  backgroundColor = COLORS.red600,
  textColor = COLORS.white,
  icon,
  tintColor,
  iconStyle = {},
  style = {},
}: any) => {
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor }, style]}
      onPress={onPress}
    >
      <View style={styles.row}>
        {icon && (
          <Image
            source={icon}
            style={[styles.icon, iconStyle]}
            tintColor={tintColor}
            resizeMode="contain"
          />
        )}

        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default Button;

const styles = StyleSheet.create({
  button: {
    // minHeight (not a fixed height) so the label never spills out on short screens
    minHeight: Math.max(verticalScale(46), 44),
    paddingVertical: verticalScale(6),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(14),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8), // space between icon and text
  },
  icon: {
    width: scale(20),
    height: scale(20),
  },
  text: {
    fontSize: scale(18),
    fontFamily: karma.f600,
  },
});
