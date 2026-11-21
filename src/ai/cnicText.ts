// CNIC parsing and photo-quality scoring, shared by the native (ML Kit) and web (Tesseract) readers.
// Same rules as the website (src/lib/ai/cnicVision.ts), written without regex lookbehind for Hermes.

export interface Quality { brightness: number; contrast: number; sharpness: number; ok: boolean; issues: string[] }
export interface CnicReading {
  quality: Quality; text: string; confidence: number;
  cnic: string | null; dateOfBirth: string | null; name: string | null;
  matchesTyped: boolean | null; ms: number;
}

const isDigit = (c?: string) => !!c && c >= '0' && c <= '9';
/** Fixes common OCR confusions next to digits: O/o → 0, l/I/| → 1. */
export function fixDigits(text: string) {
  const ch = text.split('');
  for (let i = 0; i < ch.length; i++) {
    if (!(isDigit(ch[i - 1]) || isDigit(ch[i + 1]))) continue;
    if (ch[i] === 'O' || ch[i] === 'o') ch[i] = '0';
    else if (ch[i] === 'l' || ch[i] === 'I' || ch[i] === '|') ch[i] = '1';
  }
  return ch.join('');
}

/** CNIC number, date of birth and name from OCR text. */
export function parseCnicText(text: string) {
  const fixed = fixDigits(text);
  const m = fixed.match(/(\d{5})\s*[-–—~.]?\s*(\d{7})\s*[-–—~.]?\s*(\d)(?!\d)/);
  const cnic = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  const dates: { iso: string; y: number }[] = [];
  const re = /\b(\d{2})[./-](\d{2})[./-](\d{4})\b/g;
  let d: RegExpExecArray | null;
  while ((d = re.exec(fixed))) dates.push({ iso: `${d[3]}-${d[2]}-${d[1]}`, y: Number(d[3]) });
  const dob = dates.length ? dates.sort((a, b) => a.y - b.y)[0].iso : null; // the oldest date on the card is the birth date
  const nm = text.match(/Name[ \t]*[:\n]?[ \t]*([A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+){0,3})/);
  return { cnic, dateOfBirth: dob, name: nm ? nm[1].trim() : null };
}

/** Brightness and contrast (mean / std of luminance) and sharpness (variance of the 4-neighbour Laplacian). */
export function measureQuality(g: ArrayLike<number>, w: number, h: number): Quality {
  let sum = 0; for (let i = 0; i < g.length; i++) sum += g[i]; const mean = sum / g.length;
  let sq = 0; for (let i = 0; i < g.length; i++) sq += (g[i] - mean) ** 2; const std = Math.sqrt(sq / g.length);
  let ls = 0, ls2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; const lap = g[i - w] + g[i + w] + g[i - 1] + g[i + 1] - 4 * g[i];
    ls += lap; ls2 += lap * lap; n++;
  }
  const sharpness = n ? ls2 / n - (ls / n) ** 2 : 0;
  const issues: string[] = [];
  if (mean < 60) issues.push('Photo is too dark');
  if (mean > 215) issues.push('Photo is overexposed');
  if (std < 25) issues.push('Low contrast');
  if (sharpness < 60) issues.push('Photo looks blurry');
  return { brightness: Math.round(mean), contrast: Math.round(std), sharpness: Math.round(sharpness), ok: issues.length === 0, issues };
}

/** On phones ML Kit gives text but no pixels, so quality is judged from how much of the card it could read. */
export function qualityFromText(text: string): Quality {
  const chars = text.replace(/\s/g, '').length;
  const issues = chars < 25 ? ['Card text is unreadable — retake the photo in good light, flat and in focus'] : [];
  return { brightness: -1, contrast: -1, sharpness: -1, ok: issues.length === 0, issues };
}

export function reading(text: string, quality: Quality, confidence: number, typedCnic: string | undefined, t0: number): CnicReading {
  const parsed = parseCnicText(text);
  const typed = typedCnic && /^\d{5}-\d{7}-\d$/.test(typedCnic) ? typedCnic : null;
  return { quality, text, confidence, ...parsed, matchesTyped: parsed.cnic && typed ? parsed.cnic === typed : null, ms: Date.now() - t0 };
}
