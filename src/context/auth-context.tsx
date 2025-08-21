
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onAuthStateChanged, User, signOut, Auth, Firestore } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const nonAuthRoutes = ['/login', '/signup'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth || !db) return;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // User is authenticated, now get their profile from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubUserDoc = onSnapshot(userDocRef, 
            async (userDocSnap) => {
                if (userDocSnap.exists()) {
                    // Force refresh the token to get latest custom claims from the server
                    await firebaseUser.getIdToken(true);
                    const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                    
                    setUser(firebaseUser);
                    setUserAccount(userAccountData);
                    setAccountId(userAccountData.accountId);
                    setLoading(false);
                } else {
                    // This can happen if the user exists in Auth but their Firestore doc was deleted.
                    console.error("User is authenticated but no user document found. Logging out.");
                    signOut(auth);
                }
            }, 
            (error) => {
                // This will trigger if the firestore.rules deny the read.
                console.error("Error listening to user document, likely permissions. Logging out.", error);
                signOut(auth);
            }
        );
        return () => unsubUserDoc();
      } else {
        // User is logged out
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, db]);

  useEffect(() => {
    if (loading) return;

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));
    const isVerifyRoute = pathname.startsWith('/verify-email');
    
    // Allow logged-in admins to access signup to invite others
    const isInviteFlow = pathname.startsWith('/signup') && !!user;

    if (user) { // User is logged in
      if (!user.emailVerified && !isVerifyRoute) {
        router.push('/verify-email');
      } else if (user.emailVerified && isVerifyRoute) {
        router.push('/');
      } else if (isNonAuthRoute && !isInviteFlow) {
        router.push('/');
      }
    } else { // User is not logged in
       if (!isNonAuthRoute && !isVerifyRoute) {
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router]);

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userAccount, accountId, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
