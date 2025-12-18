
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { getFirebase } from '../lib/firebase';
import { UserAccount } from '../lib/types';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
    user: (User & { accountId?: string }) | null;
    userProfile: UserAccount | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userProfile: null,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<(User & { accountId?: string }) | null>(null);
    const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const { auth, db } = getFirebase();
        if (!auth) return;

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Fetch extra user data if needed, e.g. accountId from custom claims or Firestore profile
                // For now assuming accountId might be on the user object or fetched from profile
                // Let's fetch the user profile from 'users' collection

                // Note: In many setups, strict accountId is needed.
                // If we don't have it on User object (custom claims), we fetch it.

                try {
                    const userDocRef = doc(db!, 'users', currentUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const data = userDoc.data() as UserAccount;
                        setUserProfile(data);
                        // Attach accountId to user object for convenience
                        (currentUser as any).accountId = data.accountId;
                    }
                } catch (e) {
                    console.error("Error fetching user profile:", e);
                }

                setUser(currentUser as any);
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, userProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
