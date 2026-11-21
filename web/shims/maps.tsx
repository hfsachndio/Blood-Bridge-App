// react-native-maps on the web: an OpenStreetMap map (Leaflet) with the methods the location picker uses
// (getCamera, animateToRegion) and onRegionChangeComplete / onPress events.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
const zoomFor = (delta?: number) => Math.max(3, Math.min(18, Math.round(Math.log2(360 / (delta || 0.05)))));

const MapView = forwardRef<any, any>(({ initialRegion, region, style, onRegionChangeComplete, onPress, children }, ref) => {
  const host = useRef<any>(null);
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    const el: HTMLElement | null = host.current;
    if (!el || map.current) return;
    const r = region ?? initialRegion ?? { latitude: 24.8607, longitude: 67.0011, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    const m = L.map(el, { zoomControl: true, attributionControl: true }).setView([r.latitude, r.longitude], zoomFor(r.latitudeDelta));
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    m.on('moveend', () => { const c = m.getCenter(); const b = m.getBounds(); onRegionChangeComplete?.({ latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() }); });
    m.on('click', (e: any) => onPress?.({ nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } } }));
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; };
  }, []);
  useImperativeHandle(ref, () => ({
    getCamera: async () => { const c = map.current!.getCenter(); return { center: { latitude: c.lat, longitude: c.lng }, zoom: map.current!.getZoom() }; },
    animateToRegion: (r: Region, ms = 500) => map.current?.flyTo([r.latitude, r.longitude], zoomFor(r.latitudeDelta), { duration: ms / 1000 }),
    animateCamera: (c: any) => c?.center && map.current?.flyTo([c.center.latitude, c.center.longitude], c.zoom ?? map.current.getZoom()),
  }));
  return <View style={style}><div ref={host} style={{ position: 'absolute', inset: 0 }} />{children}</View>;
});
export const Marker = (_: any) => null;
export const Circle = (_: any) => null;
export default MapView;
