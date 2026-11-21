// Native CNIC reader: on-device OCR with Google ML Kit, then the shared parser.
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { qualityFromText, reading, type CnicReading } from './cnicText';

export async function readCnic(uri: string, typedCnic?: string): Promise<CnicReading> {
  const t0 = Date.now();
  const result = await TextRecognition.recognize(uri);
  const text = result.text || '';
  return reading(text, qualityFromText(text), text ? 90 : 0, typedCnic, t0);
}

/** Re-reads a CNIC photo stored as a data URI (admin re-verify): written to a temp file for ML Kit. */
export async function readCnicFromDataUri(dataUri: string, typedCnic?: string): Promise<CnicReading> {
  const RNFS = require('react-native-fs');
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const tempPath = `${RNFS.CachesDirectoryPath}/cnic_temp_${Date.now()}.jpg`;
  await RNFS.writeFile(tempPath, base64, 'base64');
  try { return await readCnic(`file://${tempPath}`, typedCnic); } finally { await RNFS.unlink(tempPath).catch(() => {}); }
}
