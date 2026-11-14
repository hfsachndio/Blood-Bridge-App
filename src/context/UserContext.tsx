import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getAuth, getUsersCollection, setDoc, doc, onSnapshot, serverTimestamp, db } from '../config/firebase';
import { getMessaging, requestPermission, AuthorizationStatus, getToken } from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import { onAuthStateChanged } from '@react-native-firebase/auth';

export interface AppUserProfile {
    uid: string;
    fullName?: string;
    email?: string;
    phone?: string;
    bloodType?: string;
    dateOfBirth?: string;
    location?: string;
    isAvailable?: boolean;
    role?: 'user' | 'admin';
    status?: 'incomplete' | 'pending' | 'approved' | 'rejected';
    gender?: string;
    address?: string;
    cnicNumber?: string;
    cnicVerified?: boolean;
    documents?: string[];
    weight?: number;
    lastDonationDate?: string;
    eligibilityOutcome?: string;
    totalDonations?: number;
}

interface UserContextValue {
    authUser: any | null;
    profile: AppUserProfile | null;
    loading: boolean;
}

const UserContext = createContext<UserContextValue>({
    authUser: null,
    profile: null,
    loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [authUser, setAuthUser] = useState<any | null>(null);
    const [profile, setProfile] = useState<AppUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const userDocUnsubRef = useRef<null | (() => void)>(null);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (userDocUnsubRef.current) {
                userDocUnsubRef.current();
                userDocUnsubRef.current = null;
            }

            if (user) {
                setLoading(true); // Maintain loading while fetching snapshot
                // Register FCM token in background without blocking Navigation
                const messagingInstance = getMessaging(getApp());
                requestPermission(messagingInstance).then(authStatus => {
                    const enabled = authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
                    if (enabled) {
                        getToken(messagingInstance).then(fcmToken => {
                            if (fcmToken) {
                                setDoc(doc(db, 'users', user.uid), { fcmToken }, { merge: true });
                            }
                        }).catch(fcmErr => console.log('FCM token error:', fcmErr));
                    }
                }).catch(err => console.log('FCM request error:', err));

                try {
                    // live profile updates
                    userDocUnsubRef.current = onSnapshot(
                        doc(db, 'users', user.uid),
                        (snap: any) => {
                            if (getAuth().currentUser?.uid !== user.uid) return;

                            const snapAny: any = snap as any;
                            const exists =
                                snapAny && typeof snapAny.exists === 'function'
                                    ? snapAny.exists()
                                    : !!snapAny?.exists;
                            const data = exists ? (snapAny.data() as any) : {};
                            setProfile({
                                uid: user.uid,
                                fullName: data.fullName || user.displayName || 'User',
                                email: data.email || user.email || '',
                                phone: data.phone,
                                bloodType: data.bloodType,
                                dateOfBirth: data.dateOfBirth,
                                location: data.location,
                                isAvailable: typeof data.isAvailable === 'boolean' ? data.isAvailable : true,
                                role: data.role || 'user',
                                status: data.status || 'incomplete',
                                gender: data.gender,
                                address: data.address,
                                cnicNumber: data.cnicNumber,
                                cnicVerified: data.cnicVerified || false,
                                documents: data.documents || [],
                                weight: data.weight,
                                lastDonationDate: data.lastDonationDate,
                                eligibilityOutcome: data.eligibilityOutcome,
                                totalDonations: data.totalDonations || 0,
                            });
                            // Set actual auth state precisely when profile loads
                            setAuthUser(user);
                            setLoading(false);
                        }
                    );
                } catch (e) {
                    console.log('User profile load error:', e);
                    setProfile(null);
                    setAuthUser(user);
                    setLoading(false);
                }
            } else {
                setProfile(null);
                setAuthUser(null);
                setLoading(false);
            }
        });

        return () => {
            if (userDocUnsubRef.current) {
                userDocUnsubRef.current();
                userDocUnsubRef.current = null;
            }
            unsubscribe();
        };
    }, []);

    return (
        <UserContext.Provider value={{ authUser, profile, loading }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);


