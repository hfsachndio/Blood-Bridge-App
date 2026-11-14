/**
 * Centralized Firebase Configuration — Modular API (v23+)
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

// ── Storage (modular) ───────────────────────────────────────────────────────
import {
  getStorage as _getStorage,
  ref,
  putFile,
  uploadString,
  uploadBytes,
  getDownloadURL,
} from '@react-native-firebase/storage';

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
// Explicitly declare the bucket with the legacy .appspot.com domain! 
// This fixes the 'object-not-found' bug when uploading in RN Firebase with new Firebase projects!
const storage = _getStorage(app, 'gs://bloodbridge-b2f0a.appspot.com');

// ── Auth helpers ─────────────────────────────────────────────────────────────
export const getAuth = () => _getAuth(app);
export const getStorage = () => storage;

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
  ref,
  putFile,
  uploadString,
  uploadBytes,
  getDownloadURL,
};
