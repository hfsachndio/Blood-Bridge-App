// Donor-response model: a small neural network (10→24→12→1, ReLU) trained in ml/train_donor_model.py.
// Predicts how likely a notified donor is to respond to an SOS within an hour, so the app can rank donors.
import model from "./donor-model.json";
import { ALL_PLACES, distanceKm, isCompatible, type BloodType, type Place } from "../nlp/blood";


export interface DonorInput {
  distanceKm: number; daysSinceDonation: number | null; exactType: boolean; totalDonations: number;
  pastResponses: number; hour: number; urgent: boolean; accountAgeDays: number;
}

export function donorFeatures(d: DonorInput): number[] {
  const days = d.daysSinceDonation == null ? 365 : Math.min(365, Math.max(0, d.daysSinceDonation));
  const h = (((d.hour ?? 12) % 24) + 24) % 24;
  return [
    Math.min(15, Math.max(0, d.distanceKm)), days, days >= 90 ? 1 : 0, d.exactType ? 1 : 0,
    Math.min(20, d.totalDonations || 0), Math.min(10, d.pastResponses || 0),
    Math.sin((2 * Math.PI * h) / 24), Math.cos((2 * Math.PI * h) / 24), d.urgent ? 1 : 0, Math.min(730, d.accountAgeDays || 0),
  ];
}

/** Probability (0–1) that this donor responds. */
export function responseProbability(d: DonorInput): number {
  let a = donorFeatures(d).map((v, i) => (v - model.mean[i]) / model.scale[i]);
  model.layers.forEach((layer, li) => {
    const out = layer.b.map((b, j) => a.reduce((s, v, i) => s + v * layer.W[i][j], b));
    a = li < model.layers.length - 1 ? out.map((v) => Math.max(0, v)) : out;
  });
  return 1 / (1 + Math.exp(-a[0]));
}

/** Short, human reasons for a score (what most moves it for this donor). */
export function reasons(d: DonorInput): string[] {
  const r: string[] = [];
  if (d.daysSinceDonation != null && d.daysSinceDonation < 90) r.push(`donated ${d.daysSinceDonation} days ago`);
  r.push(d.distanceKm <= 5 ? `${d.distanceKm.toFixed(1)} km away` : `${d.distanceKm.toFixed(1)} km is a longer trip`);
  if (d.pastResponses > 0) r.push(`answered ${d.pastResponses} SOS before`);
  if (d.exactType) r.push("exact blood type");
  const night = d.hour < 7 || d.hour >= 22;
  if (night) r.push("night-time request");
  return r.slice(0, 3);
}

export const donorModelInfo = { name: model.name, metrics: model.metrics, features: model.features };

/** Builds the model input for a donor from app data. */
export function donorInputFor(
  u: { uid: string; bloodType?: string; lastDonationDate?: string; totalDonations?: number; createdAt: string },
  ctx: { km: number; neededType?: string; urgent?: boolean; responsesByUid: Map<string, number>; at?: Date },
): DonorInput {
  const at = ctx.at ?? new Date();
  const days = u.lastDonationDate ? Math.floor((at.getTime() - new Date(u.lastDonationDate).getTime()) / 86400000) : null;
  return {
    distanceKm: ctx.km, daysSinceDonation: days, exactType: !!ctx.neededType && u.bloodType === ctx.neededType, totalDonations: u.totalDonations ?? 0,
    pastResponses: ctx.responsesByUid.get(u.uid) ?? 0, hour: at.getHours(), urgent: !!ctx.urgent,
    accountAgeDays: Math.max(0, Math.floor((at.getTime() - new Date(u.createdAt).getTime()) / 86400000)),
  };
}
/** How many SOS requests each donor has answered. */
export function responseCounts(requests: { responders: string[] }[]) {
  const m = new Map<string, number>();
  for (const r of requests) for (const uid of r.responders) m.set(uid, (m.get(uid) ?? 0) + 1);
  return m;
}

// ── App helpers: rank donors for an SOS the same way the website does ───────────

/** Finds a known Karachi area / hospital mentioned in free text ("Gulshan block 5", "Aga Khan"). */
export function locate(text?: string | null): Place | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  return ALL_PLACES.find((p) => t.includes(p.name.toLowerCase()) || (p.aliases ?? []).some((a) => t.includes(a)));
}
const toIso = (v: any): string | undefined => {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000).toISOString();
  return undefined;
};
export interface RankedDonor { uid: string; name: string; bloodType?: string; km: number; p: number }
/**
 * Compatible, available, approved donors ranked by the donor-response neural network,
 * most likely responder first. `users` and `requests` are raw Firestore documents.
 */
export function rankDonors(
  users: any[], requests: any[],
  sos: { uid: string; bloodType: string; hospital?: string; location?: string; priority?: string },
  maxKm = 25,
): RankedDonor[] {
  const where = locate(sos.hospital) ?? locate(sos.location);
  const responses = responseCounts(requests.map((r) => ({ responders: Array.isArray(r.responders) ? r.responders : [] })));
  return users
    .filter((u) => (u.uid || u.id) !== sos.uid && u.role !== "admin" && u.status === "approved" && u.isAvailable !== false && u.bloodType && isCompatible(u.bloodType as BloodType, sos.bloodType as BloodType))
    .map((u) => {
      const id = u.uid || u.id;
      const home = (typeof u.lat === "number" && typeof u.lng === "number" ? { lat: u.lat, lng: u.lng } : undefined) ?? locate(u.location);
      const km = where && home ? distanceKm(home, where) : 8; // unknown location → a typical cross-city trip
      const p = responseProbability(donorInputFor(
        { uid: id, bloodType: u.bloodType, lastDonationDate: toIso(u.lastDonationDate), totalDonations: u.totalDonations ?? 0, createdAt: toIso(u.createdAt) ?? new Date().toISOString() },
        { km, neededType: sos.bloodType, urgent: sos.priority === "critical" || sos.priority === "urgent", responsesByUid: responses },
      ));
      return { uid: id, name: u.fullName || "Donor", bloodType: u.bloodType, km: Math.round(km * 10) / 10, p: Math.round(p * 1000) / 1000 };
    })
    .filter((d) => d.km <= maxKm)
    .sort((a, b) => b.p - a.p);
}
