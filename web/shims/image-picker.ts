// react-native-image-picker on the web: a file picker that returns the same result shape
// ({ assets: [{ uri, base64, type, fileName, width, height }] }), resized like the native options.
type Options = { maxWidth?: number; maxHeight?: number; quality?: number; includeBase64?: boolean };
function pick(capture: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
async function toAsset(file: File, o: Options) {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const s = Math.min(1, (o.maxWidth ?? 1200) / img.width, (o.maxHeight ?? 1200) / img.height);
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const dataUrl = c.toDataURL('image/jpeg', o.quality ?? 0.7);
  return { uri: dataUrl, base64: dataUrl.split(',')[1], type: 'image/jpeg', fileName: file.name, width: c.width, height: c.height, fileSize: Math.round(dataUrl.length * 0.75) };
}
async function launch(capture: boolean, o: Options = {}, cb?: (r: any) => void) {
  const file = await pick(capture);
  const r = file ? { assets: [await toAsset(file, o)] } : { didCancel: true };
  cb?.(r);
  return r as any;
}
export const launchImageLibrary = (o?: Options, cb?: (r: any) => void) => launch(false, o, cb);
export const launchCamera = (o?: Options, cb?: (r: any) => void) => launch(true, o, cb);
