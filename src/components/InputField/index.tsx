import React from 'react';
import { View, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { scale, verticalScale } from '../../utils/globalFunction';
import { COLORS } from '../../utils/color';

const InputField = ({
  placeholder,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  righttitleColor = COLORS.gray300,         
  onRightIconPress,
  secure = false,
  style,
  inputStyle
}: any) => {
  return (
    <View style={[styles.wrapper, style]}>
      
      {leftIcon && (
        <Image 
          source={leftIcon} 
          style={styles.leftIcon} 
          resizeMode="contain"
          tintColor={COLORS.gray300}
        />
      )}

      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, inputStyle]}
        secureTextEntry={secure}
        placeholderTextColor={COLORS.gray300}
      />

      {rightIcon && (
        <TouchableOpacity style={styles.rightIconContainer} onPress={onRightIconPress}>
          <Image 
            source={rightIcon} 
            style={styles.rightIcon} 
            resizeMode="contain"
            tintColor={righttitleColor}
          />
        </TouchableOpacity>
      )}

    </View>
  );
};

export default InputField;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(10),
    paddingHorizontal: scale(10),
    height: verticalScale(45)
  },
  input: {
    flex: 1,
    fontSize: scale(14),
    color: COLORS.gray900,
  },
  leftIcon: {
    width: scale(20),
    height: verticalScale(20),
    marginRight: scale(8),
  },
  rightIconContainer: {
    paddingHorizontal: scale(5),
  },
  rightIcon: {
    width: scale(20),
    height: verticalScale(20),
  },
});
