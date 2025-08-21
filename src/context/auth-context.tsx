
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onAuthStateChanged, User, signOut, Auth, Firestore, getIdToken, getIdTokenResult } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount } from '@/lib/types';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';


interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const nonAuthRoutes = ['/login'];

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
      setLoading(true);
      if (firebaseUser) {
        // Use onSnapshot to listen for real-time updates to the user document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubUserDoc = onSnapshot(userDocRef, async (userDocSnap) => {
          if (userDocSnap.exists()) {
            const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
            setUser(firebaseUser);
            setUserAccount(userAccountData);
            setAccountId(userAccountData.accountId);
            
            // This is the key change: we check if the custom claims on the token
            // match the data in Firestore. If not, we force a token refresh.
            // This ensures our security rules always have the latest accountId and role.
            const tokenResult = await getIdTokenResult(firebaseUser);
            const needsRefresh = tokenResult.claims.accountId !== userAccountData.accountId ||
                                tokenResult.claims.role !== userAccountData.role;

            if (needsRefresh) {
               await getIdToken(firebaseUser, true); // Force refresh
            }

          } else {
             // This might happen briefly after creation due to replication delay
             console.log("User document not yet available for UID:", firebaseUser.uid);
             setUser(firebaseUser); // Set firebase user but account data is pending
             setUserAccount(null);
             setAccountId(null);
          }
           setLoading(false);
        }, (error) => {
            console.error("Error listening to user document:", error);
            signOut(auth); // Log out on error to prevent inconsistent state
        });
        
        // This will be called when the onAuthStateChanged listener is cleaned up
        return () => unsubUserDoc();
      } else {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [firebase]);

  useEffect(() => {
    if (loading) return;

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));
    const isVerifyRoute = pathname.startsWith('/verify-email');
    const isSignupRoute = pathname.startsWith('/signup');
    const isInviteFlow = isSignupRoute && !!user;


    if (user) { // User is logged in
      if (!user.emailVerified && !isVerifyRoute) {
        router.push('/verify-email');
      } else if (user.emailVerified && isVerifyRoute) {
        router.push('/');
      } else if (isNonAuthRoute && !isInviteFlow) {
        // Logged-in user trying to access login page. Redirect them.
        router.push('/');
      }
    } else { // User is not logged in
       if (!isNonAuthRoute && !isSignupRoute && !isVerifyRoute) {
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
