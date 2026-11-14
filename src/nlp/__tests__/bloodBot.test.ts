/**
 * Tests for BloodBot's NLP pipeline and dialogue manager, using an in-memory data source
 * instead of Firestore. Run with `npm test`.
 */
import { BloodBot, type BotData, type DonorLite } from '../bot';
import { classify } from '../classifier';
import { extractAll } from '../entities';

function fakeData() {
  const created: any[] = [];
  let available = true;
  const donors: DonorLite[] = [
    { uid: 'd1', name: 'Zara Siddiqui', bloodType: 'O-', location: 'Clifton', available: true },
    { uid: 'd2', name: 'Hamza Noor', bloodType: 'B+', location: 'Gulshan-e-Iqbal', available: true },
    { uid: 'd3', name: 'Sana Rauf', bloodType: 'A+', location: 'DHA', available: true },
  ];
  const data: BotData = {
    me: () => ({ uid: 'me', fullName: 'Hafsah Zulfiqar', bloodType: 'O+', status: 'approved', location: 'Saddar', dateOfBirth: '1999-03-10', weight: 56, isAvailable: available }),
    donors: async () => donors,
    openRequests: async () => [{ id: 'r1', uid: 'x', name: 'Ali Raza', bloodType: 'A+', hospital: 'Indus Hospital', unitsNeeded: 2, priority: 'urgent' }],
    createSOS: async (s) => { created.push(s); return { notified: 3 }; },
    setAvailability: async (v) => { available = v; },
  };
  return { data, created, isAvailable: () => available };
}

describe('NLP', () => {
  it('classifies English and Roman Urdu intents', () => {
    expect(classify('I need blood urgently for my father').intent).toBe('create_sos');
    expect(classify('koi O+ donor hai gulshan mein').intent).toBe('find_donors');
    expect(classify('what is the capital of france').intent).toBe('fallback');
  });

  it('extracts entities from a single message', () => {
    const e = extractAll('meri ammi ko 2 bottle AB- chahiye indus hospital mein, critical');
    expect(e.bloodType).toBe('AB-');
    expect(e.units).toBe(2);
    expect(e.place?.name).toBe('Indus Hospital');
    expect(e.urgency).toBe('critical');
  });
});

describe('BloodBot', () => {
  it('fills an SOS from one Roman Urdu sentence and posts after confirmation', async () => {
    const f = fakeData();
    const bot = new BloodBot(f.data);
    const r1 = await bot.reply('meri ammi ko 2 bottle AB- chahiye indus hospital mein, critical');
    expect(r1.text).toMatch(/confirm/i);
    const r2 = await bot.reply('haan bhej do');
    expect(r2.text).toMatch(/SOS posted/);
    expect(f.created[0]).toMatchObject({ bloodType: 'AB-', units: 2, priority: 'critical' });
  });

  it('asks for missing slots one at a time and can be cancelled', async () => {
    const f = fakeData();
    const bot = new BloodBot(f.data);
    expect((await bot.reply('send an sos')).text).toMatch(/blood type/i);
    expect((await bot.reply('B+')).text).toMatch(/hospital or area/i);
    expect((await bot.reply('cancel')).text).toMatch(/cancelled/);
    expect(f.created).toHaveLength(0);
  });

  it('finds only compatible donors', async () => {
    const bot = new BloodBot(fakeData().data);
    const r = await bot.reply('find B+ donors near Gulshan');
    const types = r.donors!.map((d) => d.bloodType);
    expect(types).toContain('B+');
    expect(types).toContain('O-');
    expect(types).not.toContain('A+');
    expect(r.donors![0]!.name).toBe('Hamza N.'); // nearest first, surname masked
  });

  it('answers eligibility questions with numbers from the message', async () => {
    const bot = new BloodBot(fakeData().data);
    expect((await bot.reply("I'm 17, can I donate?")).text).toMatch(/minimum age is \*\*18/);
    expect((await bot.reply('I got a tattoo 2 months ago')).text).toMatch(/6 months/);
    expect((await bot.reply('I weigh 45 kg')).text).toMatch(/below the minimum/);
  });

  it('lists open requests and toggles availability', async () => {
    const f = fakeData();
    const bot = new BloodBot(f.data);
    expect((await bot.reply('show urgent requests')).requests?.[0]?.hospital).toBe('Indus Hospital');
    await bot.reply('mark me unavailable');
    expect(f.isAvailable()).toBe(false);
  });
});
