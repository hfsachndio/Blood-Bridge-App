/**
 * Web build of the app (react-native-web on Vercel): the same exports as firebase.ts, backed by the
 * Firebase JS SDK and the same project as the mobile app and the website. The web config is public;
 * access is controlled by firestore.rules.
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth as _getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore,
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
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyB1wLqhie7e-YV69z_gnWyWHlFu6vuq2J0',
  authDomain: 'blood-bridge-78f97.firebaseapp.com',
  projectId: 'blood-bridge-78f97',
  storageBucket: 'blood-bridge-78f97.firebasestorage.app',
  messagingSenderId: '56833967390',
  appId: '1:56833967390:web:163ce7d501a94f091af50f',
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);
const db = (() => { try { return initializeFirestore(app, { ignoreUndefinedProperties: true }); } catch { return _getFirestore(app); } })();
const auth = _getAuth(app);

export const getApp = () => app;
export const getAuth = (_app?: unknown) => auth;
export const getFirestore = () => db;

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
};

export const getUsersCollection = () => collection(db, 'users');
export const getDonationsCollection = () => collection(db, 'donations');
export const getRequestsCollection = () => collection(db, 'requests');
export const getMessagesCollection = () => collection(db, 'messages');
export const getChatsCollection = () => collection(db, 'chats');
export const getNotificationsCollection = (userId: string) => collection(db, 'notifications', userId, 'items');

export const firestoreFieldValue = { serverTimestamp, arrayUnion, arrayRemove, increment };

export {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove, increment, db,
};
