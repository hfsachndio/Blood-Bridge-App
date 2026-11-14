import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Image} from 'react-native';
import {COLORS} from '../../utils/color';
import {scale, verticalScale} from '../../utils/globalFunction';
import {karma} from '../../assets/fonts/fonts';
import {images} from '../../assets/png/images';
import * as Animatable from 'react-native-animatable';

const SOSSection = ({ onPressSend }: { onPressSend?: () => void }) =>{
  return (
    <View style={styles.card}>
      <View style={{flex: 1}}>
        <View style={styles.row}>
          <Image
            source={images.infoicon}
            resizeMode="contain"
            tintColor={COLORS.white}
            style={{width: scale(24), height: verticalScale(24)}}
          />
          <Text style={styles.title}>Emergency SOS</Text>
        </View>

        <Text style={styles.subtitle}>
          Need blood urgently? Alert nearby donors instantly
        </Text>

        <TouchableOpacity style={styles.button} onPress={onPressSend}>
          <Text style={styles.buttonText}>Send SOS Alert</Text>
        </TouchableOpacity>
      </View>

      <Animatable.View
        animation="pulse"
        easing="ease-out"
        iterationCount="infinite"
        style={styles.iconWrapper}>
        <Image
          source={images.heartfill}
          resizeMode="contain"
          tintColor={COLORS.white}
          style={{width: scale(34), height: verticalScale(34)}}
        />
      </Animatable.View>
    </View>
  );
}

export default SOSSection

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.red500,
    borderRadius: scale(12),
    padding: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  title: {
    color: COLORS.white,
    fontSize: scale(16),
    fontFamily: karma.f500,
  },
  subtitle: {
    color: COLORS.white,
    opacity: 0.8,
    marginTop: verticalScale(4),
    marginBottom: verticalScale(12),
  },
  button: {
    width: scale(120),
    height: verticalScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: scale(6),
  },
  buttonText: {
    fontSize: scale(14),
    color: COLORS.red600,
    fontFamily: karma.f500,
  },
  iconWrapper: {
    width: scale(60),
    height: verticalScale(60),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(30),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(20),
  },
});
