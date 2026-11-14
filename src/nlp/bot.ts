/**
 * BloodBot dialogue manager (mobile).
 * Combines the TF-IDF intent classifier with entity extraction, keeps conversation state for
 * multi-turn tasks (SOS slot filling, donor-search follow-ups) and acts on live app data through
 * an injected `BotData` source (Firestore in the app, an in-memory fake in tests).
 */
import { BLOOD_TYPES, CAN_RECEIVE_FROM, canDonateTo, distanceKm, findPlace, fmtKm, isCompatible, nearestBloodBanks, type BloodType, type Place } from './blood';
import { checkEligibility, daysUntilNextDonation, RULES } from '../utils/eligibility';
import { classify, type Intent } from './classifier';
import { extractAll, type Entities } from './entities';
import { normalize } from './text';

export type Priority = 'critical' | 'urgent' | 'normal';

export interface BotUser {
  uid: string;
  fullName: string;
  bloodType?: string;
  status?: string;
  location?: string;
  dateOfBirth?: string;
  weight?: number;
  lastDonationDate?: string;
  totalDonations?: number;
  isAvailable?: boolean;
}
export interface DonorLite { uid: string; name: string; bloodType: string; location?: string; lat?: number; lng?: number; available: boolean; lastDonationDate?: string }
export interface RequestLite { id: string; uid: string; name: string; bloodType: string; hospital: string; location?: string; unitsNeeded: number; priority: string }

/** Everything the bot needs from the app. Implemented with Firestore in `firebaseData.ts`. */
export interface BotData {
  me(): BotUser | null;
  donors(): Promise<DonorLite[]>;
  openRequests(): Promise<RequestLite[]>;
  createSOS(input: { bloodType: BloodType; place: Place; units: number; priority: Priority }): Promise<{ notified: number }>;
  setAvailability(available: boolean): Promise<void>;
}

export interface BotLink { label: string; screen: string; params?: Record<string, unknown> }
export interface DonorCard { uid: string; name: string; bloodType: string; area: string; km?: string; available: boolean; readyNow: boolean }
export interface RequestCard { id: string; uid: string; name: string; bloodType: string; hospital: string; units: number; priority: string }
export interface BotReply {
  text: string;
  chips?: string[];
  links?: BotLink[];
  donors?: DonorCard[];
  requests?: RequestCard[];
  debug?: { intent: string; confidence: number; entities: Entities };
}

type Pending =
  | { task: 'sos'; slots: { bloodType?: BloodType; place?: Place; units?: number; urgency?: Priority }; asked?: string }
  | { task: 'find'; place?: Place }
  | null;

/** Keyword rules that sharpen the statistical classifier on very specific medical topics. */
const RULES_KW: [RegExp, Intent][] = [
  [/\b(dizzy|weak|faint|tired|chakkar)\b/, 'aftercare'],
  [/\b(tattoo|piercing|pierced)\b/, 'elig_tattoo'],
  [/\b(pregnan\w*|breastfeed\w*|hamla)\b/, 'elig_pregnancy'],
  [/\b(transfusion)\b/, 'elig_transfusion'],
  [/\b(surgery|operation|operated)\b/, 'elig_surgery'],
  [/\b(fever|bukhar|flu|covid|sick|ill|infection)\b/, 'elig_illness'],
  [/\b(antibiotic\w*|medicine|medication|tablets?|dawai)\b/, 'elig_medication'],
  [/\bblood ?bank\w*\b/, 'blood_bank'],
  [/\b(sos|emergency request|urgent request)\b/, 'create_sos'],
];

const firstName = (n: string) => n.split(' ')[0];
const mask = (n: string) => { const [a, b] = n.split(' '); return b ? `${a} ${b[0]}.` : a; };
const isBT = (s?: string): s is BloodType => !!s && (BLOOD_TYPES as readonly string[]).includes(s);
const ELIG = 'EligibilityCheckerScreen';

export class BloodBot {
  private pending: Pending = null;
  constructor(private data: BotData) {}

  greeting(): BotReply {
    const me = this.data.me();
    return {
      text: `Hi${me ? ' ' + firstName(me.fullName) : ''}! I'm **BloodBot**. I understand English and Roman Urdu. I can find compatible donors, post an SOS, check if you can donate, and answer blood donation questions.`,
      chips: ['Find B+ donors near Gulshan', 'I need 2 units O- at Jinnah Hospital', 'Can I donate after a tattoo?', 'When can I donate next?'],
    };
  }

  async reply(input: string): Promise<BotReply> {
    const text = input.trim();
    if (!text) return { text: 'Type a question or tap one of the suggestions.' };
    const e = extractAll(text);
    const norm = normalize(text);

    if (this.pending) {
      if (/^(cancel|stop|never mind|nevermind|rehne do|chhoro)\b/.test(norm) || (e.no && this.pending.task === 'sos' && this.pending.asked === 'confirm')) {
        this.pending = null;
        return { text: "Okay, I've cancelled that. Anything else?", chips: ['Find donors', 'Nearest blood bank'] };
      }
      if (this.pending.task === 'sos') return this.continueSos(e, text);
      if (this.pending.task === 'find' && e.bloodType) { const place = e.place ?? this.pending.place; this.pending = null; return this.findDonors(e.bloodType, place); }
    }

    let { intent, confidence } = classify(text);
    const kw = RULES_KW.find(([re]) => re.test(norm));
    if (kw && (intent === 'fallback' || intent === 'eligibility' || confidence < 0.45)) intent = kw[1];
    if (intent === 'fallback' && e.bloodType) intent = /\b(give|receive|compatible|to)\b/.test(norm) ? 'compatibility' : 'find_donors';
    if ((intent === 'eligibility' || intent === 'fallback') && e.age !== undefined) intent = 'elig_age';
    else if ((intent === 'eligibility' || intent === 'fallback') && e.weightKg !== undefined) intent = 'elig_weight';
    const out = await this.handle(intent as Intent | 'fallback', e, text);
    out.debug = { intent, confidence: Math.round(confidence * 100) / 100, entities: e };
    return out;
  }

  private async handle(intent: Intent | 'fallback', e: Entities, text: string): Promise<BotReply> {
    const me = this.data.me();
    switch (intent) {
      case 'greet': return this.greeting();
      case 'thanks': return { text: "You're welcome! Every donation can save up to three lives. 💙", chips: ['Show urgent requests', 'When can I donate next?'] };
      case 'bye': return { text: 'Allah Hafiz! Stay safe, and thank you for being part of Blood Bridge.' };
      case 'identity': return { text: "I'm BloodBot, Blood Bridge's assistant. I run fully on your phone using natural-language processing: an intent classifier plus entity recognition for blood types, places, units and dates." };
      case 'help': return { text: 'Here\'s what I can do:\n• **Find donors**: "find O- donors near Clifton"\n• **Post an SOS**: "need 2 units B+ at Aga Khan, urgent"\n• **Eligibility**: "I\'m 17, can I donate?", "tattoo 2 months ago"\n• **Compatibility**: "who can donate to AB-?"\n• **Your status**: "when can I donate next?"\n• **Blood banks**: "nearest blood bank to Saddar"', chips: ['Find donors', 'Send an SOS', 'Am I eligible?'] };

      case 'find_donors': {
        if (!e.bloodType) { this.pending = { task: 'find', ...(e.place ? { place: e.place } : {}) }; return { text: 'Which blood type does the patient need?', chips: [...BLOOD_TYPES] }; }
        return this.findDonors(e.bloodType, e.place);
      }
      case 'create_sos': {
        if (!me || me.status !== 'approved') return { text: 'You need a verified account to post an SOS. Please complete your profile first.' };
        this.pending = { task: 'sos', slots: { ...(e.bloodType ? { bloodType: e.bloodType } : {}), ...(e.place ? { place: e.place } : {}), ...(e.units ? { units: e.units } : {}), ...(e.urgency ? { urgency: e.urgency } : {}) } };
        return this.continueSos({} as Entities, text);
      }
      case 'open_requests': return this.openRequests();
      case 'compatibility': {
        const bt = e.bloodType ?? (isBT(me?.bloodType) ? me!.bloodType as BloodType : undefined);
        if (!bt) return { text: 'Tell me a blood type, e.g. "who can donate to B+?"', chips: ['Who can donate to AB-?', 'Universal donor?'] };
        if (/universal donor/.test(normalize(text))) return { text: '**O-** is the universal red-cell donor: it can be given to every blood type. **AB+** is the universal recipient.' };
        return { text: `**${bt}** patients can receive from: ${CAN_RECEIVE_FROM[bt].join(', ')}.\n**${bt}** donors can give to: ${canDonateTo(bt).join(', ')}.`, chips: [`Find ${bt} donors`, 'Universal donor?'] };
      }
      case 'blood_bank': {
        const from = e.place ?? findPlace(me?.location) ?? findPlace('Saddar')!;
        const list = nearestBloodBanks(from);
        return { text: `Nearest blood banks to **${from.name}**:\n${list.map((b, i) => `${i + 1}. ${b.name} · ${fmtKm(b.km)}`).join('\n')}\nCall ahead to confirm stock for the blood type you need.` };
      }

      case 'eligibility': {
        if (!me?.dateOfBirth) return { text: `The basics: age **${RULES.MIN_AGE}–${RULES.MAX_AGE}**, weight at least **${RULES.MIN_WEIGHT_KG} kg**, feeling well, and **${RULES.MIN_DAYS_BETWEEN_DONATIONS} days** since your last whole-blood donation. Take the full check for a personal answer.`, links: [{ label: 'Open eligibility checker', screen: ELIG }] };
        const r = checkEligibility({ dateOfBirth: me.dateOfBirth, weight: me.weight ?? 0, ...(me.lastDonationDate ? { lastDonationDate: me.lastDonationDate } : {}), hasFever: false, hasIllness: false, hadSurgeryRecently: false, isOnMedication: false, hadTattooOrPiercing: false, isPregnantOrBreastfeeding: false, hadBloodTransfusion: false });
        return { text: `Based on your profile: **${r.title}**\n${r.message}${r.nextEligibleDate ? `\nNext eligible date: **${r.nextEligibleDate}**.` : ''}\nThe health questions aren't part of your profile, so please confirm them in the checker.`, links: [{ label: 'Answer health questions', screen: ELIG }] };
      }
      case 'elig_age': {
        if (e.age !== undefined) {
          if (e.age < RULES.MIN_AGE) return { text: `At **${e.age}** you can't donate yet. The minimum age is **${RULES.MIN_AGE}**. You can still help by sharing requests with family and friends. 💪` };
          if (e.age > RULES.MAX_AGE) return { text: `At **${e.age}**, donors above ${RULES.MAX_AGE} need a doctor's clearance first.` };
          return { text: `Age **${e.age}** is within the allowed range (${RULES.MIN_AGE}–${RULES.MAX_AGE}). ✅ Weight and health also matter.`, links: [{ label: 'Full eligibility check', screen: ELIG }] };
        }
        return { text: `Donors must be **${RULES.MIN_AGE}–${RULES.MAX_AGE}** years old. Above ${RULES.MAX_AGE}, a doctor's clearance is required.` };
      }
      case 'elig_weight': {
        if (e.weightKg !== undefined) return e.weightKg >= RULES.MIN_WEIGHT_KG ? { text: `**${e.weightKg} kg** meets the minimum of ${RULES.MIN_WEIGHT_KG} kg. ✅` } : { text: `**${e.weightKg} kg** is below the minimum of **${RULES.MIN_WEIGHT_KG} kg**, so donating isn't safe for you right now.` };
        return { text: `You need to weigh at least **${RULES.MIN_WEIGHT_KG} kg** to donate whole blood safely.` };
      }
      case 'elig_tattoo': return this.deferral(e, 180, 'a tattoo or piercing', '6 months');
      case 'elig_surgery': return this.deferral(e, 180, 'surgery', '6 months');
      case 'elig_transfusion': return this.deferral(e, 365, 'a blood transfusion', '12 months');
      case 'elig_medication': return { text: "Some medicines affect eligibility (for example antibiotics, blood thinners and acne medication). It's a **medical review** case: check with your doctor before donating.", links: [{ label: 'Eligibility checker', screen: ELIG }] };
      case 'elig_illness': return { text: "Please don't donate while you have a **fever, flu or an active infection**. Wait until you've been well for at least 7 days, and 14 days after finishing antibiotics. 🤒" };
      case 'elig_pregnancy': return { text: 'You **cannot donate while pregnant or breastfeeding**. Most guidelines suggest waiting at least 6 months after delivery and after you stop breastfeeding.' };
      case 'elig_interval': {
        if (e.daysSinceDonation !== undefined) {
          const left = RULES.MIN_DAYS_BETWEEN_DONATIONS - e.daysSinceDonation;
          return left > 0 ? { text: `You donated about **${e.daysSinceDonation} days** ago. Please wait **${left} more days** (whole blood needs ${RULES.MIN_DAYS_BETWEEN_DONATIONS} days between donations).` } : { text: `It's been **${e.daysSinceDonation} days**, more than the ${RULES.MIN_DAYS_BETWEEN_DONATIONS}-day gap, so you can donate again. ✅` };
        }
        return { text: `Whole blood: once every **${RULES.MIN_DAYS_BETWEEN_DONATIONS} days** (about 3 months).`, chips: ['When can I donate next?'] };
      }
      case 'before_donation': return { text: 'Before donating:\n• Sleep well the night before\n• Eat a healthy meal 2–3 hours before\n• Drink an extra 500 ml of water\n• Bring your CNIC\n• Wear sleeves that roll up easily' };
      case 'process': return { text: 'The donation itself takes **8–10 minutes** (about 45 minutes including registration and a mini check-up). About **450 ml** is collected. Rest and have juice for 10–15 minutes afterwards.' };
      case 'aftercare': return { text: 'After donating:\n• Rest 10–15 minutes and have a snack\n• Drink plenty of fluids for 24 hours\n• Skip heavy exercise for the day\n• Keep the bandage on for a few hours\n• Feeling dizzy? Lie down and raise your feet. 🧃' };
      case 'my_status': {
        if (!me) return { text: 'Log in to see your donation status.' };
        const left = daysUntilNextDonation(me.lastDonationDate);
        return { text: `**${me.fullName}** · ${me.bloodType ?? 'blood type not set'} · ${me.status === 'approved' ? 'verified ✅' : me.status}\nDonations logged: **${me.totalDonations ?? 0}**\n${me.lastDonationDate ? `Last donation: **${me.lastDonationDate}**. ` : ''}${left > 0 ? `You can donate again in **${left} days**.` : 'You can donate now. 🩸'}`, links: [{ label: 'Donation history', screen: 'AllHistoryScreen', params: { tab: 'donation' } }] };
      }
      case 'points': return { text: 'You earn **100 points** per donation post and **150 points** per confirmed donation. Badges: 🩸 First Drop (1), 💉 Life Saver (3), 🦸 Blood Hero (5), 🏆 Champion (10), 👑 Legend (20).', links: [{ label: 'Leaderboard', screen: 'BottomTabs', params: { screen: 'LeaderboardScreen' } }] };
      case 'privacy': return { text: 'Your phone number stays **hidden** until you approve a contact request. People reach you through in-app chat, and only CNIC-verified users can post or respond.' };
      case 'availability_on': if (me) { await this.data.setAvailability(true); return { text: "Done. You're now **available**, and you'll get SOS alerts. ✅" }; } return { text: 'Please log in first.' };
      case 'availability_off': if (me) { await this.data.setAvailability(false); return { text: "Done. You're **unavailable**, so you won't get SOS alerts until you turn it back on." }; } return { text: 'Please log in first.' };
      case 'log_donation': return { text: 'Great, thank you! 🩸 Log it to update your history, earn 150 points and get a certificate.', links: [{ label: 'Log a donation', screen: 'LogDonationScreen' }] };
      default:
        return { text: "Sorry, I didn't quite get that. Try asking about donors, an SOS, eligibility or blood banks.", chips: ['What can you do?', 'Find donors near me', 'Can I donate?'] };
    }
  }

  private deferral(e: Entities, days: number, what: string, label: string): BotReply {
    if (e.daysSinceDonation !== undefined) {
      const left = days - e.daysSinceDonation;
      return left > 0
        ? { text: `After ${what}, you need to wait **${label}**. You're about **${left} days** away from being eligible.` }
        : { text: `It's been more than ${label} since ${what}, so that's no longer a reason to wait. ✅`, links: [{ label: 'Full eligibility check', screen: ELIG }] };
    }
    return { text: `After ${what}, please wait **${label}** before donating. How long ago was it? (e.g. "3 months ago")` };
  }

  private async findDonors(bt: BloodType, place?: Place): Promise<BotReply> {
    const me = this.data.me();
    const from = place ?? findPlace(me?.location);
    const all = await this.data.donors();
    const seen = new Set<string>();
    const ranked = all
      .filter((d) => d.uid !== me?.uid && isBT(d.bloodType) && isCompatible(d.bloodType, bt))
      .map((d) => {
        const known = d.lat !== undefined && d.lng !== undefined ? { lat: d.lat, lng: d.lng } : findPlace(d.location);
        return { d, km: from && known ? distanceKm(from, known) : undefined };
      })
      .sort((a, b) => Number(b.d.available) - Number(a.d.available) || (a.km ?? 999) - (b.km ?? 999))
      .filter(({ d }) => (seen.has(d.uid) ? false : (seen.add(d.uid), true)))
      .slice(0, 5);
    const where = from ? ` near **${from.name}**` : '';
    if (!ranked.length) return { text: `I couldn't find compatible donors for **${bt}**${where}. Post an SOS so every donor gets alerted.`, chips: [`Send SOS for ${bt}`] };
    return {
      text: `Found **${ranked.length} compatible donors** for **${bt}**${where} (exact ${bt} and other compatible types):`,
      donors: ranked.map(({ d, km }) => ({ uid: d.uid, name: mask(d.name), bloodType: d.bloodType, area: d.location ?? '', ...(km !== undefined ? { km: fmtKm(km) } : {}), available: d.available, readyNow: daysUntilNextDonation(d.lastDonationDate) === 0 })),
      chips: [`Send SOS for ${bt}`],
      links: [{ label: 'Open donor search', screen: 'BottomTabs', params: { screen: 'SearchScreen' } }],
    };
  }

  private async openRequests(): Promise<BotReply> {
    const me = this.data.me();
    const myBT = isBT(me?.bloodType) ? (me!.bloodType as BloodType) : undefined;
    const list = (await this.data.openRequests())
      .filter((r) => r.uid !== me?.uid && (!myBT || (isBT(r.bloodType) && isCompatible(myBT, r.bloodType))))
      .slice(0, 4);
    if (!list.length) return { text: 'No open requests match your blood type right now. 🙏' };
    return {
      text: myBT ? `Open requests you can help with as **${myBT}**:` : 'Latest open requests:',
      requests: list.map((r) => ({ id: r.id, uid: r.uid, name: mask(r.name), bloodType: r.bloodType, hospital: r.hospital || r.location || '', units: r.unitsNeeded, priority: r.priority })),
      links: [{ label: 'All requests', screen: 'UrgentRequestsScreen' }],
    };
  }

  private async continueSos(e: Entities, raw: string): Promise<BotReply> {
    const p = this.pending as Extract<Pending, { task: 'sos' }>;
    const s = p.slots;
    if (e.bloodType) s.bloodType = e.bloodType;
    if (e.place) s.place = e.place;
    if (e.units) s.units = e.units;
    else if (p.asked === 'units') { const n = parseInt(raw, 10); if (n > 0 && n <= 10) s.units = n; }
    if (e.urgency) s.urgency = e.urgency;
    else if (p.asked === 'urgency') { const t = normalize(raw); s.urgency = /crit/.test(t) ? 'critical' : /normal|not/.test(t) ? 'normal' : 'urgent'; }

    if (p.asked === 'confirm' && e.yes) {
      this.pending = null;
      const { notified } = await this.data.createSOS({ bloodType: s.bloodType!, place: s.place!, units: s.units!, priority: s.urgency! });
      return { text: `🚨 **SOS posted.** ${s.units} unit(s) of **${s.bloodType}** at **${s.place!.name}**. I alerted **${notified} donors**. You'll get a notification and a chat when someone responds.`, links: [{ label: 'View urgent requests', screen: 'UrgentRequestsScreen' }] };
    }
    if (!s.bloodType) { p.asked = 'bloodType'; return { text: 'Which blood type is needed?', chips: [...BLOOD_TYPES] }; }
    if (!s.place) { p.asked = 'place'; return { text: 'Which hospital or area? (e.g. Aga Khan, Jinnah Hospital, Gulshan)', chips: ['Aga Khan University Hospital', 'Jinnah Postgraduate Medical Centre', 'Civil Hospital Karachi', 'Indus Hospital'] }; }
    if (!s.units) { p.asked = 'units'; return { text: 'How many units (bags) are needed?', chips: ['1 unit', '2 units', '3 units', '4 units'] }; }
    if (!s.urgency) { p.asked = 'urgency'; return { text: 'How urgent is it?', chips: ['Critical', 'Urgent', 'Normal'] }; }
    p.asked = 'confirm';
    return { text: `Please confirm the SOS:\n• Blood type: **${s.bloodType}**\n• Place: **${s.place.name}**\n• Units: **${s.units}**\n• Urgency: **${s.urgency}**\nShall I send it to donors?`, chips: ['Yes, send it', 'Cancel'] };
  }
}
