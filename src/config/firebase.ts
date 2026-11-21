/**
 * Centralized Firebase Configuration — Modular API (v23+)
 * Project: blood-bridge-78f97, shared with the Blood Bridge website (same Auth users + Firestore).
 * The web build of the app uses firebase.web.ts (Firebase JS SDK) with the same exports.
 * All exports use the modular SDK to avoid deprecation warnings.
 */

// ── Auth (modular) ──────────────────────────────────────────────────────────
import {
  getApp,
} from '@react-native-firebase/app';
import {
  getAuth as _getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from '@react-native-firebase/auth';

// ── Firestore (modular) ─────────────────────────────────────────────────────
import {
  getFirestore as _getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
} from '@react-native-firebase/firestore';

// ── Initialise ──────────────────────────────────────────────────────────────
const app = getApp();
const db = _getFirestore(app);
// No Cloud Storage: CNIC photos are compressed and kept in the user document (free Spark plan).

// ── Auth helpers ─────────────────────────────────────────────────────────────
export const getAuth = () => _getAuth(app);

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
};

// ── Firestore helpers ─────────────────────────────────────────────────────────
export const getFirestore = () => db;

/** Collection references — top-level */
export const getUsersCollection    = () => collection(db, 'users');
export const getDonationsCollection = () => collection(db, 'donations');
export const getRequestsCollection  = () => collection(db, 'requests');
export const getMessagesCollection  = () => collection(db, 'messages');
export const getChatsCollection     = () => collection(db, 'chats');

/** /notifications/{userId}/items — private per-user feed */
export const getNotificationsCollection = (userId: string) =>
  collection(db, 'notifications', userId, 'items');

/** FieldValue equivalents in modular API */
export const firestoreFieldValue = {
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
};

// Re-export modular helpers so screens can import from one place
export {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  db,
};
