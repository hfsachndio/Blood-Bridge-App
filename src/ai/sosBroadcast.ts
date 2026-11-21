// Sends an SOS to the donors the AI model ranks most likely to respond (same flow as the website):
// compatible, available, verified donors are scored by the donor-response neural network, notified
// in that order, and the top five (with their probability) are saved on the request as aiRanking.
import { addDoc, doc, getDocs, serverTimestamp, setDoc, db, getUsersCollection, getRequestsCollection, getNotificationsCollection } from '../config/firebase';
import { rankDonors, type RankedDonor } from './donorRank';

export interface SosInput { id: string; uid: string; name: string; bloodType: string; hospital?: string; location?: string; unitsNeeded: number; priority?: string }

export async function broadcastSos(sos: SosInput): Promise<RankedDonor[]> {
  const [usersSnap, reqSnap] = await Promise.all([getDocs(getUsersCollection()), getDocs(getRequestsCollection())]);
  const users = usersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  const requests = reqSnap.docs.map((d: any) => d.data());
  const ranked = rankDonors(users, requests, sos);
  const place = sos.hospital || sos.location || 'the hospital';
  await Promise.allSettled(ranked.map((d) => addDoc(getNotificationsCollection(d.uid), {
    type: 'sos', title: '🚨 Urgent Blood Request',
    body: `${sos.name} needs ${sos.bloodType} blood at ${place}. ${sos.unitsNeeded} unit(s) required.`,
    fromUserId: sos.uid, fromUserName: sos.name, relatedId: sos.id, aiScore: d.p, isRead: false, createdAt: serverTimestamp(),
  })));
  await setDoc(doc(db, 'requests', sos.id), { aiRanking: ranked.slice(0, 5), notifiedCount: ranked.length }, { merge: true });
  return ranked;
}
