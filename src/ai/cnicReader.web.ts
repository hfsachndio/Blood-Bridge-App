/// <reference lib="dom" />
// Web CNIC reader (the app's Vercel build): the same computer-vision pipeline as the website —
// quality check (brightness, contrast, Laplacian sharpness), preprocessing and Tesseract LSTM OCR in the browser.
import { measureQuality, reading, type CnicReading } from './cnicText';

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
let worker: Promise<any> | null = null;
const ocrWorker = () => (worker ??= import('tesseract.js').then(({ createWorker }) =>
  createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: true })));

export async function readCnic(src: string, typedCnic?: string): Promise<CnicReading> {
  const t0 = Date.now();
  const img = await loadImage(src);
  const w = Math.min(900, img.naturalWidth || 900), h = Math.round((img.naturalHeight || 600) * (w / (img.naturalWidth || 900)));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  const g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = 0.299 * px.data[i * 4] + 0.587 * px.data[i * 4 + 1] + 0.114 * px.data[i * 4 + 2];
  const quality = measureQuality(g, w, h);
  let lo = 255, hi = 0; for (const v of g) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < g.length; i++) { const v = ((g[i] - lo) / Math.max(1, hi - lo)) * 255; px.data[i * 4] = px.data[i * 4 + 1] = px.data[i * 4 + 2] = v; }
  ctx.putImageData(px, 0, 0);
  const big = document.createElement('canvas'); big.width = w * 2; big.height = h * 2;
  const b = big.getContext('2d')!; b.imageSmoothingQuality = 'high'; b.drawImage(c, 0, 0, big.width, big.height);
  const { data } = await (await ocrWorker()).recognize(big);
  return reading(data.text, quality, Math.round(data.confidence), typedCnic, t0);
}

/** Re-reads a CNIC photo stored as a data URI (admin re-verify). */
export const readCnicFromDataUri = (dataUri: string, typedCnic?: string) => readCnic(dataUri, typedCnic);
