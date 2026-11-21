// @react-native-community/geolocation on the web → the browser Geolocation API.
const Geolocation = {
  getCurrentPosition(ok: (p: any) => void, err?: (e: any) => void, opts?: any) {
    if (!navigator.geolocation) { err?.({ code: 2, message: 'Location is not available in this browser' }); return; }
    navigator.geolocation.getCurrentPosition(ok, err, opts);
  },
  watchPosition(ok: (p: any) => void, err?: (e: any) => void, opts?: any) { return navigator.geolocation?.watchPosition(ok, err, opts) ?? 0; },
  clearWatch(id: number) { navigator.geolocation?.clearWatch(id); },
  requestAuthorization() {},
  setRNConfiguration() {},
};
export default Geolocation;
