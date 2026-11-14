import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../../utils/color';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { karma } from '../../../assets/fonts/fonts';
import Button from '../../../components/Button';

type LocationPickerRoute = RouteProp<
  {
    LocationPickerScreen: {
      from: 'Donate' | 'Search';
      latitude?: number;
      longitude?: number;
    };
  },
  'LocationPickerScreen'
>;

const DEFAULT_REGION: Region = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const requestAndroidPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'BloodBridge needs your location to pick a point on the map.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch { return false; }
};

const LocationPickerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<LocationPickerRoute>();
  const mapRef = useRef<MapView>(null);

  // ── Use a ref for coords so handleConfirm always reads latest value ──────
  const latestCoord = useRef({ latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude });
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  // Ensure isMounted is false when component unmounts
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [displayLat, setDisplayLat] = useState(DEFAULT_REGION.latitude);
  const [displayLng, setDisplayLng] = useState(DEFAULT_REGION.longitude);
  const [isDragging, setIsDragging] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region>(DEFAULT_REGION);

  // ── Poll map center every 400ms — works even when onRegionChangeComplete
  //    doesn't fire (RN 0.79 New Architecture compatibility issue) ───────────
  const startPolling = useCallback(() => {
    if (pollInterval.current) return;
    pollInterval.current = setInterval(async () => {
      if (!isMounted.current || !mapRef.current) return; // guard: component unmounted
      try {
        const camera = await mapRef.current.getCamera();
        if (!isMounted.current) return; // re-check after await
        if (camera?.center?.latitude && camera?.center?.longitude) {
          const lat = camera.center.latitude;
          const lng = camera.center.longitude;
          if (
            Math.abs(lat - latestCoord.current.latitude) > 0.00001 ||
            Math.abs(lng - latestCoord.current.longitude) > 0.00001
          ) {
            latestCoord.current = { latitude: lat, longitude: lng };
            setDisplayLat(lat);
            setDisplayLng(lng);
            setIsDragging(false);
          }
        }
      } catch (_) { }
    }, 400);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    const init = async () => {
      if (route.params?.latitude && route.params?.longitude) {
        const lat = route.params.latitude;
        const lng = route.params.longitude;
        const r: Region = { latitude: lat, longitude: lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        latestCoord.current = { latitude: lat, longitude: lng };
        setDisplayLat(lat);
        setDisplayLng(lng);
        setInitialRegion(r);
        setMapReady(true);
      } else {
        const granted = await requestAndroidPermission();
        setMapReady(true);
        if (granted) fetchCurrentLocation(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start polling when map is ready
  useEffect(() => {
    if (mapReady) {
      // Small delay to let the map fully initialise
      const t = setTimeout(startPolling, 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  const fetchCurrentLocation = (showErrors: boolean) => {
    setLoading(true);
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        latestCoord.current = { latitude, longitude };
        setDisplayLat(latitude);
        setDisplayLng(longitude);
        const next: Region = { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setInitialRegion(next);
        setLoading(false);
        mapRef.current?.animateToRegion(next, 600);
      },
      err => {
        setLoading(false);
        if (showErrors) Alert.alert('Location error', err.message || 'Could not get your location.');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleUseCurrentLocation = async () => {
    const granted = await requestAndroidPermission();
    if (!granted) {
      Alert.alert('Permission Denied', 'Enable location permission in device settings.');
      return;
    }
    fetchCurrentLocation(true);
  };

  // ── Confirm: directly call getCamera() for the real-time map center ────
  const handleConfirm = async () => {
    try {
      const camera = await mapRef.current?.getCamera();
      const latitude = camera?.center?.latitude ?? latestCoord.current.latitude;
      const longitude = camera?.center?.longitude ?? latestCoord.current.longitude;
      const payload = { latitude, longitude };
      console.log('[LocationPicker] Confirming location:', payload);
      if (route.params?.from === 'Donate') {
        navigation.navigate('DonateScreen', { selectedLocation: payload });
      } else {
        navigation.navigate('SearchScreen', { selectedLocation: payload });
      }
    } catch (e) {
      // fallback to polled ref
      const payload = { ...latestCoord.current };
      console.log('[LocationPicker] Confirming (fallback):', payload);
      if (route.params?.from === 'Donate') {
        navigation.navigate('DonateScreen', { selectedLocation: payload });
      } else {
        navigation.navigate('SearchScreen', { selectedLocation: payload });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Location</Text>
        <Text style={styles.subtitle}>
          🔴 Scroll the map to move the pin · Tap confirm to select
        </Text>
      </View>

      {/* Map + crosshair */}
      <View style={styles.mapWrapper}>
        {mapReady ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <ActivityIndicator size="large" color={COLORS.red600} />
            <Text style={styles.placeholderText}>Loading map…</Text>
          </View>
        )}

        {/* ── Crosshair: fixed center, never blocks map touches ── */}
        <View style={styles.pinContainer} pointerEvents="none">
          {/* The pin lifts when dragging */}
          <View style={[styles.pinBody, isDragging && styles.pinBodyLifted]}>
            <View style={styles.pinCircle} />
            <View style={styles.pinTail} />
          </View>
          {/* Shadow shrinks when pin lifts */}
          <View style={[styles.shadow, isDragging && styles.shadowSmall]} />
        </View>

        {/* "Scroll map" reminder shown when not dragging */}
        {!isDragging && (
          <View style={styles.scrollHint} pointerEvents="none">
            <Text style={styles.scrollHintText}>← Scroll map to move pin →</Text>
          </View>
        )}

        {/* Live coordinate chip */}
        <View style={styles.coordChip} pointerEvents="none">
          <Text style={styles.coordChipText}>
            📍 {displayLat.toFixed(5)},  {displayLng.toFixed(5)}
          </Text>
          {isDragging && <Text style={styles.movingText}> · Moving…</Text>}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.currentLocBtn}
          onPress={handleUseCurrentLocation}
          disabled={loading}>
          <Text style={styles.currentLocText}>
            {loading ? '⏳  Detecting…' : '🎯  Jump to my current location'}
          </Text>
        </TouchableOpacity>

        <Button title="✓  Confirm this location" onPress={handleConfirm} />
      </View>
    </View>
  );
};

export default LocationPickerScreen;

const PIN_COLOR = COLORS.red600;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(10),
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  title: { fontSize: scale(20), fontFamily: karma.f700, color: COLORS.gray900 },
  subtitle: { marginTop: verticalScale(4), fontSize: scale(12), fontFamily: karma.f400, color: COLORS.slate500 },

  mapWrapper: { flex: 1 },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    gap: verticalScale(10),
  },
  placeholderText: { fontSize: scale(13), fontFamily: karma.f400, color: '#6b7280' },

  // ── Pin ──
  pinContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBody: {
    alignItems: 'center',
    // Center the tip of the tail at the exact center of the container
    transform: [{ translateY: -scale(22) }],
  },
  pinBodyLifted: {
    transform: [{ translateY: -scale(30) }],
  },
  pinCircle: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    backgroundColor: PIN_COLOR,
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  pinTail: {
    width: 3,
    height: scale(16),
    backgroundColor: PIN_COLOR,
    borderRadius: 2,
  },
  shadow: {
    position: 'absolute',
    width: scale(14),
    height: scale(7),
    borderRadius: scale(7),
    backgroundColor: 'rgba(0,0,0,0.3)',
    bottom: '50%',
    transform: [{ translateY: scale(3.5) }],
  },
  shadowSmall: {
    width: scale(8),
    height: scale(4),
    backgroundColor: 'rgba(0,0,0,0.15)',
  },

  // ── Overlays ──
  scrollHint: {
    position: 'absolute',
    top: verticalScale(10),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: scale(14),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
  },
  scrollHintText: { color: '#fff', fontSize: scale(12), fontFamily: karma.f500 },

  coordChip: {
    position: 'absolute',
    bottom: verticalScale(10),
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: PIN_COLOR,
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(7),
  },
  coordChipText: { color: '#fff', fontSize: scale(12), fontFamily: karma.f600 },
  movingText: { color: 'rgba(255,255,255,0.7)', fontSize: scale(11), fontFamily: karma.f400 },

  // ── Footer ──
  footer: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    gap: verticalScale(8),
  },
  currentLocBtn: {
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  currentLocText: { fontSize: scale(13), fontFamily: karma.f500, color: COLORS.gray700 },
});
