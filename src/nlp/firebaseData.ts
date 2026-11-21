/**
 * Firestore-backed data source for BloodBot. Uses the same collections and document shapes as the
 * rest of the app (users, donations, requests, notifications), so anything the bot does shows up
 * on the normal screens.
 */
import { addDoc, db, doc, getDocs, getDonationsCollection, getNotificationsCollection, getRequestsCollection, getUsersCollection, limit, orderBy, query, serverTimestamp, setDoc, where } from '../config/firebase';
import type { AppUserProfile } from '../context/UserContext';
import { broadcastSos } from '../ai/sosBroadcast';
import type { BotData, DonorLite, RequestLite } from './bot';

export function firebaseBotData(getProfile: () => AppUserProfile | null): BotData {
  return {
    me: () => {
      const p = getProfile();
      return p ? { ...p, fullName: p.fullName || 'User' } : null;
    },

    async donors() {
      const out: DonorLite[] = [];
      // Active donation offers carry map coordinates.
      const offers = await getDocs(query(getDonationsCollection(), orderBy('createdAt', 'desc'), limit(50)));
      offers.docs.forEach((d: any) => {
        const x = d.data();
        if (x.status && x.status !== 'active') return;
        out.push({ uid: x.uid, name: x.name || 'Donor', bloodType: x.bloodType, location: x.location, ...(x.coords ? { lat: x.coords.latitude, lng: x.coords.longitude } : {}), available: true });
      });
      // Verified, available users without an active offer.
      const users = await getDocs(query(getUsersCollection(), where('status', '==', 'approved')));
      users.docs.forEach((d: any) => {
        const x = d.data();
        if (x.role === 'admin' || !x.bloodType) return;
        out.push({ uid: x.uid || d.id, name: x.fullName || 'Donor', bloodType: x.bloodType, location: x.location, available: x.isAvailable !== false, lastDonationDate: x.lastDonationDate });
      });
      return out;
    },

    async openRequests() {
      const snap = await getDocs(query(getRequestsCollection(), orderBy('createdAt', 'desc'), limit(30)));
      return snap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((r: any) => (r.status ?? 'open') === 'open')
        .map((r: any): RequestLite => ({ id: r.id, uid: r.uid, name: r.name || 'User', bloodType: r.bloodType, hospital: r.hospital || '', location: r.location, unitsNeeded: Number(r.unitsNeeded) || 1, priority: r.priority || 'moderate' }));
    },

    async createSOS({ bloodType, place, units, priority }) {
      const me = getProfile();
      if (!me) throw new Error('Not signed in');
      const name = me.fullName || 'User';
      const initials = name.split(' ').filter(Boolean).map((s) => s[0]).join('').slice(0, 2) || 'U';
      // The app uses two priority levels.
      const appPriority = priority === 'normal' ? 'moderate' : 'urgent';
      const ref = await addDoc(getRequestsCollection(), {
        uid: me.uid, name, initials, bloodType, location: place.name, hospital: place.name,
        unitsNeeded: units, priority: appPriority, status: 'open', responders: [], source: 'bloodbot', createdAt: serverTimestamp(),
      });
      // Notify compatible, available donors, ranked by the AI donor-response model.
      const ranked = await broadcastSos({ id: ref.id, uid: me.uid, name, bloodType, hospital: place.name, location: place.name, unitsNeeded: units, priority: appPriority });
      return { notified: ranked.length };
    },

    async setAvailability(available) {
      const me = getProfile();
      if (!me) return;
      await setDoc(doc(db, 'users', me.uid), { isAvailable: available, updatedAt: serverTimestamp() }, { merge: true });
    },
  };
}
