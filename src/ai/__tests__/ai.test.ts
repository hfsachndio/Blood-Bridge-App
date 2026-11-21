import parity from './donor-parity.json';
import { rankDonors, responseProbability, locate, type DonorInput } from '../donorRank';
import { fixDigits, measureQuality, parseCnicText, qualityFromText } from '../cnicText';

describe('donor-response neural network (same model as the website)', () => {
  it("reproduces scikit-learn's predictions", () => {
    for (const s of parity as { donor: DonorInput; p: number }[]) expect(Math.abs(responseProbability(s.donor) - s.p)).toBeLessThan(1e-5);
  });
  it('ranks compatible, available, approved donors only, most likely responder first', () => {
    const now = new Date().toISOString();
    const users = [
      { uid: 'near', fullName: 'Near', bloodType: 'O-', status: 'approved', location: 'Saddar', totalDonations: 5, lastDonationDate: '2025-01-01', createdAt: '2024-01-01' },
      { uid: 'far', fullName: 'Far', bloodType: 'O-', status: 'approved', location: 'Malir', totalDonations: 0, lastDonationDate: now.slice(0, 10), createdAt: now },
      { uid: 'wrong', fullName: 'Wrong type', bloodType: 'A+', status: 'approved', location: 'Saddar' },
      { uid: 'busy', fullName: 'Unavailable', bloodType: 'O-', status: 'approved', isAvailable: false, location: 'Saddar' },
      { uid: 'pending', fullName: 'Pending', bloodType: 'O-', status: 'pending', location: 'Saddar' },
      { uid: 'me', fullName: 'Requester', bloodType: 'O-', status: 'approved', location: 'Saddar' },
    ];
    const ranked = rankDonors(users, [{ responders: ['near'] }], { uid: 'me', bloodType: 'B+', hospital: 'Civil Hospital Karachi', priority: 'urgent' });
    expect(ranked.map((r) => r.uid)).toEqual(['near', 'far']);
    expect(ranked[0].p).toBeGreaterThan(ranked[1].p);
  });
  it('finds places in free text', () => {
    expect(locate('House 12, Gulshan block 5')?.name).toBe('Gulshan-e-Iqbal');
    expect(locate('somewhere else')).toBeUndefined();
  });
});

describe('CNIC reader', () => {
  it('parses the number, date of birth and name, fixing OCR digit mistakes', () => {
    const r = parseCnicText('PAKISTAN National Identity Card\nName\nAyesha Khan\nIdentity Number 42I01-12345O7-1\nDate of Birth 14.03.1998\nDate of Issue 01.02.2020');
    expect(r).toEqual({ cnic: '42101-1234507-1', dateOfBirth: '1998-03-14', name: 'Ayesha Khan' });
    expect(fixDigits('4O1')).toBe('401');
  });
  it('flags dark, flat or blurry photos and unreadable cards', () => {
    const w = 40, h = 40;
    const dark = new Float32Array(w * h).fill(20);
    expect(measureQuality(dark, w, h).issues).toEqual(expect.arrayContaining(['Photo is too dark', 'Low contrast', 'Photo looks blurry']));
    const sharp = Float32Array.from({ length: w * h }, (_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 230 : 30);
    expect(measureQuality(sharp, w, h).ok).toBe(true);
    expect(qualityFromText('ab').ok).toBe(false);
  });
  it('accepts a bright, pale card but flags glare', () => {
    const w = 60, h = 60;
    const pale = Float32Array.from({ length: w * h }, (_, i) => (i % 10 === 0 ? 40 : 242)); // light green card with dark text
    expect(measureQuality(pale, w, h).issues).not.toContain('Photo is overexposed');
    const glare = Float32Array.from({ length: w * h }, (_, i) => (i % 2 ? 255 : (i % 10 === 0 ? 40 : 200)));
    expect(measureQuality(glare, w, h).issues).toContain('Photo is overexposed');
  });
});
