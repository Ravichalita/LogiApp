
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onAuthStateChanged, User, signOut, Auth, Firestore } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';


interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const nonAuthRoutes = ['/login', '/signup', '/verify-email'];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebase, setFirebase] = useState<{ auth: Auth, db: Firestore } | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Initialize Firebase on the client side
    const { auth, db } = getFirebase();
    setFirebase({ auth, db });
  }, []);

  useEffect(() => {
    if (!firebase) return;

    const { auth, db } = firebase;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let userDocSnap;
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Retry logic to handle Firestore replication delay
        for (let i = 0; i < 5; i++) {
            userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) break;
            await delay(i < 2 ? 500 : 1000);
        }
        
        if (userDocSnap && userDocSnap.exists()) {
          const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUser(firebaseUser);
          setUserAccount(userAccountData);
          setAccountId(userAccountData.accountId);
        } else {
          console.error("User document not found in Firestore for UID:", firebaseUser.uid, "after multiple retries.");
          await signOut(auth); // Log out to prevent inconsistent state
          setUser(null);
          setUserAccount(null);
          setAccountId(null);
        }
      } else {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebase]);

  useEffect(() => {
    if (loading) return;

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));

    if (user) {
      if (!user.emailVerified && !pathname.startsWith('/verify-email')) {
        router.push('/verify-email');
      } else if (user.emailVerified && pathname.startsWith('/verify-email')) {
        router.push('/');
      } else if (isNonAuthRoute && !pathname.startsWith('/verify-email') && !pathname.startsWith('/signup')) {
         router.push('/');
      }
    } else {
      if (!isNonAuthRoute) {
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router]);

  const logout = async () => {
    if (!firebase) return;
    await signOut(firebase.auth);
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    router.push('/login');
  };

  const isAppLoading = loading || (!user && !nonAuthRoutes.some(route => pathname.startsWith(route)));

  if (isAppLoading) {
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
